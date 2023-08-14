import express from "express";
import { dbConnect } from "./database";
import * as FormController from "./forms/controllers";
import slackbot from "./slackbot";

const app = express();

const sendFormDM = async (formTitle: string, userEmails: string[]) => {
  const userIdPromises = userEmails.map(async (email) => {
    const user = await slackbot.client.users.lookupByEmail({ email: email });
    if (!user.user) {
      return null;
    }
    return user.user.id;
  });

  let userIds = await Promise.all(userIdPromises);
  userIds = userIds.filter((id) => id != null);

  const response = await slackbot.client.conversations.open({
    users: userIds.join(","),
  });

  if (!response.ok) {
    throw new Error("Failed to open conversation");
  }

  slackbot.client.chat.postMessage({
    channel: response.channel!.id!,
    text: `This is your reminder to fill out the ${formTitle} form!`,
  });
};

const sendFormReminders = async () => {
  await FormController.ingestForms();
  const pendingMembersMap = await FormController.getPendingMembers().catch(
    (err) => {
      console.error(err);
      return new Map<string, string[]>();
    }
  );

  for (const [formTitle, userEmails] of pendingMembersMap.entries()) {
    if (userEmails.length == 0) continue; // Skip if no pending members for this form

    await sendFormDM(formTitle, userEmails);
  }
};

export const startServer = async () => {
  await dbConnect();
  await slackbot.start(process.env.PORT || 3000);
  console.log("✅ Slackbot up and running!");

  app.listen(process.env.PORT || 8000);
  console.log("✅ Express server up and running!");

  await sendFormReminders();
  setInterval(sendFormReminders, 1000 * 60 * 60 * 24); // Run every 24 hours
};
