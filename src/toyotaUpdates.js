const {
  sortCommonItemsToSingleRow,
  processData,
  prepareBatchFailureObj,
} = require("./shared/dataHelper");
const { getItem } = require("./shared/dynamo");
// const { getTableListFn } = require("./shared/tableHelper");

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
    sqsEventRecords = event.Records;
    const faildSqsItemList = [];

    for (let index = 0; index < sqsEventRecords.length; index++) {
      let sqsItem, dynamoData, primaryKeyValue, allTablelist;
      try {
        sqsItem = sqsEventRecords[index];
        dynamoData = JSON.parse(sqsItem.body);
        //get the primary key
        const { tableList, PK } = getTablesAndPrimaryKey(
          dynamoData.dynamoTableName
        );
        primaryKeyValue = dynamoData.Keys[PK].S;
        allTablelist = tableList;
      } catch (error) {
        console.log("error: no dynamoData found", error);
        continue;
      }
      //check from shipment header if it toyota event
      const shipmentHeaderData = await getItem(
        SHIPMENT_HEADER_TABLE,
        primaryKeyValue
      );
      if (shipmentHeaderData && shipmentHeaderData.BillNo === "22531") {
        //get data from all the requied tables
        for (let index = 0; index < allTablelist.length; index++) {
          const table = allTablelist[index];
        }
        const aparFailureData = getItem(APAR_FAILURE_TABLE, primaryKeyValue);
        const consigneeData = getItem(CONSIGNEE_TABLE, primaryKeyValue);
        const shipmentAparData = getItem(REFERENCES_TABLE, primaryKeyValue);
        const shipperData = getItem(SHIPMENT_MILESTONE_TABLE, primaryKeyValue);
        const shipmentDescData = getItem(SHIPPER_TABLE, primaryKeyValue);
        const shipmentMilestoneData = getItem(
          SHIPMENT_APAR_TABLE,
          primaryKeyValue
        );

        //prepare the payload

        //save to dynamo DB
      }
    }

    const toyotaData = mapToyotaData();
    return prepareBatchFailureObj(faildSqsItemList);
  } catch (error) {
    console.error("Error", error);
    return prepareBatchFailureObj(sqsEventRecords);
  }
};

function mapToyotaData(params) {
  //   const dd={
  //     "bill_of_lading": "tbl_shipmentHeader.housebill",
  //     "containerNo": "tbl_references.referenceno where fk_Reftype id = TRL",
  //     "carrierOrderNo": "tbl_references.referenceno where fk_Reftype id = LOA with join on tbl_shipmentHeader.Pk_orderNo=tbl_references.FK_OrderNo",
  //     "loadId": "tbl_shipmentHeader.Pk_orderNo",
  //     "scac": "OMNG", //harcode
  //     "originFacility": "from tbl shipper", //fkShip_order_No join with tbl_shipmentHeader.Pk_orderNo
  //     "originAddress": "from tbl shipper",
  //     "originCity": "from tbl shipper",
  //     "originState": "from tbl shipper",
  //     "originZip": "from tbl shipper",
  //     "destinationFacility": "from tbl consignee", //fk_ConOrderNo join with tbl_shipmentHeader.Pk_orderNo
  //     "destinationAddress": "from tbl consignee",
  //     "destinationCity": "from tbl consignee",
  //     "destinationState": "from tbl consignee",
  //     "destinationZip": "from tbl consignee",
  //     "gpslat": "40.7384", //TODO
  //     "gpslong": "-112.0150", //TODO
  //     "event": "Intransit - Tbl_shipmentmilestone.fk_orderstatusid Joined with tbl_shipmentheader on pk_orderno = fk_orderno",
  //     "eventtimestamp": "Tbl_shipmentmilestone.eventdatetime Joined with tbl_shipmentheader on pk_orderno = fk_orderno",
  //     "timeZone": "Tbl_shipmentmilestone.eventtimezone Joined with tbl_shipmentheader on pk_orderno = fk_orderno",
  //     "transportationMode": "IML", // TODO
  //     "sequenceNumber": "1234",
  //     "eta": "2020-02-28 -> tbl_shipmentHeader.etadatetime",
  //     "appointmentStartTime": "2020-02-25T19:54:44+02:00",tbl_shipmentHeader.ScheduleDateTime
  //     "appointmentEndTime": "2020-02-26T19:54:44+02:00",tbl_shipmentHeader.ScheduleDateTimeRange
  //     "reasoncode": "39 tbl_aparFailure.FK_CodeID -- check mapping in toyota document - have a mapping in code",
  //     "reasondescription": "Accident"
  //  }

  const toyotaPayload = [
    {
      carrierOrderNo: "AB12345", //must have some value
      scac: "HJBT", //must have some value
      loadId: "20201234567",
      billOfLading: "O898193",
      containerNo: "JBHU12345",
      originFacility: "NAPCC",
      originAddress: "1425 Toyota Way",
      originCity: "Ontario",
      originState: "CA",
      originZip: "91761",
      destinationFacility: "Portland PDC",
      destinationAddress: "6111 NE 87th Ave.",
      destinationCity: "Portland",
      destinationState: "OR",
      destinationZip: "97220",
      gpslat: "40.7384",
      gpslong: "-112.0150",
      event: "Intransit",
      eventtimestamp: "2020-02-26T19:54:44+02:00",
      timeZone: "PST",
      transportationMode: "OTR",
      sequenceNumber: "1234",
      eta: "2020-02-28",
      appointmentStartTime: "2020-02-25T19:54:44+02:00",
      appointmentEndTime: "2020-02-26T19:54:44+02:00",
      reasoncode: "39",
      reasondescription: "Accident",
    },
  ];

  return {};
}

const getTablesAndPrimaryKey = (tableName) => {
  try {
    const tableList = {
      [APAR_FAILURE_TABLE]: { PK: "FK_OrderNo", SK: "FK_SeqNo" },
      [CONSIGNEE_TABLE]: { PK: "FK_ConOrderNo", SK: "" },
      [REFERENCES_TABLE]: { PK: "PK_ReferenceNo", SK: "" },
      [SHIPMENT_APAR_TABLE]: { PK: "FK_OrderNo", SK: "SeqNo" },
      [SHIPMENT_HEADER_TABLE]: { PK: "PK_OrderNo", SK: "" },
      [SHIPMENT_MILESTONE_TABLE]: { PK: "FK_OrderNo", SK: "FK_OrderStatusId" },
      [SHIPPER_TABLE]: { PK: "FK_ShipOrderNo", SK: "" },
    };
    return { tableList: Object.keys(tableList), PK: tableList[tableName].PK };
  } catch (error) {
    console.info("error:unable to select table", error);
    console.info("tableName", tableName);
    throw error;
  }
};
