const AWS = require("aws-sdk");
const moment = require("moment-timezone");
const axios = require("axios");
const { putItem } = require("./shared/dynamo");

// const TOYOTA_CLIENT_ID = process.env.TOYOTA_CLIENT_ID;
// const TOYOTA_JWT_URL = process.env.TOYOTA_JWT_URL;
// const TOYOTA_URL = process.env.TOYOTA_URL;
const TOYOTA_CLIENT_ID = "a4eb2f67-3a28-450f-8af5-ae962f123d90";
const TOYOTA_JWT_URL = "https://d1h9vb8y1s0f1d.cloudfront.net/api/JWT";
const TOYOTA_URL = "https://ddvyfwjl3479f.cloudfront.net/api/ShipmentPost";
const TOYOTA_RESPONSE_DDB = "omni-rt-toyota-response-dev";

module.exports.handler = async (event, context, callback) => {
  try {
    console.log("event", JSON.stringify(event));
    const streamRecords = AWS.DynamoDB.Converter.unmarshall(
      event.Records[0].dynamodb.NewImage
    );
    const payload = [Object.assign({}, streamRecords)];
    delete payload[0].InsertedTimeStamp;
    delete payload[0].SeqNo;

    console.log("payload", payload);
    const toyotaRes = await toyotaSendUpdate(payload);
    console.log("toyotaRes", toyotaRes);
    const resPayload = {
      ...streamRecord,
      ...toyotaRes,
      InsertedTimeStamp: moment
        .tz("America/Chicago")
        .format("YYYY:MM:DD HH:mm:ss")
        .toString(),
    };
    console.log("resPayload", JSON.stringify(resPayload));
    await putItem(TOYOTA_RESPONSE_DDB, resPayload);
    return "success";
  } catch (error) {
    console.error("Error", error);
    return "error";
  }
};

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
async function toyotaSendUpdate(payload) {
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
      console.log("error:toyotaSendUpdate", error);
      resolve({
        toyotaRes: "toyota api error",
        status: "failed",
      });
    }
  });
}
