import { dbConnect } from "./database";
import { sendFormReminders } from "./forms/formService";
import slackbot from "./slackbot";
import { logWithTime } from "./utils/timeUtils";
import {
  processAllCoffeeChats,
  processCompletedPairings,
  reportBiweeklyStats,
  sendMidwayReminders,
} from "./coffeeChats/coffeeChatService";
import { registerCoffeeChatCommands } from "./coffeeChats/coffeeChatCommands";
import { registerCoffeeChatActions } from "./coffeeChats/coffeeChatActions";

export const SEMESTER = "sp24";
export const DEFAULT_PAIRING_FREQUENCY_DAYS = 7;

const initializeFormServices = async () => {
  await sendFormReminders();
  setInterval(sendFormReminders, 1000 * 60 * 60 * 24); // Run every 24 hours
};

const initializeCoffeeChatServices = async () => {
  // Register coffee chat actions and commands
  registerCoffeeChatActions(slackbot);
  registerCoffeeChatCommands(slackbot);

  // Coffee chat pairings - run biweekly (every 14 days)
  setInterval(processAllCoffeeChats, 1000 * 60 * 60 * 24 * 14); // Run every 14 days

  // Process completed coffee chat pairings - run daily to collect and post photos
  setInterval(processCompletedPairings, 1000 * 60 * 60 * 24); // Run every 24 hours

  // Send midway reminders for coffee chats - run daily to catch 1-week pairings
  setInterval(sendMidwayReminders, 1000 * 60 * 60 * 24); // Run every 24 hours

  // Report biweekly coffee chat statistics - run every 14 days
  setInterval(reportBiweeklyStats, 1000 * 60 * 60 * 24 * 14); // Run every 14 days
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
