import moment from "moment-timezone";

/**
 * Checks whether a date is today
 * @param date date to check
 */
export const isToday = (date: Date) => {
  const today = moment().tz("America/New_York").toDate();
  return (
    date.getDate() == today.getDate() &&
    date.getMonth() == today.getMonth() &&
    date.getFullYear() == today.getFullYear()
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
  const runDate = moment().tz("America/New_York").toDate();
  console.log(
    `${
      runDate.getMonth() + 1
    }/${runDate.getDate()}/${runDate.getFullYear()} ${runDate.getHours()}:${runDate.getMinutes()} EST: ${logData}`
  );
};
