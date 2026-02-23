import moment from "moment-timezone";
import slackbot from "../slackbot";
import { logWithTime } from "../utils";
import {
  CoffeeChatConfig,
  CoffeeChatConfigModel,
  CoffeeChatPairingModel,
  CoffeeChatUserPreferenceModel,
} from "./models";

const COFFEE_CHAT_ACTIVITIES = [
  "Grab coffee at a local café ☕",
  "Get lunch together 🍽️",
  "Take a walk around campus 🚶",
  "Play a board game 🎲",
  "Work together at a coffee shop 💻",
  "Grab bubble tea 🧋",
  "Check out a new restaurant 🍴",
  "Visit a local museum or gallery 🖼️",
  "Play video games together 🎮",
  "Go for a quick hike 🥾",
  "Grab ice cream 🍦",
  "Cook a meal together 👨‍🍳",
  "Attend a campus event 🎪",
  "Play pool or ping pong 🎱",
  "Do a workout or go to the gym together 💪",
  "Visit a bookstore 📚",
  "Try a new food spot 🍕",
  "Have a video call chat 📹",
  "Collaborate on a side project 🛠️",
  "Attend a workshop or talk together 🎤",
  "Get breakfast or brunch 🥞",
  "Go rock climbing 🧗",
  "Visit a farmers market 🥕",
  "Play mini golf ⛳",
  "Watch a movie together 🎬",
  "Go bowling 🎳",
  "Visit a cat café 🐱",
  "Try an escape room 🔐",
  "Go to a comedy show 😂",
  "Take a photography walk 📸",
  "Visit an arcade 🕹️",
  "Go thrifting or vintage shopping 👗",
  "Attend a concert or live music event 🎵",
  "Play frisbee or catch 🥏",
  "Visit a botanical garden 🌺",
  "Go stargazing 🌟",
  "Try a painting or pottery class 🎨",
  "Explore a new neighborhood 🗺️",
  "Visit a library or study lounge 📖",
  "Go for a bike ride 🚴",
  "Try a new coffee brewing method together ☕",
  "Attend a trivia night 🧠",
  "Visit a local bakery 🥐",
  "Play cards or a deck game 🃏",
  "Go to a sports game 🏀",
  "Try a cooking class 🍳",
  "Visit a rooftop or scenic viewpoint 🌆",
  "Go kayaking or paddle boarding 🛶",
  "Attend a meditation or yoga session 🧘",
  "Explore local street art or murals 🎨",
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
 * Gets all members from a Slack channel (excluding bots and opted-out users)
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

  const nonBotMembers = memberDetails.filter((m) => !m.isBot).map((m) => m.id);

  // Filter out opted-out users
  const preferences = await CoffeeChatUserPreferenceModel.find({
    channelId,
    userId: { $in: nonBotMembers },
    isOptedIn: false,
  });

  const optedOutUserIds = new Set(preferences.map((p) => p.userId));

  return nonBotMembers.filter((userId) => !optedOutUserIds.has(userId));
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
const notifyPairing = async (
  userIds: string[],
  channelId: string,
): Promise<string | null> => {
  const userMentions = userIds.map((id) => `<@${id}>`).join(", ");
  const activity = getRandomActivity();

  try {
    // Create a group DM with all users in the pairing
    const conversation = await slackbot.client.conversations.open({
      users: userIds.join(","),
    });

    if (!conversation.ok || !conversation.channel) {
      logWithTime(`Failed to create group DM for users: ${userIds.join(", ")}`);
      return null;
    }

    // Calculate deadline (2 weeks from now)
    const deadline = moment().tz("America/New_York").add(2, "weeks");

    // Send a message to the group DM with interactive buttons
    const messageResult = await slackbot.client.chat.postMessage({
      channel: conversation.channel.id!,
      text: `Hey ${userMentions}! You've been paired for a coffee chat. ☕`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:tada: Hey ${userMentions}! You've been paired for a coffee chat. ☕`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:bulb: *Suggested activity:* ${activity}\n\nTake some time over the next two weeks to connect and get to know each other better!`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:calendar: *Meet by:* ${deadline.format("dddd, MMMM Do")}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:camera_with_flash: *Don't forget to snap some photos!* Share them here in this chat — we'll post a collection in the channel after two weeks to celebrate your meetup!`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "⏸️ Pause Future Pairings",
              },
              style: "danger",
              action_id: "coffee_chat_opt_out",
              value: channelId,
            },
          ],
        },
      ],
    });

    if (!messageResult.ok) {
      logWithTime(
        `Failed to send message to group DM: ${conversation.channel.id}`,
      );
      return null;
    }

    return conversation.channel.id!;
  } catch (error) {
    logWithTime(
      `Error creating group DM for users ${userIds.join(", ")}: ${error}`,
    );
    return null;
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

    // Expire all previous active pairings for this channel
    const expireResult = await CoffeeChatPairingModel.updateMany(
      { channelId: config.channelId, isActive: true },
      { isActive: false },
    );

    if (expireResult.modifiedCount > 0) {
      logWithTime(
        `Expired ${expireResult.modifiedCount} previous pairing(s) for ${config.channelName}`,
      );
    }

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
      // Notify users and get conversation ID
      const conversationId = await notifyPairing(pairing, config.channelId);

      // Save to database
      const pairingDoc = new CoffeeChatPairingModel({
        channelId: config.channelId,
        userIds: pairing,
        createdAt: now,
        notifiedAt: now,
        conversationId: conversationId || undefined,
        isActive: true,
        reminderSent: false,
        photosPosted: false,
      });
      await pairingDoc.save();
    }

    // Update last pairing date
    config.lastPairingDate = now;
    await CoffeeChatConfigModel.updateOne(
      { channelId: config.channelId },
      { lastPairingDate: now },
    );

    // Send announcement to the channel
    const nextPairingDate = moment()
      .tz("America/New_York")
      .add(2, "weeks");
    
    await slackbot.client.chat.postMessage({
      channel: config.channelId,
      text: "Coffee chat pairings have been created!",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:tada: Hooray! I just created ${pairings.length} coffee chat pairing${pairings.length !== 1 ? "s" : ""} a few moments ago.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:coffee: Have fun meeting with your coffee chat partner${pairings.length > 1 ? "s" : ""} :slightly_smiling_face:`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:calendar: Your next scheduled pairing is on ${nextPairingDate.format("dddd (MMM Do)")} at ${nextPairingDate.format("h:mm A z")}`,
          },
        },
      ],
    });

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

