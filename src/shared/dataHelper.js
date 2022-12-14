function prepareBatchFailureObj(data) {
  const batchItemFailures =
    data.length > 0
      ? data.map((e) => ({
          itemIdentifier: e.messageId,
        }))
      : [];
  console.log("batchItemFailures", batchItemFailures);
  return { batchItemFailures };
}

module.exports = { prepareBatchFailureObj };
