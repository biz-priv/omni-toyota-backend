const moment = require("moment-timezone");
const { prepareBatchFailureObj, setDelay } = require("./shared/dataHelper");
const {
  getItem,
  queryWithPartitionKey,
  queryWithIndex,
  putItem,
  updateItem,
} = require("./shared/dynamo");
const { updateLog } = require("./shared/logHelper");
const { getUTCTime } = require("./shared/offsetHelper");
const { getToyotaResonCodeDetails } = require("./shared/toyotaMapping");
// const { v4: uuidv4 } = require("uuid");

const {
  CONSIGNEE_TABLE,
  REFERENCES_TABLE,
  SHIPMENT_HEADER_TABLE,
  SHIPMENT_MILESTONE_TABLE,
  SHIPPER_TABLE,
  REFERENCES_INDEX_KEY_NAME,
  TOYOTA_DDB,
  TOYOTA_BILL_NO, //dev:- "23190", prod:- "23032"
} = process.env;

module.exports.handler = async (event, context, callback) => {
  let sqsEventRecords = [];
  try {
    updateLog("toyotaSqsToDynamoDB:handler:event", event);
    console.info("Event from Source", event);
    sqsEventRecords = event.Records;
    // sqsEventRecords = [{}];
    const faildSqsItemList = [];
    /**
     * added 45 sec delay
     */
    await setDelay(45);

    for (let index = 0; index < sqsEventRecords.length; index++) {
      const sqsItem = sqsEventRecords[index];
      try {
        const dynamoData = JSON.parse(sqsItem.body);
        updateLog("toyotaSqsToDynamoDB:handler:dynamoData", dynamoData);

        //get the primary key
        const { tableList, primaryKeyValue } = getTablesAndPrimaryKey(
          dynamoData.dynamoTableName,
          dynamoData
        );

        //check from shipment header if it is a toyota event
        const shipmentHeaderData = await getItem(SHIPMENT_HEADER_TABLE, {
          [tableList[SHIPMENT_HEADER_TABLE].PK]: primaryKeyValue,
        });
        updateLog(
          "toyotaSqsToDynamoDB:handler:shipmentHeaderData",
          shipmentHeaderData
        );

        if (
          shipmentHeaderData &&
          shipmentHeaderData.Item &&
          shipmentHeaderData.Item.BillNo === TOYOTA_BILL_NO
        ) {
          //get data from all the requied tables
          const dataSet = await fetchDataFromTables(tableList, primaryKeyValue);

          const shipmentHeader =
            dataSet.shipmentHeader.length > 0 ? dataSet.shipmentHeader[0] : {};

          const shipmentMilestone = getMilestoneDataObj(
            dataSet.shipmentMilestone,
            dynamoData
          );

          console.log("shipmentMilestone", shipmentMilestone);
          // return {};
          console.log(
            "shipmentHeader.ReadyDateTime",
            shipmentHeader.ReadyDateTime
          );
          console.log("shipmentHeader.ETADateTime", shipmentHeader.ETADateTime);
          if (
            dynamoData.dynamoTableName === SHIPMENT_HEADER_TABLE &&
            (shipmentHeader.ReadyDateTime.startsWith("19") ||
              shipmentHeader.ScheduledDateTime.startsWith("19"))
          ) {
            continue;
          }

          const eventData = getEventdesc(
            shipmentHeader,
            shipmentMilestone,
            dynamoData.dynamoTableName
          );
          console.log("eventData", eventData);

          for (let index = 0; index < eventData.length; index++) {
            const eventDesc = eventData[index];

            //prepare the payload
            let toyotaObj = await mapToyotaData(dataSet, eventDesc, dynamoData);

            if (
              shipmentHeader.ScheduledDateTime != "" &&
              shipmentHeader.ReadyDateTime != ""
            ) {
              const event =
                toyotaObj.event == "Delivery Appointment"
                  ? "Pick Up Appointment"
                  : "Delivery Appointment";

              const secondToyotaObj = {
                ...toyotaObj,
                event: event,
              };
              toyotaObj = [toyotaObj, secondToyotaObj];
            } else {
              toyotaObj = [toyotaObj];
            }

            console.log("toyotaObj", toyotaObj);

            // return {};

            if (
              toyotaObj[0].billOfLading == 0 ||
              toyotaObj[0].billOfLading == "" ||
              toyotaObj[0].containerNo == 0 ||
              toyotaObj[0].containerNo == "" ||
              toyotaObj[0].eventtimestamp == 0 ||
              toyotaObj[0].eventtimestamp == ""
            ) {
              return `Missing require fileds eventtimestamp or billOfLading or containerNo`;
            }
            updateLog("toyotaSqsToDynamoDB:handler:toyotaObj", toyotaObj);

            /**
             * check if we have same payload on the toyota table then don't put the
             * else increase the SeqNo and put the record to toyota table
             * if carrierOrderNo is empty for previous records then update that also.
             */
            const getToyotaData = await queryWithPartitionKey(TOYOTA_DDB, {
              loadId: toyotaObj[0].loadId,
            });
            let SeqNo = 1;
            let rawPaylaod = JSON.parse(JSON.stringify(toyotaObj));
            console.log("rawPaylaod", rawPaylaod);
            if (rawPaylaod.length == 2) {
              delete rawPaylaod[0].InsertedTimeStamp;
              delete rawPaylaod[1].InsertedTimeStamp;
            } else {
              delete rawPaylaod[0].InsertedTimeStamp;
            }

            // console.log("getToyotaData", getToyotaData);

            if (getToyotaData.Items && getToyotaData.Items.length > 0) {
              const { latestObj, isDiff } = getDiff(
                [...getToyotaData.Items],
                rawPaylaod
              );
              console.log("isDiff", isDiff);
              // return {};
              if (isDiff) {
                SeqNo += getToyotaData.Items.length;
                await putItem(TOYOTA_DDB, {
                  ...toyotaObj[0],
                  SeqNo: SeqNo.toString(),
                  payload: JSON.stringify(rawPaylaod),
                });

                //update all other records with carrierOrderNo
                if (
                  latestObj.carrierOrderNo.length === 0 &&
                  toyotaObj[0].carrierOrderNo.length > 0
                ) {
                  for (
                    let index = 0;
                    index < getToyotaData.Items.length;
                    index++
                  ) {
                    const e = getToyotaData.Items[index];
                    await updateItem(
                      TOYOTA_DDB,
                      {
                        loadId: e.loadId,
                        SeqNo: e.SeqNo,
                      },
                      {
                        ...e,
                        carrierOrderNo: toyotaObj[0].carrierOrderNo,
                        payload: JSON.stringify(rawPaylaod),
                      }
                    );
                  }
                }
              }
            } else {
              // return {};
              //save to dynamo DB
              await putItem(TOYOTA_DDB, {
                ...toyotaObj[0],
                SeqNo: SeqNo.toString(),
                payload: JSON.stringify(rawPaylaod),
              });
            }
          }
        }
      } catch (error) {
        updateLog(
          "toyotaSqsToDynamoDB:handler:error in for loop:",
          error,
          "ERROR"
        );
        faildSqsItemList.push(sqsItem);
      }
    }
    return prepareBatchFailureObj(faildSqsItemList);
  } catch (error) {
    updateLog("toyotaSqsToDynamoDB:handler:Error", error, "ERROR");
    return prepareBatchFailureObj(sqsEventRecords);
  }
};

