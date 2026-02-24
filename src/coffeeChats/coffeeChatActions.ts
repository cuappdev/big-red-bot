import { App, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { optOutOfCoffeeChats, optInToCoffeeChats } from "./coffeeChatService";

export function registerCoffeeChatActions(slackbot: App) {
  // Action handler for opting out of coffee chats
  slackbot.action(
    "coffee_chat_opt_out",
    async ({ ack, body, respond }: SlackActionMiddlewareArgs<BlockAction>) => {
      await ack();

      try {
        const userId = body.user.id;
        const action = body.actions[0];
        const channelId = ("value" in action ? action.value : "") as string;

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
    },
  );

  // Action handler for opting back into coffee chats
  slackbot.action(
    "coffee_chat_opt_in",
    async ({ ack, body, respond }: SlackActionMiddlewareArgs<BlockAction>) => {
      await ack();

      try {
        const userId = body.user.id;
        const action = body.actions[0];
        const channelId = ("value" in action ? action.value : "") as string;

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
    },
  );
}
