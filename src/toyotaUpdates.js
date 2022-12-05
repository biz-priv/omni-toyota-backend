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
const TOYOTA_RESPONSE_DDB = "omni-rt-toyota-response-test";

module.exports.handler = async (event, context, callback) => {
  try {
    console.log("event", JSON.stringify(event));
    // const streamRecords = AWS.DynamoDB.Converter.unmarshall(event.Records[0].dynamodb.NewImage);
    // const payload = [streamRecord];
    const streamRecord = AWS.DynamoDB.Converter.unmarshall({
      loadId: {
        S: "4519743",
      },
      SeqNo: {
        S: "1",
      },
      appointmentEndTime: {
        S: "2023-02-02 14:00:00.000",
      },
      appointmentStartTime: {
        S: "2023-02-02 12:00:00.000",
      },
      billOfLading: {
        S: "8160273",
      },
      carrierOrderNo: {
        S: "",
      },
      containerNo: {
        S: "",
      },
      destinationAddress: {
        S: "651W57THST",
      },
      destinationCity: {
        S: "NEWNEWYORK",
      },
      destinationFacility: {
        S: "4519743",
      },
      destinationState: {
        S: "NY",
      },
      destinationZip: {
        S: "10019",
      },
      eta: {
        S: "1900-01-01 00:00:00.000",
      },
      event: {
        S: "",
      },
      eventtimestamp: {
        S: "",
      },
      gpslat: {
        S: "",
      },
      gpslong: {
        S: "",
      },
      InsertedTimeStamp: {
        S: "2022:12:03 13:47:12",
      },
      originAddress: {
        S: "2423 PLEASANT RD",
      },
      originCity: {
        S: "SOMEPLACE",
      },
      originFacility: {
        S: "4519743",
      },
      originState: {
        S: "GA",
      },
      originZip: {
        S: "31234",
      },
      reasoncode: {
        S: "",
      },
      reasondescription: {
        S: "",
      },
      scac: {
        S: "OMNG",
      },
      sequenceNumber: {
        S: "",
      },
      timeZone: {
        S: "",
      },
      transportationMode: {
        S: "",
      },
    });

    const payload = [Object.assign({}, streamRecord)];
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
