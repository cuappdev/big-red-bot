import moment from "moment-timezone";
import { getStartOfToday, isToday } from "../utils";
import { initSheet } from "./formTracker";
import { Form, FormModel } from "./models";

const ingestForms = async () => {
  const formTracker = await initSheet();
  const formInfoSheet =
    formTracker.sheetsByTitle[process.env.FORM_INFO_SHEET_NAME!];

  await formInfoSheet.loadHeaderRow();
  const rows = await formInfoSheet.getRows();

  for (const row of rows) {
    const form = await FormModel.findOne({ title: row.get("Name") });
    if (!form) {
      const newForm = new FormModel({
        title: row.get("Name"),
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

  for (const form of await FormModel.find().gte("dueDate", getStartOfToday())) {
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
