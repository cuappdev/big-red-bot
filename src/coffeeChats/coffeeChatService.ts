import moment from "moment-timezone";
import slackbot from "../slackbot";
import { logWithTime } from "../utils/timeUtils";
import {
  CoffeeChatConfig,
  CoffeeChatConfigModel,
  CoffeeChatPairingModel,
  CoffeeChatUserPreferenceModel,
} from "./coffeeChatModels";
import { DEFAULT_PAIRING_FREQUENCY_DAYS } from "../app";

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
  "Get breakfast or brunch 🥞",
  "Go rock climbing 🧗",
  "Visit a farmers market 🥕",
  "Play golf ⛳",
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
export const getChannelMembers = async (
  channelId: string,
): Promise<string[]> => {
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

  // Filter out opted-out users and users who want to skip next pairing
  const preferences = await CoffeeChatUserPreferenceModel.find({
    channelId,
    userId: { $in: nonBotMembers },
    $or: [{ isOptedIn: false }, { skipNextPairing: true }],
  });

  const excludedUserIds = new Set(preferences.map((p) => p.userId));

  return nonBotMembers.filter((userId) => !excludedUserIds.has(userId));
};

/**
 * Gets recent pairings to avoid repeating them
 */
export const getRecentPairings = async (
  channelId: string,
  weeksBack: number = 6,
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
export const createPairings = (
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
 * Extracts scheduling links (Calendly, Cal.com, etc.) from user profile
 */
export const getSchedulingLink = async (
  userId: string,
): Promise<string | null> => {
  try {
    const userInfo = await slackbot.client.users.info({ user: userId });
    if (!userInfo.ok || !userInfo.user?.profile) {
      return null;
    }

    const profile = userInfo.user.profile;

    // Check profile fields for scheduling links
    const fieldsToCheck = [
      ...((profile as Record<string, unknown>).fields
        ? Object.values(
            (profile as Record<string, unknown>).fields as Record<
              string,
              { value?: string }
            >,
          ).map((f) => f?.value)
        : []),
    ];

    // Common scheduling platforms
    const schedulingPatterns = [
      /calendly\.com\/[\w-]+/i,
      /cal\.com\/[\w-]+/i,
      /savvycal\.com\/[\w-]+/i,
      /tidycal\.com\/[\w-]+/i,
      /zcal\.co\/[\w-]+/i,
      /schedule\.(?:once|now)\/[\w-]+/i,
    ];

    for (const field of fieldsToCheck) {
      if (!field || typeof field !== "string") continue;

      for (const pattern of schedulingPatterns) {
        const match = field.match(pattern);
        if (match) {
          // Ensure it's a full URL
          let link = match[0];
          if (!link.startsWith("http")) {
            link = "https://" + link;
          }
          return link;
        }
      }
    }

    return null;
  } catch (error) {
    logWithTime(`Error fetching scheduling link for user ${userId}: ${error}`);
    return null;
  }
};

/**
 * Creates a group DM and notifies paired users
 */
export const notifyPairing = async (
  userIds: string[],
  channelId: string,
  pairingId: string,
  dueDate: Date,
): Promise<string | null> => {
  const userMentions = userIds.map((id) => `<@${id}>`).join(", ");
  const activity = getRandomActivity();

  // Fetch scheduling links for all users
  const schedulingLinks = await Promise.all(
    userIds.map(async (userId) => {
      const link = await getSchedulingLink(userId);
      return { userId, link };
    }),
  );

  try {
    // Create a group DM with all users in the pairing
    const conversation = await slackbot.client.conversations.open({
      users: userIds.join(","),
    });

    if (!conversation.ok || !conversation.channel) {
      logWithTime(`Failed to create group DM for users: ${userIds.join(", ")}`);
      return null;
    }

    const deadline = moment(dueDate).tz("America/New_York");

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
            text: `:bulb: *Suggested activity:* ${activity}\n\nTake some time over the next few days to connect and get to know each other better!`,
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
            text: `📸 *Don't forget to snap some photos!* Share them in the channel to celebrate your meetup!`,
          },
        },
        ...(schedulingLinks.some((s) => s.link)
          ? [
              {
                type: "section" as const,
                text: {
                  type: "mrkdwn" as const,
                  text:
                    `:link: *Scheduling Links:*\n` +
                    schedulingLinks
                      .filter((s) => s.link)
                      .map((s) => `• <@${s.userId}>: ${s.link}`)
                      .join("\n"),
                },
              },
            ]
          : []),
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ We Met!",
              },
              style: "primary",
              action_id: "coffee_chat_confirm_meetup",
              value: pairingId,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "⏭️ Skip Next Time",
              },
              action_id: "coffee_chat_skip_next",
              value: channelId,
            },
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

