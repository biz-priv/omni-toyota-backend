const moment = require("moment-timezone");
const { prepareBatchFailureObj } = require("./shared/dataHelper");
const {
  getItem,
  queryWithPartitionKey,
  queryWithIndex,
  putItem,
  updateItem,
} = require("./shared/dynamo");
const { getToyotaResonCodeDetails } = require("./shared/toyotaMapping");

const APAR_FAILURE_TABLE = process.env.APAR_FAILURE_TABLE;
const CONSIGNEE_TABLE = process.env.CONSIGNEE_TABLE;
const REFERENCES_TABLE = process.env.REFERENCES_TABLE;
const SHIPMENT_APAR_TABLE = process.env.SHIPMENT_APAR_TABLE;
const SHIPMENT_HEADER_TABLE = process.env.SHIPMENT_HEADER_TABLE;
const SHIPMENT_MILESTONE_TABLE = process.env.SHIPMENT_MILESTONE_TABLE;
const SHIPPER_TABLE = process.env.SHIPPER_TABLE;
const REFERENCES_INDEX_KEY_NAME = process.env.REFERENCES_INDEX_KEY_NAME;
const TOYOTA_DDB = process.env.TOYOTA_DDB;

module.exports.handler = async (event, context, callback) => {
  let sqsEventRecords = [];
  try {
    console.log("event", JSON.stringify(event));
    sqsEventRecords = event.Records;
    const faildSqsItemList = [];

    for (let index = 0; index < sqsEventRecords.length; index++) {
      const sqsItem = sqsEventRecords[index];
      try {
        const dynamoData = JSON.parse(sqsItem.body);
        console.log("dynamoData", dynamoData);

        //get the primary key
        const { tableList, primaryKeyValue } = getTablesAndPrimaryKey(
          dynamoData.dynamoTableName,
          dynamoData
        );

        //check from shipment header if it is a toyota event
        const shipmentHeaderData = await getItem(SHIPMENT_HEADER_TABLE, {
          [tableList[SHIPMENT_HEADER_TABLE].PK]: primaryKeyValue,
        });
        console.log("shipmentHeaderData", shipmentHeaderData);

        if (
          shipmentHeaderData &&
          shipmentHeaderData.Item &&
          shipmentHeaderData.Item.BillNo === "22531"
        ) {
          //get data from all the requied tables
          const dataSet = await fetchDataFromTables(tableList, primaryKeyValue);

          //prepare the payload
          const toyotaObj = mapToyotaData(dataSet);
          console.log("toyotaObj", toyotaObj);

          const getToyotaData = await queryWithPartitionKey(TOYOTA_DDB, {
            loadId: toyotaObj.loadId,
          });
          let SeqNo = 1;
          if (getToyotaData.Items && getToyotaData.Items.length > 0) {
            const { latestObj, isDiff } = getDiff(
              getToyotaData.Items,
              toyotaObj
            );
            if (isDiff) {
              SeqNo += getToyotaData.Items.length;
              await putItem(TOYOTA_DDB, {
                ...toyotaObj,
                SeqNo: SeqNo.toString(),
              });
              //update all other records with
              if (
                latestObj.carrierOrderNo.length === 0 &&
                toyotaObj.carrierOrderNo.length > 0
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
                      carrierOrderNo: toyotaObj.carrierOrderNo,
                    }
                  );
                }
              }
            }
          } else {
            await putItem(TOYOTA_DDB, {
              ...toyotaObj,
              SeqNo: SeqNo.toString(),
            });
          }
        }
      } catch (error) {
        console.log("error", error);
        faildSqsItemList.push(sqsItem);
      }
    }
    return prepareBatchFailureObj(faildSqsItemList);
  } catch (error) {
    console.error("Error", error);
    return prepareBatchFailureObj(sqsEventRecords);
  }
};

