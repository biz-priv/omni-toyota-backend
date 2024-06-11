/*
* File: src\shared\toyotaMapping.js
* Project: Omni-toyota-backend
* Author: Bizcloud Experts
* Date: 2022-12-05
* Confidential and Proprietary
*/
function getToyotaResonCodeDetails(FDCode) {
  try {
    return toyotaResonCodeMapping[toyotaMappingData[FDCode].toyotaCode];
  } catch (e) {
    console.log("e:toyotaMapping", e);
    return {};
  }
}

const toyotaResonCodeMapping = {
  NS: { reasonCode: "NS", reasonDescription: "Normal Status" },
  TR: { reasonCode: "TR", reasonDescription: "Toyota's Request" },
  CD: {
    reasonCode: "CD",
    reasonDescription:
      "Confirmed appointment time was different from the scheduled time",
  },
  DE: { reasonCode: "DE", reasonDescription: "Document error" },
  HE: { reasonCode: "HE", reasonDescription: "Human error" },
  TC: {
    reasonCode: "TC",
    reasonDescription: "Trailer/truck condition related issue",
  },
  RC: { reasonCode: "RC", reasonDescription: "Rail related condition" },
  DC: { reasonCode: "DC", reasonDescription: "Driver related condition" },
  AC: {
    reasonCode: "AC",
    reasonDescription: "Accident (trailer/truck/container involved or stack)",
  },
  BS: { reasonCode: "BS", reasonDescription: "Broken seal" },
  MC: { reasonCode: "MC", reasonDescription: "Mechanical related condition" },
  LD: { reasonCode: "LD", reasonDescription: "Late departure" },
  WC: { reasonCode: "WC", reasonDescription: "Weather related condition" },
  PC: { reasonCode: "PC", reasonDescription: "Planning related condition" },
  DL: { reasonCode: "DL", reasonDescription: "Delayed for some reason" },
  BO: { reasonCode: "BO", reasonDescription: "Blowout" },
  CP: { reasonCode: "CP", reasonDescription: "Power or dray capacity" },
  SC: { reasonCode: "SC", reasonDescription: "System related condition" },
  OT: { reasonCode: "OT", reasonDescription: "Other" },
  HC: { reasonCode: "HC", reasonDescription: "Holiday Closed" },
  RD: { reasonCode: "RD", reasonDescription: "Road condition related issue" },
  CC: { reasonCode: "CC", reasonDescription: "Customs related issue" },
};

