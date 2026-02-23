import moment from "moment-timezone";
import slackbot from "../slackbot";
import { logWithTime } from "../utils";
import {
  CoffeeChatConfig,
  CoffeeChatConfigModel,
  CoffeeChatPairingModel,
} from "./models";

const COFFEE_CHAT_ACTIVITIES = [
  "grab coffee at a local café",
  "get lunch together",
  "take a walk around campus",
  "play a board game",
  "work together at a coffee shop",
  "grab bubble tea",
  "check out a new restaurant",
  "visit a local museum or gallery",
  "play video games together",
  "go for a quick hike",
  "grab ice cream",
  "cook a meal together",
  "attend a campus event",
  "play pool or ping pong",
  "do a workout or go to the gym together",
  "visit a bookstore",
  "try a new food spot",
  "have a video call chat",
  "collaborate on a side project",
  "attend a workshop or talk together",
  "get breakfast or brunch",
  "go rock climbing",
  "visit a farmers market",
  "play mini golf",
  "watch a movie together",
  "go bowling",
  "visit a cat café",
  "try an escape room",
  "go to a comedy show",
  "take a photography walk",
  "visit an arcade",
  "go thrifting or vintage shopping",
  "attend a concert or live music event",
  "play frisbee or catch",
  "visit a botanical garden",
  "go stargazing",
  "try a painting or pottery class",
  "explore a new neighborhood",
  "visit a library or study lounge",
  "go for a bike ride",
  "try a new coffee brewing method together",
  "attend a trivia night",
  "visit a local bakery",
  "play cards or a deck game",
  "go to a sports game",
  "try a cooking class",
  "visit a rooftop or scenic viewpoint",
  "go kayaking or paddle boarding",
  "attend a meditation or yoga session",
  "explore local street art or murals",
];

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Gets a random activity suggestion
 */
const getRandomActivity = (): string => {
  const randomIndex = Math.floor(Math.random() * COFFEE_CHAT_ACTIVITIES.length);
  return COFFEE_CHAT_ACTIVITIES[randomIndex];
};

/**
 * Gets all members from a Slack channel (excluding bots)
 */
const getChannelMembers = async (channelId: string): Promise<string[]> => {
  const result = await slackbot.client.conversations.members({
    channel: channelId,
  });

  if (!result.ok || !result.members) {
    throw new Error(`Failed to get members for channel ${channelId}`);
  }

  // Filter out bots
  const memberDetails = await Promise.all(
    result.members.map(async (userId) => {
      const userInfo = await slackbot.client.users.info({ user: userId });
      return {
        id: userId,
        isBot: userInfo.user?.is_bot || false,
      };
    }),
  );

  return memberDetails.filter((m) => !m.isBot).map((m) => m.id);
};

/**
 * Gets recent pairings to avoid repeating them
 */
const getRecentPairings = async (
  channelId: string,
  weeksBack: number = 4,
): Promise<Set<string>> => {
  const cutoffDate = moment()
    .tz("America/New_York")
    .subtract(weeksBack, "weeks")
    .toDate();

  const recentPairings = await CoffeeChatPairingModel.find({
    channelId,
    createdAt: { $gte: cutoffDate },
  });

  const pairSet = new Set<string>();
  recentPairings.forEach((pairing) => {
    const sorted = [...pairing.userIds].sort();
    pairSet.add(sorted.join("-"));
  });

  return pairSet;
};

/**
 * Creates optimal pairings avoiding recent matches
 */
const createPairings = (
  userIds: string[],
  recentPairs: Set<string>,
): string[][] => {
  const shuffled = shuffleArray(userIds);
  const pairings: string[][] = [];

  // Try to create pairs of 2, avoiding recent pairings when possible
  const unpaired = [...shuffled];

  while (unpaired.length >= 2) {
    const user1 = unpaired.shift()!;
    let paired = false;

    // Try to find a partner this user hasn't been paired with recently
    for (let i = 0; i < unpaired.length; i++) {
      const user2 = unpaired[i];
      const pairKey = [user1, user2].sort().join("-");

      if (!recentPairs.has(pairKey)) {
        unpaired.splice(i, 1);
        pairings.push([user1, user2]);
        paired = true;
        break;
      }
    }

    // If no suitable partner found, just pair with the next person
    if (!paired && unpaired.length > 0) {
      const user2 = unpaired.shift()!;
      pairings.push([user1, user2]);
    }
  }

  // If there's one person left, add them to the last group
  if (unpaired.length === 1 && pairings.length > 0) {
    pairings[pairings.length - 1].push(unpaired[0]);
  }

  return pairings;
};