/**
 * Opts a user out of coffee chats for a specific channel
 */
export const optOutOfCoffeeChats = async (
  userId: string,
  channelId: string,
): Promise<void> => {
  const now = moment().tz("America/New_York").toDate();

  await CoffeeChatUserPreferenceModel.findOneAndUpdate(
    { userId, channelId },
    { isOptedIn: false, updatedAt: now },
    { upsert: true, new: true },
  );

  logWithTime(
    `User ${userId} opted out of coffee chats in channel ${channelId}`,
  );
};

/**
 * Opts a user back into coffee chats for a specific channel
 */
export const optInToCoffeeChats = async (
  userId: string,
  channelId: string,
): Promise<void> => {
  const now = moment().tz("America/New_York").toDate();

  await CoffeeChatUserPreferenceModel.findOneAndUpdate(
    { userId, channelId },
    { isOptedIn: true, updatedAt: now },
    { upsert: true, new: true },
  );

  logWithTime(`User ${userId} opted into coffee chats in channel ${channelId}`);
};

/**
 * Gets the opt-in status for a user in a channel
 */
export const getCoffeeChatsOptInStatus = async (
  userId: string,
  channelId: string,
): Promise<boolean> => {
  const preference = await CoffeeChatUserPreferenceModel.findOne({
    userId,
    channelId,
  });

  // Default to opted in if no preference exists
  return preference?.isOptedIn ?? true;
};

/**
 * Collects photos from a pairing DM conversation
 */
const collectPhotosFromConversation = async (
  conversationId: string,
  createdAt: Date,
): Promise<string[]> => {
  const photoUrls: string[] = [];

  try {
    // Get conversation history from the pairing date onwards
    const oldestTimestamp = Math.floor(createdAt.getTime() / 1000).toString();

    const history = await slackbot.client.conversations.history({
      channel: conversationId,
      oldest: oldestTimestamp,
      limit: 1000,
    });

    if (!history.ok || !history.messages) {
      logWithTime(`Failed to get conversation history for ${conversationId}`);
      return photoUrls;
    }

    // Extract image URLs from messages
    for (const message of history.messages) {
      if (message.files) {
        for (const file of message.files) {
          // Check if it's an image
          if (file.mimetype?.startsWith("image/")) {
            // Use the original URL or the URL private
            const imageUrl = file.url_private || file.permalink;
            if (imageUrl) {
              photoUrls.push(imageUrl);
            }
          }
        }
      }
    }

    logWithTime(
      `Collected ${photoUrls.length} photo(s) from conversation ${conversationId}`,
    );
  } catch (error) {
    logWithTime(
      `Error collecting photos from conversation ${conversationId}: ${error}`,
    );
  }

  return photoUrls;
};