const toyotaMappingData = {
  CID: {
    PK_FailureDamageCodeWT: "CID",
    DescriptionWT: "CUSTOMS IMPORT DELAY",
    toyotaCode: "CC",
  },
  CEH: {
    PK_FailureDamageCodeWT: "CEH",
    DescriptionWT: "CUSTOMS EXPORT DELAY",
    toyotaCode: "CC",
  },
  DEL: {
    PK_FailureDamageCodeWT: "DEL",
    DescriptionWT: "SHIPMENT DELAYED",
    toyotaCode: "DL",
  },
  ADE: {
    PK_FailureDamageCodeWT: "ADE",
    DescriptionWT: "AGENT DELIVERED EARLY",
    toyotaCode: "DR",
  },
  CAR: {
    PK_FailureDamageCodeWT: "CAR",
    DescriptionWT: "CARRIER ERROR",
    toyotaCode: "DR",
  },
  CHO: {
    PK_FailureDamageCodeWT: "CHO",
    DescriptionWT: "CLOSED DUE TO HOLIDAY",
    toyotaCode: "HC",
  },
  REALA: {
    PK_FailureDamageCodeWT: "REALA",
    DescriptionWT: "FAILING TO RE-ALERT AGENT W/ NEW DEL APPT INFO",
    toyotaCode: "HE",
  },
  REALR: {
    PK_FailureDamageCodeWT: "REALR",
    DescriptionWT: "FAILING TO RE-ALERT AGENT WITH NEW ROUTING",
    toyotaCode: "HE",
  },
  FTUSP: {
    PK_FailureDamageCodeWT: "FTUSP",
    DescriptionWT: "FAILING TO UPDATE THE SHIPMENT PROPERLY",
    toyotaCode: "HE",
  },
  NTDT: {
    PK_FailureDamageCodeWT: "NTDT",
    DescriptionWT: "FAILURE TO SET NTDT - NOT ON TRACKING BOARD",
    toyotaCode: "HE",
  },
  OMNII: {
    PK_FailureDamageCodeWT: "OMNII",
    DescriptionWT: "OMNI PROVIDED INCORRECT INFORMATION",
    toyotaCode: "HE",
  },
  BADDA: {
    PK_FailureDamageCodeWT: "BADDA",
    DescriptionWT: "BAD DATA ENTRY",
    toyotaCode: "HE",
  },
  OMNIF: {
    PK_FailureDamageCodeWT: "OMNIF",
    DescriptionWT: "OMNI FAILED TO PERFORM AN ACTIVITY",
    toyotaCode: "HE",
  },
  LPU: {
    PK_FailureDamageCodeWT: "LPU",
    DescriptionWT: "LATE PICK UP",
    toyotaCode: "LD",
  },
  HUB: {
    PK_FailureDamageCodeWT: "HUB",
    DescriptionWT: "DELAYED AT HUB",
    toyotaCode: "LD",
  },
  MI: {
    PK_FailureDamageCodeWT: "MI",
    DescriptionWT: "MECHANICAL ISSUES",
    toyotaCode: "MC",
  },
  CON: {
    PK_FailureDamageCodeWT: "CON",
    DescriptionWT: "CONSIGNEE ERROR",
    toyotaCode: "OT",
  },
  COS: {
    PK_FailureDamageCodeWT: "COS",
    DescriptionWT: "COSMETIC DAMAGE",
    toyotaCode: "OT",
  },
  CUS: {
    PK_FailureDamageCodeWT: "CUS",
    DescriptionWT: "CUSTOMER ERROR",
    toyotaCode: "OT",
  },
  REFU: {
    PK_FailureDamageCodeWT: "REFU",
    DescriptionWT: "CUSTOMER REFUSED DELIVERY",
    toyotaCode: "OT",
  },
  CRD: {
    PK_FailureDamageCodeWT: "CRD",
    DescriptionWT: "CUSTOMER RESCHEDULED DELIVERY",
    toyotaCode: "OT",
  },
  DAM: {
    PK_FailureDamageCodeWT: "DAM",
    DescriptionWT: "DAMAGED FREIGHT",
    toyotaCode: "OT",
  },
  SHORT: {
    PK_FailureDamageCodeWT: "SHORT",
    DescriptionWT: "DELIVERED SHORT",
    toyotaCode: "OT",
  },
  RAD: {
    PK_FailureDamageCodeWT: "RAD",
    DescriptionWT: "DELIVERY DATE REQUESTED AFTER DUE DATE",
    toyotaCode: "OT",
  },
  DLE: {
    PK_FailureDamageCodeWT: "DLE",
    DescriptionWT: "DELIVERY EXCEPTION",
    toyotaCode: "OT",
  },
  FAOUT: {
    PK_FailureDamageCodeWT: "FAOUT",
    DescriptionWT: "FORWARD AIR SYSTEM OUTAGE",
    toyotaCode: "OT",
  },
  MISS: {
    PK_FailureDamageCodeWT: "MISS",
    DescriptionWT: "FREIGHT MISSING",
    toyotaCode: "OT",
  },
  THEFT: {
    PK_FailureDamageCodeWT: "THEFT",
    DescriptionWT: "FREIGHT STOLEN",
    toyotaCode: "OT",
  },
  PACK: {
    PK_FailureDamageCodeWT: "PACK",
    DescriptionWT: "IMPROPER PACKAGING",
    toyotaCode: "OT",
  },
  ICC: {
    PK_FailureDamageCodeWT: "ICC",
    DescriptionWT: "INACCURATE CONSIGNEE CONTACT INFO",
    toyotaCode: "OT",
  },
  TFIDI: {
    PK_FailureDamageCodeWT: "TFIDI",
    DescriptionWT: "INACURATE DELIVERY INFORMATION",
    toyotaCode: "OT",
  },
  INS: {
    PK_FailureDamageCodeWT: "INS",
    DescriptionWT: "INSTALLATION ISSUE",
    toyotaCode: "OT",
  },
  LATEB: {
    PK_FailureDamageCodeWT: "LATEB",
    DescriptionWT: "LATE BOOKING RCVD AFTER CUTOFF",
    toyotaCode: "OT",
  },
  LAD: {
    PK_FailureDamageCodeWT: "LAD",
    DescriptionWT: "LIMITED ACCESS DELIVERY",
    toyotaCode: "OT",
  },
  APP: {
    PK_FailureDamageCodeWT: "APP",
    DescriptionWT: "MISSED APPOINTMENT",
    toyotaCode: "OT",
  },
  MISCU: {
    PK_FailureDamageCodeWT: "MISCU",
    DescriptionWT: "MISSED CUTOFF",
    toyotaCode: "OT",
  },
  MTT: {
    PK_FailureDamageCodeWT: "MTT",
    DescriptionWT: "MISSED TRANSFER TRUCK",
    toyotaCode: "OT",
  },
  TFMIS: {
    PK_FailureDamageCodeWT: "TFMIS",
    DescriptionWT: "MISSING DELIVERY INFORMATION",
    toyotaCode: "OT",
  },
  OLHNS: {
    PK_FailureDamageCodeWT: "OLHNS",
    DescriptionWT: "OMNI LH - CAPACITY",
    toyotaCode: "OT",
  },
  OLHNC: {
    PK_FailureDamageCodeWT: "OLHNC",
    DescriptionWT: "OMNI LH - CUTOFF",
    toyotaCode: "OT",
  },
  OLHNF: {
    PK_FailureDamageCodeWT: "OLHNF",
    DescriptionWT: "OMNI LH - FA COMPLETE",
    toyotaCode: "OT",
  },
  OLHNT: {
    PK_FailureDamageCodeWT: "OLHNT",
    DescriptionWT: "OMNI LH - TRANSIT VS SERVICE",
    toyotaCode: "OT",
  },
  PUE: {
    PK_FailureDamageCodeWT: "PUE",
    DescriptionWT: "PICK UP EXCEPTION",
    toyotaCode: "OT",
  },
  CAN: {
    PK_FailureDamageCodeWT: "CAN",
    DescriptionWT: "SHIPMENT CANCELED",
    toyotaCode: "OT",
  },
  SHI: {
    PK_FailureDamageCodeWT: "SHI",
    DescriptionWT: "SHIPPER ERROR",
    toyotaCode: "OT",
  },
  SSSF: {
    PK_FailureDamageCodeWT: "SSSF",
    DescriptionWT: "SPLIT SHIPMENT SERVICE FAILURE",
    toyotaCode: "OT",
  },
  URC: {
    PK_FailureDamageCodeWT: "URC",
    DescriptionWT: "UNABLE TO REACH CONSIGNEE",
    toyotaCode: "OT",
  },
  LOST: {
    PK_FailureDamageCodeWT: "LOST",
    DescriptionWT: "VENDOR LOST FREIGHT",
    toyotaCode: "OT",
  },
  PWD: {
    PK_FailureDamageCodeWT: "PWD",
    DescriptionWT: "WEIGHT OR DIMENSIONAL VARIANCE",
    toyotaCode: "OT",
  },
  WADD: {
    PK_FailureDamageCodeWT: "WADD",
    DescriptionWT: "WRONG CUSTOMER ADDRESS",
    toyotaCode: "OT",
  },
  MISC: {
    PK_FailureDamageCodeWT: "MISC",
    DescriptionWT: "MISCELLANEOUS",
    toyotaCode: "OT",
  },
  INCOM: {
    PK_FailureDamageCodeWT: "INCOM",
    DescriptionWT: "INCOMPLETE ROUTING",
    toyotaCode: "PC",
  },
  IRRSL: {
    PK_FailureDamageCodeWT: "IRRSL",
    DescriptionWT: "INPROPER ROUTING FOR REQUESTED SERVICE LEVEL",
    toyotaCode: "PC",
  },
  INMIL: {
    PK_FailureDamageCodeWT: "INMIL",
    DescriptionWT: "FAILURE TO UPDATE SHIPMENT TO CORRECT MILESTONE",
    toyotaCode: "SC",
  },
  SLC: {
    PK_FailureDamageCodeWT: "SLC",
    DescriptionWT: "SERVICE LEVEL CHANGE REQUESTED",
    toyotaCode: "TR",
  },
  CUST: {
    PK_FailureDamageCodeWT: "CUST",
    DescriptionWT: "CUSTOMER CAUSED EXCEPTION",
    toyotaCode: "TR",
  },
  SOS: {
    PK_FailureDamageCodeWT: "SOS",
    DescriptionWT: "WEATHER DELAY",
    toyotaCode: "WC",
  },
};

module.exports = { getToyotaResonCodeDetails };
