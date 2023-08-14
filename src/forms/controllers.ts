import { REMIND_DAYS } from "../constants";
import { computeDateAgeDays } from "../utils";
import { initSheet } from "./formTracker";
import { FormModel } from "./models";

const ingestForms = async () => {
  const formTracker = await initSheet();
  const trackerSheet =
    formTracker.sheetsByTitle[process.env.TRACKER_SHEET_NAME!];

  await trackerSheet.loadHeaderRow();

  // Start at index 2 to skip member name and emails
  for (let i = 2; i < trackerSheet.headerValues.length; i++) {
    const formTitle = trackerSheet.headerValues[i];
    const form = await FormModel.findOne({ title: formTitle });
    if (!form) {
      const newForm = new FormModel({
        title: formTitle,
        createdDate: new Date(),
      });
      await newForm.save();
    }
  }
};

/**
 * Returns a map of form title member emails who have not completed the form
 */
const getPendingMembers = async () => {
  let pendingMembersMap = new Map<string, string[]>();
  const formTracker = await initSheet();
  const trackerSheet =
    formTracker.sheetsByTitle[process.env.TRACKER_SHEET_NAME!];
  const rows = await trackerSheet.getRows();

  for (const form of await FormModel.find()) {
    let pendingMembers = [];
    for (const row of rows) {
      if (
        row.get(form.title) == "❌" &&
        computeDateAgeDays(form.createdDate) > REMIND_DAYS
      ) {
        pendingMembers.push(row.get("All Members"));
      }
    }

    pendingMembersMap.set(form.title, pendingMembers);
  }

  return pendingMembersMap;
};

export { getPendingMembers, ingestForms };
