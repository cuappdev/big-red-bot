import moment from "moment-timezone";

/**
 * Checks whether a date is today
 * @param date date to check
 */
export const isToday = (date: Date) => {
  const parseDate = moment.utc(date).tz("America/New_York");
  const today = moment().tz("America/New_York");
  return (
    parseDate.date() == today.date() &&
    parseDate.month() == today.month() &&
    parseDate.year() == today.year()
  );
};

/**
 * Returns the start of the day (12am EST today) in UTC time
 */
export const getStartOfToday = () =>
  moment().tz("America/New_York").startOf("day").toDate();

/**
 * A console.log wrapper which logs the current EST time to stdout
 * @param logData data to log
 */
export const logWithTime = (logData: string) => {
  console.log(`${dateToESTString(new Date())}: ${logData}`);
};

/**
 * @param date Datetime object to convert to EST time string
 * @returns An EST string representation of the provide Datetime object
 */
export const dateToESTString = (date: Date) => {
  const momentDate = moment(date).tz("America/New_York");
  return `${
    momentDate.month() + 1
  }/${momentDate.date()}/${momentDate.year()} ${momentDate.hour()}:${momentDate.minute()} EST`;
};