/**
 * Posts collected photos to a channel
 */
const postPhotosToChannel = async (
  channelId: string,
  userIds: string[],
  photoUrls: string[],
): Promise<void> => {
  try {
    const userMentions = userIds.map((id) => `<@${id}>`).join(", ");

    if (photoUrls.length === 0) {
      // No photos, just acknowledge the meetup
      await slackbot.client.chat.postMessage({
        channel: channelId,
        text: `${userMentions} completed their coffee chat! \u2615`,
      });
      return;
    }

    // Post photos to the channel
    const blocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\ud83d\udcf8 *Coffee Chat Memories* \u2615\n\n${userMentions} shared ${photoUrls.length} photo${photoUrls.length > 1 ? "s" : ""} from their coffee chat!`,
        },
      },
    ];

    // Add image blocks (Slack limits blocks, so we'll add up to 10 images)
    const maxPhotos = Math.min(photoUrls.length, 10);
    for (let i = 0; i < maxPhotos; i++) {
      blocks.push({
        type: "image",
        image_url: photoUrls[i],
        alt_text: `Coffee chat photo ${i + 1}`,
      });
    }

    if (photoUrls.length > 10) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_And ${photoUrls.length - 10} more photo${photoUrls.length - 10 > 1 ? "s" : ""}..._`,
          },
        ],
      });
    }

    await slackbot.client.chat.postMessage({
      channel: channelId,
      text: `${userMentions} shared photos from their coffee chat! \ud83d\udcf8`,
      blocks,
    });

    logWithTime(`Posted ${photoUrls.length} photo(s) to channel ${channelId}`);
  } catch (error) {
    logWithTime(`Error posting photos to channel ${channelId}: ${error}`);
  }
};

/**
 * Processes photo collection for pairings that are 2 weeks old
 */
export const processCompletedPairings = async (): Promise<void> => {
  try {
    const twoWeeksAgo = moment()
      .tz("America/New_York")
      .subtract(2, "weeks")
      .toDate();

    const threeDaysMoreThanTwoWeeks = moment()
      .tz("America/New_York")
      .subtract(2, "weeks")
      .subtract(3, "days")
      .toDate();

    // Find pairings that are approximately 2 weeks old and haven't had photos posted
    const completedPairings = await CoffeeChatPairingModel.find({
      createdAt: {
        $gte: threeDaysMoreThanTwoWeeks,
        $lte: twoWeeksAgo,
      },
      photosPosted: false,
      conversationId: { $exists: true, $ne: null },
    });

    logWithTime(
      `Found ${completedPairings.length} completed pairing(s) to process`,
    );

    for (const pairing of completedPairings) {
      if (!pairing.conversationId) continue;

      // Collect photos from the conversation
      const photoUrls = await collectPhotosFromConversation(
        pairing.conversationId,
        pairing.createdAt,
      );

      // Post photos to the channel
      await postPhotosToChannel(pairing.channelId, pairing.userIds, photoUrls);

      // Mark as posted
      await CoffeeChatPairingModel.updateOne(
        { _id: pairing._id },
        { photosPosted: true },
      );
    }

    logWithTime(
      `\u2705 Completed processing ${completedPairings.length} pairing(s)`,
    );
  } catch (error) {
    logWithTime(`Error processing completed pairings: ${error}`);
  }
};
/**
 * Generates and reports biweekly coffee chat statistics for a channel
 */
