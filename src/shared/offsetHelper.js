const AWS = require("aws-sdk");
const ddb = new AWS.DynamoDB.DocumentClient({
  region: process.env.REGION,
});
const moment = require("moment");

async function getUTCTime(dateTime, timezone) {
  let offSet = 0;
  const cuWeek = getWeekCount(dateTime);
  if (cuWeek >= 11 && cuWeek <= 44) {
    offSet = 5;
  } else {
    offSet = 6;
  }

  const paramTimezoneMaster = {
    TableName: process.env.TIMEZONE_MASTER,
    KeyConditionExpression: "PK_TimeZoneCode = :PK_TimeZoneCode",
    ExpressionAttributeValues: {
      ":PK_TimeZoneCode": timezone,
    },
  };
  let timezoneMaster = await ddb.query(paramTimezoneMaster).promise();
  timezoneMaster =
    timezoneMaster.Items.length > 0 ? timezoneMaster.Items[0] : {};
  console.log("timezoneMaster", timezoneMaster);
  offSet = parseInt(timezoneMaster.HoursAway) - offSet;

  if (offSet <= 0) {
    let number = (offSet * -1).toString();
    console.log("number", number);
    number = "-" + (number.length > 1 ? number : "0" + number) + ":00";
    offSet = number;
  } else {
    let number = (offSet * 1).toString();
    number = "+" + (number.length > 1 ? number : "0" + number) + ":00";
    offSet = number;
  }
  const dateStr = moment(dateTime).format("YYYY-MM-DDTHH:mm:ss") + offSet;
  return dateStr;
}

/**
 * helper function to get the current week count based on date
 * @param {*} date
 * @returns
 */
function getWeekCount(date) {
  Date.prototype.getWeek = function (dowOffset) {
    dowOffset = typeof dowOffset == "number" ? dowOffset : 0; //default dowOffset to zero
    var newYear = new Date(this.getFullYear(), 0, 1);
    var day = newYear.getDay() - dowOffset; //the day of week the year begins on
    day = day >= 0 ? day : day + 7;
    var daynum =
      Math.floor(
        (this.getTime() -
          newYear.getTime() -
          (this.getTimezoneOffset() - newYear.getTimezoneOffset()) * 60000) /
          86400000
      ) + 1;
    var weeknum;
    //if the year starts before the middle of a week
    if (day < 4) {
      weeknum = Math.floor((daynum + day - 1) / 7) + 1;
      if (weeknum > 52) {
        let nYear = new Date(this.getFullYear() + 1, 0, 1);
        let nday = nYear.getDay() - dowOffset;
        nday = nday >= 0 ? nday : nday + 7;
        /*if the next year starts before the middle of
                  the week, it is week #1 of that year*/
        weeknum = nday < 4 ? 1 : 53;
      }
    } else {
      weeknum = Math.floor((daynum + day - 1) / 7);
    }
    return weeknum;
  };
  return new Date(date).getWeek();
}

module.exports = {
  getUTCTime,
};
