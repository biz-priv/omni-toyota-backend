const log4js = require("log4js");
const moment = require("moment");
function updateLog(functionName, message = "", status = "INFO") {
  try {
    log4js.configure({
      appenders: {
        out: { type: "stdout", layout: { type: "messagePassThrough" } },
      },
      categories: { default: { appenders: ["out"], level: "info" } },
    });
    const logger = log4js.getLogger("out");
    let msg = "";
    if (typeof message === "string" || message instanceof String) {
      msg = message;
    } else if (message instanceof Error) {
      msg = "Error:" + message?.message ?? "";
    } else {
      msg = JSON.stringify(message);
    }

    logger.info(
      JSON.stringify({
        functionName: functionName ?? "",
        message: msg,
        status: status, // ERROR, INFO
        "service-name": process.env.SERVICE,
        application: process.env.SERVICE,
        region: process.env.REGION,
        environment: process.env.STAGE,
        "@timestamp": moment().format("YYYY-MM-DD H:m:ss"),
      })
    );
  } catch (error) {}
}

module.exports = { updateLog };