// ___________________________________________________________________________________
/**
 * Creates a new round of coffee chat pairings for channels that are due, and sends notifications to users
 */
export const createNewCoffeeChatRounds = async (): Promise<void> => {
  const now = moment().tz("America/New_York").toDate();

  // Find channels that are due for their next pairing
  const activeConfigs = await CoffeeChatConfigModel.find({
    isActive: true,
    nextPairingDate: { $lte: now },
  });

  if (activeConfigs.length === 0) {
    logWithTime("No coffee chat channels are due for pairing at this time");
    return;
  }

  logWithTime(`Processing ${activeConfigs.length} channel(s) due for pairing`);

  for (const config of activeConfigs) {
    await createCoffeeChatsForChannel(config);
  }
};

/**
 * Creates coffee chat pairings for a specific channel
 */
export const createCoffeeChatsForChannel = async (
  config: CoffeeChatConfig,
): Promise<void> => {
  try {
    // Skip if there are already active pairings for this channel
    const now = moment().tz("America/New_York").toDate();
    const activePairings = await CoffeeChatPairingModel.find({
      channelId: config.channelId,
      dueDate: { $gte: now },
    });

    if (activePairings.length > 0) {
      logWithTime(
        `Channel ${config.channelName} already has ${activePairings.length} active pairing(s). Skipping new pairing creation.`,
      );
      return;
    }

    logWithTime(`Creating coffee chats for channel ${config.channelName}`);

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
    const dueDate = moment()
      .tz("America/New_York")
      .add(config.pairingFrequencyDays - 1, "days")
      .endOf("day")
      .toDate();

    for (const pairing of pairings) {
      // Save to database first to get the pairing ID
      const pairingDoc = new CoffeeChatPairingModel({
        channelId: config.channelId,
        userIds: pairing,
        createdAt: now,
        dueDate: dueDate,
      });
      const savedPairing = await pairingDoc.save();

      // Notify users with the pairing ID
      const conversationId = await notifyPairing(
        pairing,
        config.channelId,
        savedPairing._id.toString(),
        dueDate,
      );

      // Update with conversation ID if successful
      if (conversationId) {
        await CoffeeChatPairingModel.findByIdAndUpdate(savedPairing._id, {
          conversationId,
        });
      }
    }

    // Update last pairing date and next pairing date
    const nextPairingDate = moment()
      .tz("America/New_York")
      .add(config.pairingFrequencyDays, "days")
      .startOf("day");

    await CoffeeChatConfigModel.updateOne(
      { channelId: config.channelId },
      {
        lastPairingDate: now,
        nextPairingDate: nextPairingDate.toDate(),
      },
    );

    // Clear skip flags for all users who skipped this round
    await clearSkipFlags(config.channelId);

    // Send announcement to the channel
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
            text: `:calendar: Your next scheduled pairing is on ${nextPairingDate.format("dddd (MMM Do)")}`,
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
 * Reports statistics for all active coffee chat channels
 */
export const reportStats = async (): Promise<void> => {
  try {
    const activeConfigs = await CoffeeChatConfigModel.find({
      isActive: true,
    });

    if (activeConfigs.length === 0) {
      logWithTime(
        "No coffee chat channels are due for stats reporting at this time",
      );
      return;
    }

    logWithTime(`Reporting stats for ${activeConfigs.length} channel(s)`);

    for (const config of activeConfigs) {
      await reportChannelStats(config);
    }

    logWithTime("✅ Completed stats reporting");
  } catch (error) {
    logWithTime(`Error reporting stats: ${error}`);
  }
};

/**
 * Generates and reports coffee chat statistics for a channel
 */
export const reportChannelStats = async (
  config: CoffeeChatConfig,
): Promise<void> => {
  try {
    const periodAgo = moment()
      .tz("America/New_York")
      .startOf("day")
      .subtract(config.pairingFrequencyDays, "days")
      .toDate();

    // Get all pairings from the past pairing period for this channel
    // Only consider pairings whose due date is within the past pairing frequency, to ensure we are reporting on the most recent round of pairings
    const periodPairings = await CoffeeChatPairingModel.find({
      channelId: config.channelId,
      dueDate: {
        $gte: periodAgo,
        $lte: moment().tz("America/New_York").startOf("day").toDate(),
      },
    });

    if (periodPairings.length === 0) {
      return;
    }

    const completedPairings = periodPairings.filter((p) => p.meetupConfirmed);

    // Calculate stats
    const totalPairings = periodPairings.length;
    const totalCompletedPairings = completedPairings.length;
    const uniqueParticipants = new Set<string>();

    for (const pairing of completedPairings) {
      pairing.userIds.forEach((userId) => uniqueParticipants.add(userId));
    }

    // Get total channel members
    const allMembers = await getChannelMembers(config.channelId);
    const totalMembers = allMembers.length;
    const participationRate =
      totalMembers > 0
        ? ((uniqueParticipants.size / totalMembers) * 100).toFixed(2)
        : "0.0";

    // Post stats to channel
    await slackbot.client.chat.postMessage({
      channel: config.channelId,
      text: "Coffee Chat Stats",
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
              text: `*Completed Pairings:*\n${totalCompletedPairings} of ${totalPairings}`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Stats from the past ${config.pairingFrequencyDays} day${config.pairingFrequencyDays !== 1 ? "s" : ""} • ${moment().tz("America/New_York").format("MMMM D, YYYY")}`,
            },
          ],
        },
      ],
    });

    logWithTime(`✅ Posted stats for channel ${config.channelName}`);
  } catch (error) {
    logWithTime(
      `Error reporting stats for channel ${config.channelName}: ${error}`,
    );
  }
};

/**
 * Sends reminder messages to pairings halfway through, if they haven't met yet
 */
export const sendMidwayReminders = async (): Promise<void> => {
  try {
    const activeConfigs = await CoffeeChatConfigModel.find({
      isActive: true,
    });

    let totalPairingsNeedingReminder = 0;

    for (const config of activeConfigs) {
      const midwayDays = Math.floor(config.pairingFrequencyDays / 2);

      // Create a window around the midway point (±24 hours)
      const midwayStart = moment()
        .tz("America/New_York")
        .subtract(midwayDays, "days")
        .subtract(24, "hours")
        .toDate();

      const midwayEnd = moment()
        .tz("America/New_York")
        .subtract(midwayDays, "days")
        .add(24, "hours")
        .toDate();

      // Find pairings for this channel that need reminders
      const pairingsNeedingReminder = await CoffeeChatPairingModel.find({
        channelId: config.channelId,
        createdAt: {
          $gte: midwayStart,
          $lte: midwayEnd,
        },
        midpointReminderSent: false,
        meetupConfirmed: false,
        conversationId: { $exists: true, $ne: null },
      });

      totalPairingsNeedingReminder += pairingsNeedingReminder.length;

      logWithTime(
        `Found ${pairingsNeedingReminder.length} pairing(s) needing midway reminder for channel ${config.channelName}`,
      );

      for (const pairing of pairingsNeedingReminder) {
        if (!pairing.conversationId) continue;

        try {
          const userMentions = pairing.userIds
            .map((id) => `<@${id}>`)
            .join(", ");

          const daysRemaining = Math.ceil(
            moment(pairing.dueDate)
              .tz("America/New_York")
              .diff(moment().tz("America/New_York"), "hours") / 24,
          );

          // Fetch scheduling links for all users
          const schedulingLinks = await Promise.all(
            pairing.userIds.map(async (userId) => {
              const link = await getSchedulingLink(userId);
              return { userId, link };
            }),
          );

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
                  text: `Just a friendly reminder about your coffee chat! You have about ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left to connect. ☕\n\nDon't forget to share any photos you take together in the channel!`,
                },
              },
              ...(schedulingLinks.some((s) => s.link)
                ? [
                    {
                      type: "section" as const,
                      text: {
                        type: "mrkdwn" as const,
                        text:
                          `:link: *Scheduling Links:*\n` +
                          schedulingLinks
                            .filter((s) => s.link)
                            .map((s) => `• <@${s.userId}>: ${s.link}`)
                            .join("\n"),
                      },
                    },
                  ]
                : []),
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "✅ We Met!",
                    },
                    style: "primary",
                    action_id: "coffee_chat_confirm_meetup",
                    value: pairing._id.toString(),
                  },
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "⏭️ Skip Next Time",
                    },
                    action_id: "coffee_chat_skip_next",
                    value: pairing.channelId,
                  },
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "⏸️ Pause Future Pairings",
                    },
                    style: "danger",
                    action_id: "coffee_chat_opt_out",
                    value: pairing.channelId,
                  },
                ],
              },
            ],
          });

          // Mark reminder as sent
          await CoffeeChatPairingModel.updateOne(
            { _id: pairing._id },
            { midpointReminderSent: true },
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
    }

    logWithTime(
      `✅ Completed sending ${totalPairingsNeedingReminder} midway reminder(s)`,
    );
  } catch (error) {
    logWithTime(`Error sending midway reminders: ${error}`);
  }
};