/**
 * get table list and initial primary key and sort key name
 * @param {*} tableName
 * @param {*} dynamoData
 * @returns
 */
function getTablesAndPrimaryKey(tableName, dynamoData) {
  try {
    const tableList = {
      [SHIPMENT_HEADER_TABLE]: {
        PK: "PK_OrderNo",
        SK: "",
        sortName: "shipmentHeader",
        type: "PRIMARY_KEY",
      },
      // [APAR_FAILURE_TABLE]: {
      //   PK: "FK_OrderNo",
      //   SK: "FK_SeqNo",
      //   sortName: "aparFailure",
      //   type: "PRIMARY_KEY",
      // },
      [CONSIGNEE_TABLE]: {
        PK: "FK_ConOrderNo",
        SK: "",
        sortName: "consignee",
        type: "PRIMARY_KEY",
      },
      [REFERENCES_TABLE]: {
        PK: "PK_ReferenceNo",
        SK: "",
        sortName: "references",
        indexKeyColumnName: "FK_OrderNo",
        indexKeyName: REFERENCES_INDEX_KEY_NAME,
        type: "INDEX",
      },
      // [SHIPMENT_APAR_TABLE]: {
      //   PK: "FK_OrderNo",
      //   SK: "SeqNo",
      //   sortName: "shipmentApar",
      //   type: "PRIMARY_KEY",
      // },

      [SHIPMENT_MILESTONE_TABLE]: {
        PK: "FK_OrderNo",
        SK: "FK_OrderStatusId",
        sortName: "shipmentMilestone",
        type: "PRIMARY_KEY",
      },
      [SHIPPER_TABLE]: {
        PK: "FK_ShipOrderNo",
        SK: "",
        sortName: "shipper",
        type: "PRIMARY_KEY",
      },
    };
    const data = tableList[tableName];
    const primaryKeyValue =
      data.type === "INDEX"
        ? dynamoData.NewImage[data.indexKeyColumnName].S
        : dynamoData.Keys[data.PK].S;

    return { tableList, primaryKeyValue };
  } catch (error) {
    updateLog(
      "toyotaSqsToDynamoDB:getTablesAndPrimaryKey:error:unable to select table",
      error,
      "ERROR"
    );
    updateLog(
      "toyotaSqsToDynamoDB:getTablesAndPrimaryKey:tableName",
      tableName,
      "ERROR"
    );
    throw error;
  }
}

