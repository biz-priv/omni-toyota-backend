const moment = require("moment-timezone");
const { prepareBatchFailureObj } = require("./shared/dataHelper");
const {
  getItem,
  queryWithPartitionKey,
  queryWithIndex,
} = require("./shared/dynamo");
const { getToyotaResonCodeDetails } = require("./shared/toyotaMapping");

const APAR_FAILURE_TABLE = process.env.APAR_FAILURE_TABLE;
const CONSIGNEE_TABLE = process.env.CONSIGNEE_TABLE;
const REFERENCES_TABLE = process.env.REFERENCES_TABLE;
const SHIPMENT_APAR_TABLE = process.env.SHIPMENT_APAR_TABLE;
const SHIPMENT_HEADER_TABLE = process.env.SHIPMENT_HEADER_TABLE;
const SHIPMENT_MILESTONE_TABLE = process.env.SHIPMENT_MILESTONE_TABLE;
const SHIPPER_TABLE = process.env.SHIPPER_TABLE;

module.exports.handler = async (event, context, callback) => {
  let sqsEventRecords = [];
  try {
    console.log("event", JSON.stringify(event));
    // sqsEventRecords = event.Records;
    sqsEventRecords = [
      {
        body: {
          ApproximateCreationDateTime: 1669855115,
          Keys: { PK_ReferenceNo: { S: "12229973" } },
          NewImage: {
            FK_OrderNo: { S: "4519743" },
            InsertedTimeStamp: { S: "2022:11:30 18:38:35" },
            PK_ReferenceNo: { S: "12229973" },
            FK_RefTypeId: { S: "REF" },
            CustomerType: { S: "B" },
            ReferenceNo: { S: "DEF456" },
          },
          SequenceNumber: "43476800000000022460830226",
          SizeBytes: 142,
          StreamViewType: "NEW_AND_OLD_IMAGES",
          dynamoTableName: "omni-wt-rt-references-dev",
        },
      },
    ];
    const faildSqsItemList = [];

    for (let index = 0; index < sqsEventRecords.length; index++) {
      try {
        const sqsItem = sqsEventRecords[index];
        // dynamoData = JSON.parse(sqsItem.body);
        const dynamoData = sqsItem.body;
        console.log("dynamoData", dynamoData);

        //get the primary key
        const { tableList, PK, isForeign } = getTablesAndPrimaryKey(
          dynamoData.dynamoTableName
        );
        const primaryKeyValue = isForeign
          ? dynamoData.NewImage[PK].S
          : dynamoData.Keys[PK].S;
        console.log(PK, isForeign, primaryKeyValue);

        //check from shipment header if it toyota event
        const shipmentHeaderData = await getItem(SHIPMENT_HEADER_TABLE, {
          // [tableList[SHIPMENT_HEADER_TABLE].PK]: primaryKeyValue,
          [tableList[SHIPMENT_HEADER_TABLE].PK]: "4179211",
        });
        console.log("shipmentHeaderData", shipmentHeaderData);
        if (
          shipmentHeaderData &&
          shipmentHeaderData.Item &&
          shipmentHeaderData.Item.BillNo === "22531"
        ) {
          //get data from all the requied tables
          const dataSet = await fetchDataFromTables(tableList, primaryKeyValue);
          // console.log("dataSet", dataSet);
          const toyotaObj = mapToyotaData(dataSet);
          console.log("toyotaObj", toyotaObj);
          break;

          //prepare the payload

          //save to dynamo DB
        }
      } catch (error) {}
    }

    // const toyotaData = mapToyotaData();
    return prepareBatchFailureObj(faildSqsItemList);
  } catch (error) {
    console.error("Error", error);
    return prepareBatchFailureObj(sqsEventRecords);
  }
};

function getTablesAndPrimaryKey(tableName) {
  try {
    const tableList = {
      [SHIPMENT_HEADER_TABLE]: {
        PK: "PK_OrderNo",
        SK: "",
        sortName: "shipmentHeader",
      },
      [APAR_FAILURE_TABLE]: {
        PK: "FK_OrderNo",
        SK: "FK_SeqNo",
        sortName: "aparFailure",
        shForeignKey: "FK_OrderNo",
        isForeign: false,
      },
      [CONSIGNEE_TABLE]: {
        PK: "FK_ConOrderNo",
        SK: "",
        sortName: "consignee",
        shForeignKey: "FK_ConOrderNo",
        isForeign: false,
      },
      [REFERENCES_TABLE]: {
        PK: "PK_ReferenceNo",
        SK: "",
        sortName: "references",
        shForeignKey: "FK_OrderNo",
        isForeign: true,
      },
      [SHIPMENT_APAR_TABLE]: {
        PK: "FK_OrderNo",
        SK: "SeqNo",
        sortName: "shipmentApar",
        shForeignKey: "FK_OrderNo",
        isForeign: false,
      },

      [SHIPMENT_MILESTONE_TABLE]: {
        PK: "FK_OrderNo",
        SK: "FK_OrderStatusId",
        sortName: "shipmentMilestone",
        shForeignKey: "FK_OrderNo",
        isForeign: false,
      },
      [SHIPPER_TABLE]: {
        PK: "FK_ShipOrderNo",
        SK: "",
        sortName: "shipper",
        shForeignKey: "FK_ShipOrderNo",
        isForeign: false,
      },
    };

    const tableVal = tableList[tableName];
    let isForeign = false;
    let PK = tableVal.PK;

    if (tableVal.isForeign === true) {
      isForeign = true;
      PK = tableVal.shForeignKey;
    }

    return { tableList: tableList, PK, isForeign };
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

        if (ele.isForeign) {
          console.log(tableName, ele.shForeignKey);
          data = await queryWithIndex(
            tableName,
            "omni-wt-rt-ref-orderNo-index-dev", //need to check
            {
              [ele.shForeignKey]: primaryKeyValue,
            }
          );
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
  const shipmentApar =
    dataSet.shipmentApar.length > 0 ? dataSet.shipmentApar : {};

  const shipmentMilestone = getLatestObjByTimeStamp(dataSet.shipmentMilestone);

  const referencesTRL = getLatestObjByTimeStamp(
    dataSet.references.filter((e) => e.PK_ReferenceNo == "TRL")
  );
  const referencesLOA = getLatestObjByTimeStamp(
    dataSet.references.filter((e) => e.PK_ReferenceNo == "LOA")
  );

  const reasonCodeDetails = getToyotaResonCodeDetails(aparFailure?.FDCode);

  const toyotaPayload = {
    loadId: shipmentHeader.PK_OrderNo,
    scac: "OMNG", //hardcode
    carrierOrderNo: referencesLOA?.FK_RefTypeId ?? "", //must have some value
    containerNo: referencesTRL?.FK_RefTypeId ?? "",
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

    reasoncode: reasonCodeDetails?.reasonCode,
    reasondescription: reasonCodeDetails?.reasonDescription,

    gpslat: "40.7384",
    gpslong: "-112.0150",
    transportationMode: "OTR",
    sequenceNumber: "1234",

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