// ___________________________________________________________________________________
/**
 * Registers a channel for coffee chat pairings
 */
export const registerCoffeeChatChannel = async (
  channelId: string,
  channelName: string,
  pairingFrequencyDays: number = DEFAULT_PAIRING_FREQUENCY_DAYS,
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
    pairingFrequencyDays,
  });

  await config.save();
  logWithTime(`✅ Registered ${channelName} for coffee chat pairings`);
};

/**
 * Starts coffee chat pairings for a channel (begins the pairing cycle)
 */
export const startCoffeeChats = async (channelId: string): Promise<void> => {
  const config = await CoffeeChatConfigModel.findOne({ channelId });
  if (!config) {
    logWithTime(
      `Channel with ID ${channelId} is not registered for coffee chats`,
    );
    return;
  }

  if (!config.isActive) {
    await CoffeeChatConfigModel.updateOne({ channelId }, { isActive: true });
    logWithTime(`Re-activated coffee chats for channel ${channelId}`);
  }

  const now = moment().tz("America/New_York").startOf("day").toDate();
  const nextPairingDate = moment()
    .tz("America/New_York")
    .add(config.pairingFrequencyDays, "days")
    .startOf("day")
    .toDate();

  await CoffeeChatConfigModel.updateOne(
    { channelId },
    {
      lastPairingDate: now,
      nextPairingDate,
    },
  );

  await createCoffeeChatsForChannel(config);

  logWithTime(`✅ Started and created coffee chats for channel ${channelId}`);
};