/**
 * fetch data from the tables
 * @param {*} tableList
 * @param {*} primaryKeyValue
 * @returns
 */
async function fetchDataFromTables(tableList, primaryKeyValue) {
  try {
    const data = await Promise.all(
      Object.keys(tableList).map(async (e) => {
        const tableName = e;
        const ele = tableList[tableName];
        let data = [];

        if (ele.type === "INDEX") {
          data = await queryWithIndex(tableName, ele.indexKeyName, {
            [ele.indexKeyColumnName]: primaryKeyValue,
          });
        } else {
          data = await queryWithPartitionKey(tableName, {
            [ele.PK]: primaryKeyValue,
          });
        }

        return { [ele.sortName]: data.Items };
      })
    );
    const newObj = {};
    data.map((e) => {
      const objKey = Object.keys(e)[0];
      newObj[objKey] = e[objKey];
    });
    return newObj;
  } catch (error) {
    updateLog("toyotaSqsToDynamoDB:fetchDataFromTables:Error", error, "ERROR");
  }
}

/**
 * prepare toyota payload
 * @param {*} dataSet
 * @returns
 */
async function mapToyotaData(dataSet, eventDesc, dynamoData) {
  // shipmentHeader,consignee,shipper always have one value

  const hasMilestone = dynamoData.dynamoTableName.includes("milestone");
  console.log("hasMilestone", hasMilestone);

  const shipmentHeader =
    dataSet.shipmentHeader.length > 0 ? dataSet.shipmentHeader[0] : {};
  const consignee = dataSet.consignee.length > 0 ? dataSet.consignee[0] : {};
  const shipper = dataSet.shipper.length > 0 ? dataSet.shipper[0] : {};

  // const aparFailure = getLatestObjByTimeStamp(dataSet.aparFailure); not being used - uncomment later when needed

  const shipmentMilestone = hasMilestone
    ? getMilestoneDataObj(dataSet.shipmentMilestone, dynamoData)
    : getLatestObjByTimeStamp(dataSet.shipmentMilestone);

  // const shipmentMilestone = getLatestObjByTimeStamp(dataSet.shipmentMilestone)

  // const shipmentMilestone = getMilestoneDataObj(
  //   dataSet.shipmentMilestone,
  //   dynamoData
  // );

  const referencesTRL = getLatestObjByTimeStamp(
    dataSet.references.filter((e) => e.FK_RefTypeId == "TRL")
  );
  const referencesLOA = getLatestObjByTimeStamp(
    dataSet.references.filter(
      (e) => e.FK_RefTypeId == "LOA" && e.CustomerType == "B"
    )
  );

  const etaTime =
    shipmentHeader?.ETADateTime &&
    shipmentHeader.ETADateTime.length > 0 &&
    shipmentHeader.ETADateTime != "NULL"
      ? shipmentHeader.ETADateTime
      : false;

  const etaTimezone =
    shipmentHeader?.ETADateTimeZone &&
    shipmentHeader.ETADateTimeZone.length > 0 &&
    shipmentHeader.ETADateTimeZone != "NULL"
      ? shipmentHeader.ETADateTimeZone
      : "CST";
  // return {};
  // const reasonCodeDetails = getToyotaResonCodeDetails(aparFailure?.FDCode); not being used - uncomment later when needed

  const eventtimestamp = await getUTCTime(
    shipmentMilestone?.EventDateTime,
    shipmentMilestone?.EventTimeZone
  );

  const appointmentStartTime = await addUtcOffsetStartTime(
    eventDesc,
    shipmentHeader
  );

  let appointmentEndTimeValue = await addUtcOffsetEndTime(
    eventDesc,
    shipmentHeader
  );

  const toyotaPayload = {
    loadId: shipmentHeader.PK_OrderNo,
    scac: "OMNG", //hardcode
    carrierOrderNo: referencesLOA?.ReferenceNo ?? "", //{required field to send to toyota} tbl_references.FK_RefTypeId == "LOA" && tbl_references.CustomerType == "B"
    containerNo: referencesTRL?.ReferenceNo ?? "", //  tbl_references.FK_RefTypeId == "TRL"
    billOfLading: shipmentHeader.Housebill,

    originFacility: "", // TODO check with kiran
    originAddress: shipper.ShipAddress1 ?? "",
    originCity: shipper.ShipCity ?? "",
    originState: shipper.FK_ShipState ?? "",
    originZip: shipper.ShipZip ?? "",

    destinationFacility: "PHOENIX PDC",
    destinationAddress: consignee?.ConAddress1 ?? "",
    destinationCity: consignee?.ConCity ?? "",
    destinationState: consignee?.FK_ConState ?? "",
    destinationZip: consignee?.ConZip ?? "",
    event: eventDesc,

    eventtimestamp: eventtimestamp ?? "",
    timeZone: shipmentMilestone?.EventTimeZone ?? "",

    eta: etaTime ? await getUTCTime(etaTime, etaTimezone) : "",
    appointmentStartTime: appointmentStartTime ?? "",
    appointmentEndTime: appointmentEndTimeValue ?? "", //2023-03-22 00:00:00.000

    // reasoncode: reasonCodeDetails?.reasonCode ?? "", //not being used - uncomment later when needed
    // reasondescription: reasonCodeDetails?.reasonDescription ?? "", //not being used - uncomment later when needed

    reasoncode: "NS", //hardocde
    reasondescription: "Normal Status", //hardcode

    gpslat: "0",
    gpslong: "0",
    transportationMode: "OTR", //hardcode
    // sequenceNumber: shipmentHeader.Housebill ?? "", not required for now - commenting for later use

    InsertedTimeStamp: moment
      .tz("America/Chicago")
      .format("YYYY:MM:DD HH:mm:ss")
      .toString(),
  };

  return toyotaPayload;
}

