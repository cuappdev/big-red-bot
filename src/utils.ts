/**
 * @param date date to compute age of
 * @return age of a date in days
 */
export const computeDateAgeDays = (date: Date) => {
  const timeDiff = Math.abs(new Date().getTime() - date.getTime());
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};
