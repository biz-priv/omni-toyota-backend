const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const axios = require("axios");
// const { putItem } = require("./shared/dynamo");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TOYOTA_CLIENT_ID = process.env.TOYOTA_CLIENT_ID;
const TOYOTA_JWT_URL = process.env.TOYOTA_JWT_URL;
const TOYOTA_URL = process.env.TOYOTA_URL;
const TOYOTA_RESPONSE_DDB = process.env.TOYOTA_RESPONSE_DDB;

// "ConciliationTimeStamp": "20221205", //index

module.exports.handler = async (event, context, callback) => {
  try {
    console.log("event", JSON.stringify(event));
    const dateList = getDate();
    console.log("dateList", dateList);

    const toyotaData = await getAllDataFromToyota(dateList);
    console.log("toyotaData", toyotaData.length);

    const payload = createPayload(toyotaData, dateList);
    console.log("payload", payload);

    const toyotaRes = await sendToyotaUpdate(payload);
    console.log("toyotaRes", toyotaRes);
    return "success";
  } catch (error) {
    console.error("Error", error);
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
      console.log("data", data);
      if (data && data.Items.length > 0) {
        resolve(data.Items);
      } else {
        reject("No data available");
      }
    } catch (error) {
      console.log("error:getAllDataFromToyota", error);
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
  return data.map((e) => ({
    TABLE_NAME: "HUBGROUP",
    DEPOT_CD: "",
    INTFC_ID: "000000002",
    INTFC_NAME: "HUBGROUP",
    INTFC_TYPE: "STREAMING", // hardcode
    INTFC_DTE: dateList.INTFC_DTE, //current date
    INTFC_TO_TMSTMP: dateList.INTFC_TO_TMSTMP,
    INTFC_FROM_TMSTMP: dateList.INTFC_FROM_TMSTMP,
    TOT_REC_CNT: "586", //TODO:- should we count success or failure records also
    SRCE_NAME: "HUB",
    CREATE_TMSTMP: dateList.CREATE_TMSTMP, //current time
    TIME_ZONE: "CST", //hardcode
  }));
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
          console.log(
            "error",
            JSON.stringify(error?.response?.data ?? "toyota api error")
          );
          reject(error?.response?.data ?? "toyota api error");
        });
    } catch (error) {
      console.log("error:toyotaAuth", error);
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
          console.log(JSON.stringify(response.data));
          resolve({
            toyotaRes: JSON.stringify(response.data),
            status: "success",
          });
        })
        .catch(function (error) {
          console.log(
            "error",
            JSON.stringify(error?.response?.data ?? "toyota api error")
          );
          resolve({
            toyotaRes:
              JSON.stringify(error?.response?.data) ?? "toyota api error",
            status: "failed",
          });
        });
    } catch (error) {
      console.log("error:sendToyotaUpdate", error);
      resolve({
        toyotaRes: "toyota api error",
        status: "failed",
      });
    }
  });
}

function getDate() {
  const dateNow = moment.tz("America/Chicago");
  const dateToday = dateNow.format("YYYY-MM-DD HH:mm:ss").toString();
  const datePrev = dateNow
    .subtract(1, "days")
    .format("YYYY-MM-DD HH:mm:ss")
    .toString();
  const ConciliationTimeStamp = dateNow
    .subtract(1, "days")
    .format("YYYYMMDD")
    .toString();

  return {
    INTFC_DTE: dateNow.format("YYYY-MM-DD").toString(),
    INTFC_TO_TMSTMP: datePrev,
    INTFC_FROM_TMSTMP: dateToday,
    CREATE_TMSTMP: dateNow.format("YYYY-MM-DDTHH:mm:ss").toString(),
    ConciliationTimeStamp,
  };
}
