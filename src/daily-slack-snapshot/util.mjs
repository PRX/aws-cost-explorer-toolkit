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
