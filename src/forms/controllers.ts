import moment from "moment-timezone";
import { SEMESTER } from "../constants";
import {
  dateToESTString,
  getStartOfToday,
  isToday,
  logWithTime,
} from "../utils";
import { initSheet } from "./formTracker";
import { Form, FormModel } from "./models";

const ingestForms = async () => {
  const formTracker = await initSheet();
  const formInfoSheet =
    formTracker.sheetsByTitle[process.env.FORM_INFO_SHEET_NAME!];

  await formInfoSheet.loadHeaderRow();
  const rows = await formInfoSheet.getRows();

  for (const row of rows) {
    const formTitle = `${row.get("Name")} ${SEMESTER}`;
    const form = await FormModel.findOne({
      title: formTitle,
    });
    if (!form) {
      const newForm = new FormModel({
        title: formTitle,
        ingestedDate: moment().tz("America/New_York").toDate(),
        dueDate: moment
          .tz(row.get("Due Date"), "MM/DD/YYYY", "America/New_York")
          .toDate(),
        formURL: row.get("Form URL"),
      });
      await newForm.save();
    }
  }
};

/**
 * Returns a map of form title member emails who have not completed the form
 */
const getPendingMembers = async () => {
  let pendingMembersMap = new Map<Form, string[]>();
  const formTracker = await initSheet();
  const trackerSheet =
    formTracker.sheetsByTitle[process.env.TRACKER_SHEET_NAME!];
  const rows = await trackerSheet.getRows();

  const upcomingForms = await FormModel.find().gte(
    "dueDate",
    getStartOfToday()
  );

  logWithTime(
    `Upcoming Forms: ${upcomingForms.map(
      (upcomingForm) =>
        `${upcomingForm.title} is due ${dateToESTString(upcomingForm.dueDate)}`
    )}`
  );

  for (const form of upcomingForms) {
    let pendingMembers = [];
    for (const row of rows) {
      if (row.get(form.title) == "❌" && isToday(form.dueDate)) {
        pendingMembers.push(row.get("All Members"));
      }
    }

    pendingMembersMap.set(form, pendingMembers);
  }

  return pendingMembersMap;
};

export { getPendingMembers, ingestForms };