/**
 * Pauses coffee chat pairings for a channel (stops automatic scheduling)
 */
export const pauseCoffeeChats = async (channelId: string): Promise<void> => {
  await CoffeeChatConfigModel.updateOne({ channelId }, { isActive: false });

  logWithTime(`⏸️ Paused coffee chats for channel ${channelId}`);
};

/**
 * Opts a user out of coffee chats for a specific channel
 */
export const optOutOfCoffeeChats = async (
  userId: string,
  channelId: string,
): Promise<void> => {
  await CoffeeChatUserPreferenceModel.findOneAndUpdate(
    { userId, channelId },
    { isOptedIn: false, skipNextPairing: false },
    { upsert: true },
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
  await CoffeeChatUserPreferenceModel.findOneAndUpdate(
    { userId, channelId },
    { isOptedIn: true, skipNextPairing: false },
    { upsert: true },
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
 * Confirms that a pairing met up
 */
export const confirmMeetup = async (pairingId: string): Promise<void> => {
  await CoffeeChatPairingModel.findByIdAndUpdate(pairingId, {
    meetupConfirmed: true,
  });

  logWithTime(`Meetup confirmed for pairing ${pairingId}`);
};

/**
 * Sets a user to skip the next pairing
 */
export const skipNextPairing = async (
  userId: string,
  channelId: string,
): Promise<void> => {
  await CoffeeChatUserPreferenceModel.findOneAndUpdate(
    { userId, channelId },
    { skipNextPairing: true },
    { upsert: true },
  );

  logWithTime(`User ${userId} will skip next pairing in channel ${channelId}`);
};

/**
 * Clears the skip flag for users in a specific channel
 */
export const clearSkipFlags = async (channelId: string): Promise<void> => {
  const result = await CoffeeChatUserPreferenceModel.updateMany(
    { channelId, skipNextPairing: true },
    { skipNextPairing: false },
  );

  if (result.modifiedCount > 0) {
    logWithTime(
      `Cleared skip flags for ${result.modifiedCount} user(s) in channel ${channelId}`,
    );
  }
};