/**
 * Creates a group DM and notifies paired users
 */
const notifyPairing = async (userIds: string[]): Promise<void> => {
  const userMentions = userIds.map((id) => `<@${id}>`).join(", ");
  const activity = getRandomActivity();

  try {
    // Create a group DM with all users in the pairing
    const conversation = await slackbot.client.conversations.open({
      users: userIds.join(","),
    });

    if (!conversation.ok || !conversation.channel) {
      logWithTime(`Failed to create group DM for users: ${userIds.join(", ")}`);
      return;
    }

    // Send a message to the group DM
    const messageResult = await slackbot.client.chat.postMessage({
      channel: conversation.channel.id!,
      text: `Hey ${userMentions}! You've been paired for a coffee chat. ☕\n\nSuggested activity: *${activity}*\n\nTake some time in the next two weeks to connect and get to know each other better!`,
    });

    if (!messageResult.ok) {
      logWithTime(`Failed to send message to group DM: ${conversation.channel.id}`);
    }
  } catch (error) {
    logWithTime(`Error creating group DM for users ${userIds.join(", ")}: ${error}`);
  }
};

/**
 * Processes coffee chat pairings for a specific channel
 */
export const processCoffeeChatChannel = async (
  config: CoffeeChatConfig,
): Promise<void> => {
  try {
    logWithTime(`Processing coffee chats for channel ${config.channelName}`);

    // Get all channel members
    const members = await getChannelMembers(config.channelId);

    if (members.length < 2) {
      logWithTime(
        `Not enough members in ${config.channelName} for coffee chats (need at least 2)`,
      );
      return;
    }

    // Get recent pairings to avoid repeating them
    const recentPairs = await getRecentPairings(config.channelId);

    // Create optimal pairings
    const pairings = createPairings(members, recentPairs);

    logWithTime(
      `Created ${pairings.length} pairing(s) for ${config.channelName}`,
    );

    // Save pairings and notify users
    const now = moment().tz("America/New_York").toDate();

    for (const pairing of pairings) {
      // Save to database
      const pairingDoc = new CoffeeChatPairingModel({
        channelId: config.channelId,
        userIds: pairing,
        createdAt: now,
        notifiedAt: now,
      });
      await pairingDoc.save();

      // Notify users
      await notifyPairing(pairing);
    }

    // Update last pairing date
    config.lastPairingDate = now;
    await CoffeeChatConfigModel.updateOne(
      { channelId: config.channelId },
      { lastPairingDate: now },
    );

    logWithTime(`✅ Completed coffee chat pairings for ${config.channelName}`);
  } catch (error) {
    logWithTime(
      `Error processing coffee chats for ${config.channelName}: ${error}`,
    );
  }
};

/**
 * Processes all active coffee chat channels
 */
export const processAllCoffeeChats = async (): Promise<void> => {
  const activeConfigs = await CoffeeChatConfigModel.find({ isActive: true });

  if (activeConfigs.length === 0) {
    logWithTime("No active coffee chat channels configured");
    return;
  }

  for (const config of activeConfigs) {
    await processCoffeeChatChannel(config);
  }
};

/**
 * Registers a channel for coffee chat pairings
 */
export const registerCoffeeChatChannel = async (
  channelId: string,
  channelName: string,
): Promise<void> => {
  const existing = await CoffeeChatConfigModel.findOne({ channelId });

  if (existing) {
    logWithTime(`Channel ${channelName} already registered for coffee chats`);
    return;
  }

  const config = new CoffeeChatConfigModel({
    channelId,
    channelName,
    isActive: true,
  });

  await config.save();
  logWithTime(`✅ Registered ${channelName} for coffee chat pairings`);
};