/**
 * 1. if there is a event from omni-wt-rt-shipment-milestone-<env> table,
 *    based on the FK_OrderStatusId we need to map the WT event to the Toyota event milestone as per the sheet.
 *
 * 2. for example, if we had recieved an event with FK_OrderNo : "211860" and FK_OrderStatusId = 'TTC',
 *    we need to map it to 'Completed Loading' and send it to Toyota API.
 *
 * 3. For the events 'TTC, 'AAD', 'DEL' from WT the mapping to toyota is straight forward.
 *
 * 4. If the event from WT is 'COB'
 *    we need to send to events to toyota 'Depart Pickup Location' and 'In transit' seperately.
 *
 * 5. For a event that comes from omni-wt-rt-shipment-header-<env> table,
 *    if it contains tbl_ShipmentHeader.readydatetime , we send 'Pick Up Appointment' to toyota and
 *    if it contains tbl_ShipmentHeader.etadatetime we send 'Delivery Appointment'.
 *
 * **Note if tbl_ShipmentHeader.readydatetime or tbl_ShipmentHeader.etadatetime contains date time value
 *    that starts with '1900-01-01', this should be ignored and not sent to Toyota
 */
function getEventdesc(shipmentHeader, shipmentMilestone, eventTable) {
  console.log(
    "shipmentMilestone?.FK_OrderStatusId",
    shipmentMilestone?.FK_OrderStatusId
  );

  console.log(
    eventTable === SHIPMENT_MILESTONE_TABLE,
    eventTable,
    SHIPMENT_MILESTONE_TABLE
  );
  const dataMap = {
    TTC: ["Completed Loading"],
    AAD: ["Arrive Delivery Location"],
    DEL: ["Completed Unloading"],
    COB: ["In Transit"],
    // APP: ["Pick Up Appointment"],
    PUP: ["Depart Pickup Location"],
    // APD: ["Delivery Appointment"],
  };
  if (eventTable === SHIPMENT_MILESTONE_TABLE) {
    /**
     * change evant code to desc based on shipmentMilestone
     */
    return shipmentMilestone?.FK_OrderStatusId &&
      shipmentMilestone.FK_OrderStatusId.length > 0
      ? dataMap?.[shipmentMilestone.FK_OrderStatusId] ?? [
          shipmentMilestone.FK_OrderStatusId,
        ]
      : [""];
  } else if (eventTable === SHIPMENT_HEADER_TABLE) {
    /**
     * change evant code to desc based on shipmentHeader
     */
    let event = "";
    if (shipmentHeader.ReadyDateTime != "") {
      event = ["Pick Up Appointment"];
    }
    // if (shipmentHeader.ETADateTime != "") {
    //   event = ["Delivery Appointment"];
    // }
    if (shipmentHeader.ScheduledDateTime != "") {
      event = ["Delivery Appointment"];
    }
    return event;
  }
}

