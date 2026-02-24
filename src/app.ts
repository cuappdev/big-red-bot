import { dbConnect } from "./database";
import * as FormController from "./forms/controllers";
import { Form } from "./forms/models";
import slackbot from "./slackbot";
import { logWithTime } from "./utils/timeUtils";
import {
  processAllCoffeeChats,
  processCompletedPairings,
  reportBiweeklyStats,
  sendMidwayReminders,
} from "./coffeeChats/controllers";

export const SEMESTER = "sp24";

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
    .replaceAll(/[.,\/#!$%\^&\*;:{}=`~()]/g, "");
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
  await FormController.ingestForms();
  const pendingMembersMap = await FormController.getPendingMembers().catch(
    (err) => {
      logWithTime(`Error while getting pending members: ${err}`);
      return new Map<Form, string[]>();
    },
  );

  for (const [formTitle, userEmails] of pendingMembersMap.entries()) {
    if (userEmails.length == 0) continue; // Skip if no pending members for this form

    await sendFormDM(formTitle, userEmails).catch((err) =>
      logWithTime(`Error while sending DMs: ${err}`),
    );
  }
};

export const startServer = async () => {
  await dbConnect();
  logWithTime("✅ Connected to database!");
  await slackbot.start(process.env.PORT || 3000);
  logWithTime("✅ Slackbot up and running!");

  await sendFormReminders();
  setInterval(sendFormReminders, 1000 * 60 * 60 * 24); // Run every 24 hours

  // Coffee chat pairings - run biweekly (every 14 days)
  await processAllCoffeeChats();
  setInterval(processAllCoffeeChats, 1000 * 60 * 60 * 24 * 14); // Run every 14 days

  // Process completed coffee chat pairings - run daily to collect and post photos
  await processCompletedPairings();
  setInterval(processCompletedPairings, 1000 * 60 * 60 * 24); // Run every 24 hours

  // Send midway reminders for coffee chats - run daily to catch 1-week pairings
  await sendMidwayReminders();
  setInterval(sendMidwayReminders, 1000 * 60 * 60 * 24); // Run every 24 hours

  // Report biweekly coffee chat statistics - run every 14 days
  await reportBiweeklyStats();
  setInterval(reportBiweeklyStats, 1000 * 60 * 60 * 24 * 14); // Run every 14 days
};

startServer().catch((err) => {
  logWithTime(`Error starting server: ${err}`);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logWithTime("Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logWithTime("Shutting down gracefully...");
  process.exit(0);
});