function getTablesAndPrimaryKey(tableName, dynamoData) {
  try {
    const tableList = {
      [SHIPMENT_HEADER_TABLE]: {
        PK: "PK_OrderNo",
        SK: "",
        sortName: "shipmentHeader",
        type: "PRIMARY_KEY",
      },
      [APAR_FAILURE_TABLE]: {
        PK: "FK_OrderNo",
        SK: "FK_SeqNo",
        sortName: "aparFailure",
        type: "PRIMARY_KEY",
      },
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
      [SHIPMENT_APAR_TABLE]: {
        PK: "FK_OrderNo",
        SK: "SeqNo",
        sortName: "shipmentApar",
        type: "PRIMARY_KEY",
      },

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
    console.info("error:unable to select table", error);
    console.info("tableName", tableName);
    throw error;
  }
}

async function fetchDataFromTables(tableList, primaryKeyValue) {
  try {
    const data = await Promise.all(
      Object.keys(tableList).map(async (e) => {
        const tableName = e;
        const ele = tableList[tableName];
        let data = [];

        if (ele.type === "INDEX") {
          console.log(tableName, ele);
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
    console.log("data", data);
    const newObj = {};
    data.map((e) => {
      const objKey = Object.keys(e)[0];
      newObj[objKey] = e[objKey];
    });
    return newObj;
  } catch (error) {
    console.log("error:fetchDataFromTables", error);
  }
}

function mapToyotaData(dataSet) {
  // console.log("dataSet", dataSet);
  // shipmentHeader,consignee,shipper always have one value

  const shipmentHeader =
    dataSet.shipmentHeader.length > 0 ? dataSet.shipmentHeader[0] : {};
  const consignee = dataSet.consignee.length > 0 ? dataSet.consignee[0] : {};
  const shipper = dataSet.shipper.length > 0 ? dataSet.shipper[0] : {};

  const aparFailure = getLatestObjByTimeStamp(dataSet.aparFailure);

  const shipmentMilestone = getLatestObjByTimeStamp(dataSet.shipmentMilestone);

  const referencesTRL = getLatestObjByTimeStamp(
    dataSet.references.filter((e) => e.FK_RefTypeId == "TRL")
  );
  const referencesLOA = getLatestObjByTimeStamp(
    dataSet.references.filter(
      (e) => e.FK_RefTypeId == "LOA" && e.CustomerType == "B"
    )
  );

  const reasonCodeDetails = getToyotaResonCodeDetails(aparFailure?.FDCode);

  const toyotaPayload = {
    loadId: shipmentHeader.PK_OrderNo,
    scac: "OMNG", //hardcode
    carrierOrderNo: referencesLOA?.PK_ReferenceNo ?? "", //must have some value
    containerNo: referencesTRL?.PK_ReferenceNo ?? "",
    billOfLading: shipmentHeader.Housebill,

    originFacility: shipper.FK_ShipOrderNo ?? "",
    originAddress: shipper.ShipAddress1 ?? "",
    originCity: shipper.ShipCity ?? "",
    originState: shipper.FK_ShipState ?? "",
    originZip: shipper.ShipZip ?? "",

    destinationFacility: consignee?.FK_ConOrderNo ?? "",
    destinationAddress: consignee?.ConAddress1 ?? "",
    destinationCity: consignee?.ConCity ?? "",
    destinationState: consignee?.FK_ConState ?? "",
    destinationZip: consignee?.ConZip ?? "",

    event: shipmentMilestone?.FK_OrderStatusId ?? "",
    eventtimestamp: shipmentMilestone?.EventDateTime ?? "",
    timeZone: shipmentMilestone?.EventTimeZone ?? "",

    eta: shipmentHeader.ETADateTime,
    appointmentStartTime: shipmentHeader.ScheduledDateTime,
    appointmentEndTime: shipmentHeader.ScheduledDateTimeRange,

    reasoncode: reasonCodeDetails?.reasonCode ?? "",
    reasondescription: reasonCodeDetails?.reasonDescription ?? "",

    gpslat: "",
    gpslong: "",
    transportationMode: "",
    sequenceNumber: "",

    InsertedTimeStamp: moment
      .tz("America/Chicago")
      .format("YYYY:MM:DD HH:mm:ss")
      .toString(),
  };
  return toyotaPayload;
}

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

function getDiff(dataList, obj) {
  let neObj = Object.create(obj);
  let latestObj = Object.create(dataList.sort((a, b) => b.SeqNo - a.SeqNo)[0]);

  delete latestObj["SeqNo"];
  delete latestObj["InsertedTimeStamp"];
  delete neObj["InsertedTimeStamp"];

  return {
    latestObj,
    isDiff: !(
      JSON.stringify(sortObjKeys(latestObj)) ===
      JSON.stringify(sortObjKeys(neObj))
    ),
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
