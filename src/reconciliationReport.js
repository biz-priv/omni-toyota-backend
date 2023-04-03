const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const axios = require("axios");
const { updateLog } = require("./shared/logHelper");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require("uuid");
const { putItem } = require("./shared/dynamo");

const TOYOTA_CLIENT_ID = process.env.TOYOTA_CLIENT_ID;
const TOYOTA_JWT_URL = process.env.TOYOTA_JWT_URL;
const TOYOTA_URL = process.env.TOYOTA_URL;
const TOYOTA_RESPONSE_DDB = process.env.TOYOTA_RESPONSE_DDB;
const TOYOTA_RECON_REPORT_DDB = process.env.TOYOTA_RECON_REPORT_DDB;

module.exports.handler = async (event, context, callback) => {
  try {
    updateLog("reconciliationReport:handler:event", event);

    const dateList = getDate();
    updateLog("reconciliationReport:handler:dateList", dateList);

    const toyotaData = await getAllDataFromToyota(dateList);
    updateLog("reconciliationReport:handler:toyotaData", toyotaData.length);

    const payload = createPayload(toyotaData, dateList);
    updateLog("reconciliationReport:handler:payload", payload);

    const toyotaRes = await sendToyotaUpdate(payload);
    updateLog("reconciliationReport:handler:toyotaRes", toyotaRes);

    //put dynamo db omni-rt-toyota-recon-report-{env}
    const reconReportPayload = {
      PK: uuidv4(),
      payload: JSON.stringify(payload),
      response: JSON.stringify(toyotaRes),
      status: toyotaRes?.status ?? "",
      insertedTimeStamp: moment
        .tz("America/Chicago")
        .format("YYYY:MM:DD HH:mm:ss")
        .toString(),
    };
    console.log("reconReportPayload", reconReportPayload);
    await putItem(TOYOTA_RECON_REPORT_DDB, reconReportPayload);

    return "success";
  } catch (error) {
    updateLog("reconciliationReport:handler:Error", error, "ERROR");
    return "error";
  }
};

/**
 *get all records of one day
 * @returns
 */
function getAllDataFromToyota(dateList) {
  return new Promise(async (resolve, reject) => {
    try {
      const params = {
        TableName: TOYOTA_RESPONSE_DDB,
        IndexName: `toyota-reconciliation-report-ConciliationTimeStamp-Index-${process.env.STAGE}`,
        KeyConditionExpression: "#ConciliationTimeStamp = :date",
        ExpressionAttributeNames: {
          "#ConciliationTimeStamp": "ConciliationTimeStamp",
        },
        ExpressionAttributeValues: { ":date": dateList.ConciliationTimeStamp },
      };
      const data = await dynamodb.query(params).promise();
      if (data && data.Items.length > 0) {
        resolve(data.Items);
      } else {
        reject("No data available");
      }
    } catch (error) {
      updateLog(
        "reconciliationReport:getAllDataFromToyota:error",
        error,
        "ERROR"
      );
      reject(error);
    }
  });
}

/**
 * create toyota payload
 * @param {*} data
 * @returns
 */
function createPayload(data, dateList) {
  return {
    TABLE_NAME: "MACH",
    DEPOT_CD: "",
    INTFC_ID: "000000002",
    INTFC_NAME: "MACH", //req
    INTFC_TYPE: "STREAMING", // hardcode
    SRCE_NAME: "MACH",
    INTFC_DTE: dateList.INTFC_DTE, //req //current date
    INTFC_TO_TMSTMP: dateList.INTFC_TO_TMSTMP,
    INTFC_FROM_TMSTMP: dateList.INTFC_FROM_TMSTMP,
    TOT_REC_CNT: data.map((e) => e.status == "success").length.toString(),
    CREATE_TMSTMP: dateList.CREATE_TMSTMP, //current time
    TIME_ZONE: "CST", //hardcode
  };
}

/**
 * token auth api to get token for main toyota api
 * @returns
 */
function toyotaAuth() {
  return new Promise(async (resolve, reject) => {
    try {
      const config = {
        method: "post",
        url: TOYOTA_JWT_URL,
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          clientId: TOYOTA_CLIENT_ID,
        }),
      };

      axios(config)
        .then(function (response) {
          resolve(response.data);
        })
        .catch(function (error) {
          updateLog(
            "reconciliationReport:toyotaAuth:error",
            error?.response?.data ?? "toyota api error",
            "ERROR"
          );
          reject(error?.response?.data ?? "toyota api error");
        });
    } catch (error) {
      updateLog("reconciliationReport:toyotaAuth:error", error, "ERROR");
      reject(error);
    }
  });
}

/**
 * main toyota api
 * @param {*} payload
 * @returns
 */
async function sendToyotaUpdate(payload) {
  return new Promise(async (resolve, reject) => {
    try {
      const authData = await toyotaAuth();
      const config = {
        method: "post",
        url: TOYOTA_URL,
        headers: {
          "Content-Type": "application/json",
          Authorization: authData.access_token,
        },
        data: JSON.stringify(payload),
      };

      axios(config)
        .then(function (response) {
          resolve({
            toyotaRes: JSON.stringify(response.data),
            status: "success",
          });
        })
        .catch(function (error) {
          updateLog(
            "reconciliationReport:sendToyotaUpdate:error",
            error?.response?.data ?? "toyota api error",
            "ERROR"
          );
          resolve({
            toyotaRes:
              JSON.stringify(error?.response?.data) ?? "toyota api error",
            status: "failed",
          });
        });
    } catch (error) {
      updateLog("reconciliationReport:sendToyotaUpdate:error", error, "ERROR");
      resolve({
        toyotaRes: "toyota api error",
        status: "failed",
      });
    }
  });
}

/**
 * date helper all times are in CST
 * @returns
 */
function getDate() {
  return {
    INTFC_DTE: moment.tz("America/Chicago").format("YYYY-MM-DD").toString(),
    CREATE_TMSTMP: moment
      .tz("America/Chicago")
      .format("YYYY-MM-DDTHH:mm:ss")
      .toString(),
    INTFC_TO_TMSTMP: moment
      .tz("America/Chicago")
      // .subtract(1, "days")
      .format("YYYY-MM-DD HH:mm:ss")
      .toString(),
    INTFC_FROM_TMSTMP: moment
      .tz("America/Chicago")
      .format("YYYY-MM-DD HH:mm:ss")
      .toString(),
    ConciliationTimeStamp: moment
      .tz("America/Chicago")
      // .subtract(1, "days")
      .format("YYYYMMDD")
      .toString(),
  };
}
