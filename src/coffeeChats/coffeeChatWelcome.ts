import { App } from "@slack/bolt";
import { logWithTime } from "../utils/timeUtils";

const COFFEE_CHATS_CHANNEL_ID = "CFRBCMM71";

/**
 * Registers the team_join event handler that sends a welcome DM to new workspace members,
 * letting them know about the coffee chats channel.
 */
export function registerWelcomeHandler(slackbot: App) {
  slackbot.event("team_join", async ({ event, client }) => {
    const userId = event.user.id;

    try {
      // Open a DM with the new user
      const dm = await client.conversations.open({ users: userId });
      if (!dm.ok || !dm.channel?.id) {
        logWithTime(`Failed to open DM with new user ${userId}`);
        return;
      }

      const channelText = `<#${COFFEE_CHATS_CHANNEL_ID}>`;

      await client.chat.postMessage({
        channel: dm.channel.id,
        text: `Welcome to Cornell AppDev, <@${userId}>! 🎉 Join ${channelText} to get paired with teammates for coffee chats.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:wave: Welcome to *Cornell AppDev*, <@${userId}>! We're really glad you're here.`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:coffee: *Get to know your teammates through coffee chats!*\n\nJoin ${channelText} to be automatically paired with a teammate every couple of weeks for a casual chat, coffee run, or whatever sounds fun. It's a great way to meet people across the team.`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `:bulb: *How it works:*\n• Join ${channelText}\n• You'll be paired with someone new every round\n• I will DM you with your match and a suggested activity\n• Meet up, have fun, and confirm your meetup when done! ✅\n• 📸 Snap some photos and share them in ${channelText} to celebrate your meetup!`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `See you in ${channelText}! ☕`,
            },
          },
        ],
      });

      logWithTime(`Sent welcome message to new user ${userId}`);
    } catch (error) {
      logWithTime(`Error sending welcome message to user ${userId}: ${error}`);
    }
  });
}
