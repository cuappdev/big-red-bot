import moment from "moment-timezone";
import { SEMESTER } from "../app";
import {
  dateToESTString,
  getStartOfToday,
  isToday,
  logWithTime,
} from "../utils/timeUtils";
import { initSheet } from "./formTracker";
import { Form, FormModel } from "./formModels";
import slackbot from "../slackbot";

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
  const pendingMembersMap = new Map<Form, string[]>();
  const formTracker = await initSheet();
  const trackerSheet =
    formTracker.sheetsByTitle[process.env.TRACKER_SHEET_NAME!];
  const rows = await trackerSheet.getRows();

  const dueForms = (
    await FormModel.find().gte("dueDate", getStartOfToday())
  ).filter((form) => isToday(form.dueDate));

  logWithTime(
    `Due Forms: ${dueForms.map(
      (dueForm) =>
        `${dueForm.title} is due Today (${dateToESTString(dueForm.dueDate)})`,
    )}`,
  );

  for (const form of dueForms) {
    const pendingMembers = [];
    for (const row of rows) {
      if (row.get(form.title) == "❌" && isToday(form.dueDate)) {
        pendingMembers.push(row.get("All Members"));
      }
    }

    pendingMembersMap.set(form, pendingMembers);
  }

  return pendingMembersMap;
};

const sendFormDM = async (form: Form, userEmails: string[]) => {
  const userIdPromises = userEmails.map(async (email) => {
    const user = await slackbot.client.users.lookupByEmail({ email: email });
    if (!user.user) {
      return null;
    }
    return user.user.id;
  });

  let userIds = await Promise.all(userIdPromises);
  userIds = userIds.filter((id) => id != null);

  let channelTitle = form.title
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll(/[.,/#!$%^&*;:{}=`~()]/g, "");
  channelTitle = `${channelTitle}-reminder`;
  logWithTime(`Attempting to create channel ${channelTitle}`);
  const response = await slackbot.client.conversations.create({
    name: channelTitle,
  });

  if (!response.ok) {
    throw new Error("Failed to open conversation");
  }

  const channelId = response.channel!.id!;
  await slackbot.client.conversations.invite({
    channel: channelId,
    users: userIds.join(","),
  });

  slackbot.client.chat.postMessage({
    channel: channelId,
    text: `Hey <!channel>, this is your reminder to fill out the <${form.formURL}|${form.title}> form by tonight!`,
  });
};

const sendFormReminders = async () => {
  await ingestForms();
  const pendingMembersMap = await getPendingMembers().catch((err) => {
    logWithTime(`Error while getting pending members: ${err}`);
    return new Map<Form, string[]>();
  });

  for (const [formTitle, userEmails] of pendingMembersMap.entries()) {
    if (userEmails.length == 0) continue; // Skip if no pending members for this form

    await sendFormDM(formTitle, userEmails).catch((err) =>
      logWithTime(`Error while sending DMs: ${err}`),
    );
  }
};

export { getPendingMembers, ingestForms, sendFormDM, sendFormReminders };
