import cron from "node-cron";
import { dbConnect } from "./database";
import { sendFormReminders } from "./forms/formService";
import slackbot from "./slackbot";
import { logWithTime } from "./utils/timeUtils";
import {
  createNewCoffeeChatRounds,
  completePreviousCoffeeChatRound,
  sendMidwayReminders,
} from "./coffeeChats/coffeeChatService";
import { registerCoffeeChatCommands } from "./coffeeChats/coffeeChatCommands";
import { registerCoffeeChatActions } from "./coffeeChats/coffeeChatActions";

export const SEMESTER = "sp24";
export const DEFAULT_PAIRING_FREQUENCY_DAYS = 14; // Default to every 2 weeks

const initializeFormServices = async () => {
  await sendFormReminders();
  setInterval(sendFormReminders, 1000 * 60 * 60 * 24); // Run every 24 hours
};

const initializeCoffeeChatServices = async () => {
  // Register coffee chat actions and commands
  registerCoffeeChatActions(slackbot);
  registerCoffeeChatCommands(slackbot);

  // Schedule all coffee chat tasks to run daily at 9am
  cron.schedule("0 9 * * *", async () => {
    logWithTime("Running scheduled coffee chat tasks at 9am...");
    // Process previous pairings and report stats
    await completePreviousCoffeeChatRound();

    // Create new pairings for the next next round
    await createNewCoffeeChatRounds();

    logWithTime("Completed scheduled coffee chat tasks.");
  });

  // Schedule midway reminders to run daily at 4pm (task does not run until midway through the pairing cycle, so won't send any reminders until then)
  cron.schedule("0 16 * * *", async () => {
    logWithTime("Running midway reminder task at 4pm...");
    await sendMidwayReminders();
    logWithTime("Completed midway reminder task.");
  });

  logWithTime("✅ Coffee chat tasks scheduled to run daily at 9am");
  logWithTime("✅ Midway reminders scheduled to run daily at 4pm");
};

export const startServer = async () => {
  await dbConnect();
  logWithTime("✅ Connected to MongoDB");
  await slackbot.start(process.env.PORT || 3000);
  logWithTime("✅ Slackbot up and running!");

  // Currently unused, so commenting out to avoid unnecessary API calls and logs. Can re-enable when form services are needed.
  // await initializeFormServices();
  await initializeCoffeeChatServices();
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
