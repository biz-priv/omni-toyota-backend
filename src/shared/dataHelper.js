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

/**
 * creates delay of {sec}
 * @param {*} sec
 * @returns
 */
function setDelay(sec) {
  console.log("delay started");
  return new Promise(async (resolve, reject) => {
    setTimeout(() => {
      console.log("delay end");
      resolve(true);
    }, sec * 1000);
  });
}
module.exports = { prepareBatchFailureObj, setDelay };