const reportChannelStats = async (config: CoffeeChatConfig): Promise<void> => {
  try {
    const twoWeeksAgo = moment()
      .tz("America/New_York")
      .subtract(2, "weeks")
      .toDate();

    // Get all pairings from the past two weeks for this channel
    const biweeklyPairings = await CoffeeChatPairingModel.find({
      channelId: config.channelId,
      createdAt: { $gte: twoWeeksAgo },
    });

    if (biweeklyPairings.length === 0) {
      // No pairings in the past two weeks, skip reporting
      return;
    }

    // Calculate stats
    const totalPairings = biweeklyPairings.length;
    const uniqueParticipants = new Set<string>();
    let totalPhotos = 0;
    let pairingsWithPhotos = 0;

    for (const pairing of biweeklyPairings) {
      pairing.userIds.forEach((userId) => uniqueParticipants.add(userId));

      // Count photos if conversation exists
      if (pairing.conversationId) {
        const photos = await collectPhotosFromConversation(
          pairing.conversationId,
          pairing.createdAt,
        );
        if (photos.length > 0) {
          totalPhotos += photos.length;
          pairingsWithPhotos++;
        }
      }
    }

    // Get total channel members
    const allMembers = await getChannelMembers(config.channelId);
    const totalMembers = allMembers.length;
    const participationRate =
      totalMembers > 0
        ? ((uniqueParticipants.size / totalMembers) * 100).toFixed(1)
        : "0.0";

    // Post stats to channel
    await slackbot.client.chat.postMessage({
      channel: config.channelId,
      text: "Weekly Coffee Chat Stats",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "☕ Coffee Chat Stats",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Pairings Created:*\n${totalPairings}`,
            },
            {
              type: "mrkdwn",
              text: `*Unique Participants:*\n${uniqueParticipants.size} of ${totalMembers}`,
            },
            {
              type: "mrkdwn",
              text: `*Participation Rate:*\n${participationRate}%`,
            },
            {
              type: "mrkdwn",
              text: `*Photos Shared:*\n${totalPhotos} photo${totalPhotos !== 1 ? "s" : ""} from ${pairingsWithPhotos} pairing${pairingsWithPhotos !== 1 ? "s" : ""}`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Stats from the past 2 weeks • ${moment().tz("America/New_York").format("MMMM D, YYYY")}`,
            },
          ],
        },
      ],
    });

    logWithTime(`✅ Posted biweekly stats for channel ${config.channelName}`);
  } catch (error) {
    logWithTime(
      `Error reporting stats for channel ${config.channelName}: ${error}`,
    );
  }
};

/**
 * Reports biweekly statistics for all active coffee chat channels
 */
export const reportBiweeklyStats = async (): Promise<void> => {
  try {
    const activeConfigs = await CoffeeChatConfigModel.find({ isActive: true });

    if (activeConfigs.length === 0) {
      logWithTime(
        "No active coffee chat channels configured for stats reporting",
      );
      return;
    }

    logWithTime(
      `Reporting biweekly stats for ${activeConfigs.length} channel(s)`,
    );

    for (const config of activeConfigs) {
      await reportChannelStats(config);
    }

    logWithTime("✅ Completed biweekly stats reporting");
  } catch (error) {
    logWithTime(`Error reporting biweekly stats: ${error}`);
  }
};

/**
 * Sends reminder messages to pairings that are approximately 1 week old
 */
export const sendMidwayReminders = async (): Promise<void> => {
  try {
    const oneWeekAgo = moment()
      .tz("America/New_York")
      .subtract(1, "week")
      .toDate();

    const sixDaysAgo = moment()
      .tz("America/New_York")
      .subtract(6, "days")
      .toDate();

    // Find pairings that are approximately 1 week old and haven't received a reminder
    const pairingsNeedingReminder = await CoffeeChatPairingModel.find({
      createdAt: {
        $gte: oneWeekAgo,
        $lte: sixDaysAgo,
      },
      reminderSent: false,
      conversationId: { $exists: true, $ne: null },
    });

    logWithTime(
      `Found ${pairingsNeedingReminder.length} pairing(s) needing midway reminder`,
    );

    for (const pairing of pairingsNeedingReminder) {
      if (!pairing.conversationId) continue;

      try {
        const userMentions = pairing.userIds.map((id) => `<@${id}>`).join(", ");

        // Send reminder to the group DM
        await slackbot.client.chat.postMessage({
          channel: pairing.conversationId,
          text: `Hey ${userMentions}! Just a friendly reminder about your coffee chat. ☕`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Hey ${userMentions}! 👋`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Just a friendly reminder about your coffee chat! You have about a week left to connect. ☕\n\nDon't forget to share any photos you take together in this chat!`,
              },
            },
          ],
        });

        // Mark reminder as sent
        await CoffeeChatPairingModel.updateOne(
          { _id: pairing._id },
          { reminderSent: true },
        );

        logWithTime(
          `Sent midway reminder to pairing: ${pairing.userIds.join(", ")}`,
        );
      } catch (error) {
        logWithTime(
          `Error sending reminder to pairing ${pairing._id}: ${error}`,
        );
      }
    }

    logWithTime(
      `✅ Completed sending ${pairingsNeedingReminder.length} midway reminder(s)`,
    );
  } catch (error) {
    logWithTime(`Error sending midway reminders: ${error}`);
  }
};
