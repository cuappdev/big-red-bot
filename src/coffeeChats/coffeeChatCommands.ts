import { App } from "@slack/bolt";
import moment from "moment-timezone";
import {
  processCoffeeChatChannel,
  registerCoffeeChatChannel,
  getCoffeeChatsOptInStatus,
  startCoffeeChats,
  pauseCoffeeChats,
} from "./coffeeChatService";
import {
  CoffeeChatConfigModel,
  CoffeeChatPairingModel,
  CoffeeChatUserPreferenceModel,
} from "./coffeeChatModels";
import { DEFAULT_PAIRING_FREQUENCY_DAYS } from "../app";

/**
 * Checks if a user is a workspace admin or owner
 */
const isUserAdmin = async (slackbot: App, userId: string): Promise<boolean> => {
  try {
    const userInfo = await slackbot.client.users.info({ user: userId });
    return (
      userInfo.user?.is_admin ||
      userInfo.user?.is_owner ||
      userInfo.user?.is_primary_owner ||
      false
    );
  } catch {
    return false;
  }
};

export function registerCoffeeChatCommands(slackbot: App) {
  // Command to register a channel for coffee chats
  slackbot.command("/register-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    // Check if user is admin
    const isAdmin = await isUserAdmin(slackbot, command.user_id);
    if (!isAdmin) {
      await slackbot.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ Only workspace admins can register channels for coffee chats.`,
      });
      return;
    }

    try {
      const channelId = command.channel_id;
      const channelInfo = await slackbot.client.conversations.info({
        channel: channelId,
      });

      const channelName = channelInfo.channel?.name || channelId;

      // Parse frequency from command text (optional)
      let pairingFrequencyDays = DEFAULT_PAIRING_FREQUENCY_DAYS;
      const text = command.text.trim();
      if (text) {
        const parsed = parseInt(text, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 365) {
          pairingFrequencyDays = parsed;
        } else {
          await say({
            text: `❌ Invalid frequency. Please provide a number between 1 and 365 days.`,
          });
          return;
        }
      }

      await registerCoffeeChatChannel(
        channelId,
        channelName,
        pairingFrequencyDays,
      );

      const frequencyText =
        pairingFrequencyDays === 7
          ? "weekly"
          : pairingFrequencyDays === 14
            ? "biweekly"
            : pairingFrequencyDays === 30
              ? "monthly"
              : `every ${pairingFrequencyDays} days`;

      await say(
        `✅ This channel has been registered for ${frequencyText} coffee chat pairings! Use \`/start-coffee-chats\` to begin the pairing cycle.`,
      );
    } catch (error) {
      await say(`❌ Error registering channel: ${error}`);
    }
  });

  // Command to manually trigger coffee chats for a channel
  slackbot.command("/trigger-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    // Check if user is admin
    const isAdmin = await isUserAdmin(slackbot, command.user_id);
    if (!isAdmin) {
      await slackbot.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ Only workspace admins can manually trigger coffee chats.`,
      });
      return;
    }

    try {
      const channelId = command.channel_id;
      const config = await CoffeeChatConfigModel.findOne({ channelId });

      if (!config) {
        await say(
          `❌ This channel is not registered for coffee chats. Use \`/register-coffee-chats\` first.`,
        );
        return;
      }

      await processCoffeeChatChannel(config);
    } catch (error) {
      await say(`❌ Error triggering coffee chats: ${error}`);
    }
  });

  // Command to disable coffee chats for a channel
  slackbot.command("/disable-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    // Check if user is admin
    const isAdmin = await isUserAdmin(slackbot, command.user_id);
    if (!isAdmin) {
      await slackbot.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ Only workspace admins can disable coffee chats.`,
      });
      return;
    }

    try {
      const channelId = command.channel_id;
      const result = await CoffeeChatConfigModel.updateOne(
        { channelId },
        { isActive: false },
      );

      if (result.modifiedCount === 0) {
        await say(`❌ This channel is not registered for coffee chats.`);
        return;
      }

      await say(`✅ Coffee chat pairings have been disabled for this channel.`);
    } catch (error) {
      await say(`❌ Error disabling coffee chats: ${error}`);
    }
  });

  // Command to start coffee chats (begin the pairing cycle)
  slackbot.command("/start-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    // Check if user is admin
    const isAdmin = await isUserAdmin(slackbot, command.user_id);
    if (!isAdmin) {
      await slackbot.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ Only workspace admins can start coffee chats.`,
      });
      return;
    }

    try {
      const channelId = command.channel_id;
      const config = await CoffeeChatConfigModel.findOne({ channelId });

      if (!config) {
        await say({
          text: `❌ This channel is not registered for coffee chats. Use \`/register-coffee-chats\` first.`,
        });
        return;
      }

      if (config.isActive) {
        await say({
          text: `❌ Coffee chats are already running in this channel. Use \`/pause-coffee-chats\` to pause them.`,
        });
        return;
      }

      // Start the coffee chats and create first pairing
      await startCoffeeChats(channelId);
      await processCoffeeChatChannel(config);

      const nextPairingDate = moment()
        .tz("America/New_York")
        .add(config.pairingFrequencyDays, "days");

      const frequencyText =
        config.pairingFrequencyDays === 7
          ? "weekly"
          : config.pairingFrequencyDays === 14
            ? "biweekly"
            : config.pairingFrequencyDays === 30
              ? "monthly"
              : `every ${config.pairingFrequencyDays} days`;

      await say({
        text: "Coffee chats have been started!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ Coffee chats have been started (${frequencyText})! The first pairings have been created.`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📅 Next automatic pairing will be on ${nextPairingDate.format("dddd (MMM Do)")} at ${nextPairingDate.format("h:mm A z")}`,
            },
          },
        ],
      });
    } catch (error) {
      await say(`❌ Error starting coffee chats: ${error}`);
    }
  });

  // Command to pause coffee chats (stop automatic scheduling)
  slackbot.command("/pause-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    // Check if user is admin
    const isAdmin = await isUserAdmin(slackbot, command.user_id);
    if (!isAdmin) {
      await slackbot.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ Only workspace admins can pause coffee chats.`,
      });
      return;
    }

    try {
      const channelId = command.channel_id;
      const config = await CoffeeChatConfigModel.findOne({ channelId });

      if (!config) {
        await say({
          text: `❌ This channel is not registered for coffee chats.`,
        });
        return;
      }

      if (!config.isActive) {
        await say({
          text: `❌ Coffee chats are not currently running. Use \`/start-coffee-chats\` to begin.`,
        });
        return;
      }

      await pauseCoffeeChats(channelId);

      await say({
        text: "Coffee chats have been paused.",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `⏸️ Coffee chats have been paused. No new automatic pairings will be created.`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Use \`/start-coffee-chats\` to resume automatic pairings.`,
            },
          },
        ],
      });
    } catch (error) {
      await say(`❌ Error pausing coffee chats: ${error}`);
    }
  });

  // Command to check coffee chat opt-in status
  slackbot.command("/coffee-chat-status", async ({ command, ack, say }) => {
    await ack();

    try {
      const userId = command.user_id;

      // Get all registered coffee chat channels
      const allConfigs = await CoffeeChatConfigModel.find({ isActive: true });

      if (allConfigs.length === 0) {
        await say({
          text: `❌ No coffee chat channels are currently registered.`,
        });
        return;
      }

      // Get status for all channels
      const statusLines: string[] = [];
      for (const config of allConfigs) {
        const isOptedIn = await getCoffeeChatsOptInStatus(
          userId,
          config.channelId,
        );
        const statusEmoji = isOptedIn ? "✅" : "⏸️";
        const statusText = isOptedIn ? "Opted in" : "Opted out";
        statusLines.push(
          `${statusEmoji} <#${config.channelId}>: ${statusText}`,
        );
      }

      await say({
        text: `Your coffee chat status across all channels`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "☕ Your Coffee Chat Status",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: statusLines.join("\n"),
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Use the buttons in your pairing DMs to change your status for specific channels.",
              },
            ],
          },
        ],
      });
    } catch (error) {
      await say(`❌ Error checking coffee chat status: ${error}`);
    }
  });

  // Command to reset all coffee chat data and start fresh
  slackbot.command("/reset-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    // Check if user is admin
    const isAdmin = await isUserAdmin(slackbot, command.user_id);
    if (!isAdmin) {
      await slackbot.client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: `❌ Only workspace admins can reset coffee chats.`,
      });
      return;
    }

    try {
      const channelId = command.channel_id;

      // Check if channel is registered for coffee chats
      const config = await CoffeeChatConfigModel.findOne({ channelId });
      if (!config) {
        await say({
          text: `❌ This channel is not registered for coffee chats. Use \`/register-coffee-chats\` first.`,
        });
        return;
      }

      // Delete all pairings for this channel
      const pairingsDeleted = await CoffeeChatPairingModel.deleteMany({
        channelId,
      });

      // Delete all user preferences for this channel
      const preferencesDeleted = await CoffeeChatUserPreferenceModel.deleteMany(
        { channelId },
      );

      // Reset the lastPairingDate in config
      await CoffeeChatConfigModel.updateOne(
        { channelId },
        { $unset: { lastPairingDate: "" } },
      );

      await say({
        text: `✅ Coffee chats have been reset for this channel!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ *Coffee chats have been reset!*\n\n*Deleted:*\n• ${pairingsDeleted.deletedCount} pairing(s)\n• ${preferencesDeleted.deletedCount} user preference(s)\n• Reset last pairing date\n\nYou can now start fresh with coffee chat pairings.`,
            },
          },
        ],
      });
    } catch (error) {
      await say(`❌ Error resetting coffee chats: ${error}`);
    }
  });

  // Command to view pairing history
  slackbot.command("/my-coffee-chats", async ({ command, ack, say }) => {
    await ack();

    try {
      const userId = command.user_id;

      // Find all pairings that include this user across all channels
      const pairings = await CoffeeChatPairingModel.find({
        userIds: userId,
      }).sort({ createdAt: -1 });

      if (pairings.length === 0) {
        await say({
          text: `You haven't been paired with anyone yet.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `☕ You haven't been paired with anyone yet. Stay tuned for your first coffee chat!`,
              },
            },
          ],
        });
        return;
      }

      // Build the history message grouped by channel
      const pairingsByChannel = new Map<string, typeof pairings>();
      for (const pairing of pairings) {
        if (!pairingsByChannel.has(pairing.channelId)) {
          pairingsByChannel.set(pairing.channelId, []);
        }
        pairingsByChannel.get(pairing.channelId)!.push(pairing);
      }

      const historyLines: string[] = [];
      for (const [channelId, channelPairings] of pairingsByChannel) {
        historyLines.push(
          `\n*<#${channelId}>* (${channelPairings.length} pairing${channelPairings.length !== 1 ? "s" : ""}):`,
        );

        for (const pairing of channelPairings) {
          const partners = pairing.userIds
            .filter((id) => id !== userId)
            .map((id) => `<@${id}>`)
            .join(", ");

          const date = moment(pairing.createdAt)
            .tz("America/New_York")
            .format("MMM D, YYYY");

          let status = "";
          if (pairing.isActive) {
            status = "🟢 Active";
          } else if (pairing.meetupConfirmed) {
            status = "✅ Met";
          } else {
            status = "❌ Did not meet";
          }

          historyLines.push(`  • ${date} - ${partners} ${status}`);
        }
      }

      await say({
        text: `Your coffee chat history`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "☕ Your Coffee Chat History",
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You've been paired *${pairings.length} time${pairings.length !== 1 ? "s" : ""}* across all channels:${historyLines.join("\n")}`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "🟢 Active pairing • ✅ Met • ❌ Did not meet",
              },
            ],
          },
        ],
      });
    } catch (error) {
      await say(`❌ Error retrieving pairing history: ${error}`);
    }
  });
}
