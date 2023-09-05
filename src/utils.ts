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
