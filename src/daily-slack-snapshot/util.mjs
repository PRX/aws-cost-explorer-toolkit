/**
 * Returns a string for the given date in the format that DateInterval expects
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-cost-explorer/Interface/DateInterval/
 * @param {Date} date
 * @returns {String}
 */
export function di(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Returns a number regardless of whether the input in missing, a number-like-
 * string, or a number. Does some rounding. Cost and Usage APIs tend to return
 * values as strings; this is meant to help deal with that.
 * @param {String | Number | undefined} val
 * @return {Number}
 */
export function num(val) {
  return +parseFloat(`${val || 0}`).toFixed(2);
}

/**
 * For a range like May 5, 2021 to May 8, 2021 returns
 * ["2021-05-05", "2021-05-06", "2021-05-07", "2021-05-08"]
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {String[]}
 */
export function getDateStringsForRange(rangeStart, rangeEnd) {
  const start = new Date(rangeStart);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(rangeEnd);
  end.setUTCHours(0, 0, 0, 0);

  if (start >= end) {
    throw new RangeError("startDate must be before endDate");
  }

  const dateStrings = [];
  const current = new Date(start);

  while (current < end) {
    dateStrings.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  dateStrings.push(end.toISOString().slice(0, 10));

  return dateStrings;
}