/**
 * if we got multiple records from one table then we are taking the latest one.
 * @param {*} data
 * @returns
 */
function getLatestObjByTimeStamp(data) {
  if (data.length > 1) {
    return data.sort((a, b) => {
      let atime = a.InsertedTimeStamp.split(" ");
      atime = atime[0].split(":").join("-") + " " + atime[1];

      let btime = b.InsertedTimeStamp.split(" ");
      btime = btime[0].split(":").join("-") + " " + btime[1];

      return new Date(btime) - new Date(atime);
    })[0];
  } else if (data.length === 1) {
    return data[0];
  } else {
    return {};
  }
}

/**
 * checking payload difference
 * @param {*} dataList
 * @param {*} obj
 * @returns
 */
function getDiff(dataList, obj) {
  console.log("dataList", dataList);
  console.log("obj", obj);

  let latestObj = Object.assign(
    {},
    dataList.sort((a, b) => b.SeqNo - a.SeqNo)[0]
  );

  //latest object ta nichis jeta last add hoeyche

  console.log("latestObj===>", latestObj);

  return {
    latestObj,
    isDiff: latestObj.payload === JSON.stringify(obj),
  };
}

function sortObjKeys(mainObj) {
  return Object.keys(mainObj)
    .sort()
    .reduce((obj, key) => {
      obj[key] = mainObj[key];
      return obj;
    }, {});
}

async function addUtcOffsetStartTime(event, shipmentData) {
  let offSetTime = "";
  if (event == "Delivery Appointment") {
    //APD
    offSetTime = await getUTCTime(
      shipmentData.ScheduledDateTime,
      shipmentData.ScheduledDateTimeZone ?? "CST"
    );
  } else if (event == "Pick Up Appointment") {
    //APP
    offSetTime = await getUTCTime(
      shipmentData.ReadyDateTime,
      shipmentData.ReadyDateTimeZone ?? "CST"
    );
  } else {
    offSetTime = "";
  }
  return offSetTime;
}

async function addUtcOffsetEndTime(event, shipmentData) {
  let appointmentEndTimeValue = timeSwap(
    shipmentData.ScheduledDateTime,
    shipmentData.ScheduledDateTimeRange
  );

  let offSetTime = "";
  if (event == "Delivery Appointment") {
    //APD
    offSetTime = await getUTCTime(
      appointmentEndTimeValue,
      shipmentData.ScheduledDateTimeZone ?? "CST"
    );
  } else if (event == "Pick Up Appointment") {
    //APP
    offSetTime = await getUTCTime(
      shipmentData.ReadyDateTimeRange,
      shipmentData.ReadyDateTimeZone ?? "CST"
    );
  } else {
    offSetTime = "";
  }
  return offSetTime;
}

function getMilestoneDataObj(mileStonedata, dynamoData) {
  let milestoneDataObj = {};

  console.log("mileStonedata", mileStonedata);
  console.log("dynamoData", dynamoData.dynamoTableName);

  const hasMilestone = dynamoData.dynamoTableName.includes("milestone");
  const hasHeader = dynamoData.dynamoTableName.includes("header");

  if (hasMilestone) {
    console.log(hasMilestone);
    if (mileStonedata.length > 0) {
      milestoneDataObj = mileStonedata.find(
        (item) => item.FK_OrderStatusId == dynamoData.Keys.FK_OrderStatusId.S
      );
    }

    console.log("milestoneDataObj===>", milestoneDataObj);

    return milestoneDataObj;
  } else {
    return milestoneDataObj;
  }
}

function timeSwap(startTime, endTime) {
  let timeS = startTime;
  timeS = timeS.slice(-12);

  let timeE = endTime;
  timeE = timeE.slice(-12);

  if (timeE == "00:00:00.000") {
    let newString = endTime.replace("00:00:00.000", timeS);
    return newString;
  } else {
    return endTime;
  }
}
