const log4js = require("log4js");
const moment = require("moment");
function updateLog(functionName, message) {
  log4js.configure({
    appenders: {
      out: { type: "stdout", layout: { type: "messagePassThrough" } },
    },
    categories: { default: { appenders: ["out"], level: "info" } },
  });
  const logger = log4js.getLogger("out");

  logger.info(
    JSON.stringify({
      functionName: functionName,
      message: message,
      "service-name": process.env.SERVICE,
      application: process.env.SERVICE,
      region: process.env.REGION,
      environment: process.env.STAGE,
      "@timestamp": moment().format("YYYY-MM-DD H:m:ss"),
    })
  );
}

module.exports = { updateLog };
