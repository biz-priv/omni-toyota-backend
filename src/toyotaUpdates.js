const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const axios = require("axios");
const { putItem } = require("./shared/dynamo");
const { updateLog } = require("./shared/logHelper");

const TOYOTA_CLIENT_ID = process.env.TOYOTA_CLIENT_ID;
const TOYOTA_JWT_URL = process.env.TOYOTA_JWT_URL;
const TOYOTA_URL = process.env.TOYOTA_URL;
const TOYOTA_RESPONSE_DDB = process.env.TOYOTA_RESPONSE_DDB;

module.exports.handler = async (event, context, callback) => {
  try {
    console.info("Event", event);
    updateLog("toyotaUpdates:handler:event", event);
    // processing all the array of records
    for (let index = 0; index < event.Records.length; index++) {
      const NewImage = event.Records[index].dynamodb.NewImage;
      try {
        const streamRecordsRaw = AWS.DynamoDB.Converter.unmarshall(NewImage);
        console.log("streamRecordsRaw", streamRecordsRaw);
        //check if carrierOrderNo have proper value or not
        if (streamRecordsRaw.carrierOrderNo.length === 0) {
          return {};
        }
        const streamRecords = [Object.assign({}, streamRecordsRaw)];
        const payload = JSON.parse(streamRecords.payload);

        console.log("payload", payload);
        let toyotaRes = [];
        for (let index = 0; index < payload.length; index++) {
          const element = payload[index];
          const toyotaResData = await sendToyotaUpdate([element]);
          toyotaRes = [...toyotaRes, toyotaResData];
        }

        console.log("toyotaRes", toyotaRes);
        // send payload to toyota
        const dateTime = moment.tz("America/Chicago");
        const resPayload = {
          ...streamRecords,
          toyotaRes: JSON.stringify(toyotaRes),
          InsertedTimeStamp: dateTime.format("YYYY:MM:DD HH:mm:ss").toString(),
          ConciliationTimeStamp: dateTime.format("YYYYMMDD").toString(),
        };
        console.log("resPayload", resPayload);
        // save toyota response
        await putItem(TOYOTA_RESPONSE_DDB, resPayload);
      } catch (error) {
        console.error("Error:process", error);
      }
    }
    return "success";
  } catch (error) {
    console.error("Error", error);
    return "error";
  }
};

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
            "toyotaUpdates:toyotaAuth:error",
            error?.response?.data ?? "toyota api error"
          );
          reject(error?.response?.data ?? "toyota api error");
        });
    } catch (error) {
      updateLog("toyotaUpdates:toyotaAuth:error", error);
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
            "toyotaUpdates:sendToyotaUpdate:error",
            error?.response?.data ?? "toyota api error"
          );
          resolve({
            toyotaRes:
              JSON.stringify(error?.response?.data) ?? "toyota api error",
            status: "failed",
          });
        });
    } catch (error) {
      updateLog("toyotaUpdates:sendToyotaUpdate:error", error);
      resolve({
        toyotaRes: "toyota api error",
        status: "failed",
      });
    }
  });
}
