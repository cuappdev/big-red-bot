import { App } from "@slack/bolt";
import {
  processCoffeeChatChannel,
  registerCoffeeChatChannel,
  optOutOfCoffeeChats,
  optInToCoffeeChats,
  getCoffeeChatsOptInStatus,
} from "./coffeeChats/controllers";
import { CoffeeChatConfigModel } from "./coffeeChats/models";

const slackbot = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

slackbot.message("hello", async ({ message, say }: any) => {
  await say(`Hey there <@${message.user}>!`);
});

// Action handler for opting out of coffee chats
slackbot.action("coffee_chat_opt_out", async ({ ack, body, respond }: any) => {
  await ack();

  try {
    const userId = body.user.id;
    const channelId = body.actions[0].value;

    await optOutOfCoffeeChats(userId, channelId);

    await respond({
      text: `You've been opted out of future coffee chat pairings.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ You've been opted out of future coffee chat pairings. You won't be included in upcoming rounds.`,
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
      replace_original: false,
    });
  } catch (error) {
    await respond({
      text: `❌ Error opting out of coffee chats: ${error}`,
      replace_original: false,
    });
  }
});

// Action handler for opting back into coffee chats
slackbot.action("coffee_chat_opt_in", async ({ ack, body, respond }: any) => {
  await ack();

  try {
    const userId = body.user.id;
    const channelId = body.actions[0].value;

    await optInToCoffeeChats(userId, channelId);

    await respond({
      text: `You've been opted back into coffee chat pairings!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ Welcome back! You've been opted back into coffee chat pairings. You'll be included in future rounds.`,
          },
        },
      ],
      replace_original: false,
    });
  } catch (error) {
    await respond({
      text: `❌ Error opting into coffee chats: ${error}`,
      replace_original: false,
    });
  }
});

// Command to register a channel for coffee chats
slackbot.command("/register-coffee-chats", async ({ command, ack, say }) => {
  await ack();

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

export default slackbot;
