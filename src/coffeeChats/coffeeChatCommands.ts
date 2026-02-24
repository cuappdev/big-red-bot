import { App } from "@slack/bolt";
import moment from "moment-timezone";
import {
  processCoffeeChatChannel,
  registerCoffeeChatChannel,
  getCoffeeChatsOptInStatus,
} from "./coffeeChatService";
import {
  CoffeeChatConfigModel,
  CoffeeChatPairingModel,
  CoffeeChatUserPreferenceModel,
} from "./coffeeChatModels";

/**
 * Checks if a user is a workspace admin or owner
 */
const isUserAdmin = async (
  slackbot: App,
  userId: string,
): Promise<boolean> => {
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
      await say(
        `❌ Only workspace admins can register channels for coffee chats.`,
      );
      return;
    }

    try {
      const channelId = command.channel_id;
      const channelInfo = await slackbot.client.conversations.info({
        channel: channelId,
      });

      const channelName = channelInfo.channel?.name || channelId;

      await registerCoffeeChatChannel(channelId, channelName);

      await say(
        `✅ This channel has been registered for biweekly coffee chat pairings! Members will be paired every two weeks.`,
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
      await say(
        `❌ Only workspace admins can manually trigger coffee chats.`,
      );
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
      await say(`❌ Only workspace admins can disable coffee chats.`);
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

  // Command to check coffee chat opt-in status
  slackbot.command("/coffee-chat-status", async ({ command, ack, say }) => {
    await ack();

    try {
      const userId = command.user_id;
      const channelId = command.channel_id;

      // Check if channel is registered for coffee chats
      const config = await CoffeeChatConfigModel.findOne({ channelId });
      if (!config) {
        await say({
          text: `❌ This channel is not registered for coffee chats.`,
        });
        return;
      }

      const isOptedIn = await getCoffeeChatsOptInStatus(userId, channelId);

      if (isOptedIn) {
        await say({
          text: `You are currently opted in to coffee chats.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `☕ You are currently *opted in* to coffee chats in this channel.`,
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
      } else {
        await say({
          text: `You are currently opted out of coffee chats.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `You are currently *opted out* of coffee chats in this channel.`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "▶️ Resume Pairings",
                  },
                  style: "primary",
                  action_id: "coffee_chat_opt_in",
                  value: channelId,
                },
              ],
            },
          ],
        });
      }
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
      await say(`❌ Only workspace admins can reset coffee chats.`);
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
      const channelId = command.channel_id;

      // Check if channel is registered for coffee chats
      const config = await CoffeeChatConfigModel.findOne({ channelId });
      if (!config) {
        await say({
          text: `❌ This channel is not registered for coffee chats.`,
        });
        return;
      }

      // Find all pairings that include this user in this channel
      const pairings = await CoffeeChatPairingModel.find({
        channelId,
        userIds: userId,
      }).sort({ createdAt: -1 });

      if (pairings.length === 0) {
        await say({
          text: `You haven't been paired with anyone yet in this channel.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `☕ You haven't been paired with anyone yet in this channel. Stay tuned for your first coffee chat!`,
              },
            },
          ],
        });
        return;
      }

      // Build the history message
      const historyLines: string[] = [];

      for (const pairing of pairings) {
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

        historyLines.push(`• ${date} - ${partners} ${status}`);
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
              text: `You've been paired *${pairings.length} time${pairings.length !== 1 ? "s" : ""}* in this channel:\n\n${historyLines.join("\n")}`,
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
