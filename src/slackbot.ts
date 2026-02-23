import { App } from "@slack/bolt";
import {
  processCoffeeChatChannel,
  registerCoffeeChatChannel,
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

    await say(`☕ Generating coffee chat pairings...`);
    await processCoffeeChatChannel(config);
    await say(`✅ Coffee chat pairings have been sent via DM!`);
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

export default slackbot;
