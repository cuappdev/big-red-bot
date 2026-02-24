import { App, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import {
  optOutOfCoffeeChats,
  optInToCoffeeChats,
  confirmMeetup,
  skipNextPairing,
} from "./coffeeChatService";

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

  // Action handler for confirming meetup
  slackbot.action(
    "coffee_chat_confirm_meetup",
    async ({ ack, body, respond }: SlackActionMiddlewareArgs<BlockAction>) => {
      await ack();

      try {
        const action = body.actions[0];
        const pairingId = ("value" in action ? action.value : "") as string;

        await confirmMeetup(pairingId);

        await respond({
          text: `Thanks for confirming! 🎉`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ Awesome! Thanks for confirming your meetup. We hope you had a great time! 🎉`,
              },
            },
          ],
          replace_original: false,
        });
      } catch (error) {
        await respond({
          text: `❌ Error confirming meetup: ${error}`,
          replace_original: false,
        });
      }
    },
  );

  // Action handler for skipping the next pairing
  slackbot.action(
    "coffee_chat_skip_next",
    async ({ ack, body, respond }: SlackActionMiddlewareArgs<BlockAction>) => {
      await ack();

      try {
        const userId = body.user.id;
        const action = body.actions[0];
        const channelId = ("value" in action ? action.value : "") as string;

        await skipNextPairing(userId, channelId);

        await respond({
          text: `You'll skip the next pairing.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ Got it! You'll skip the next coffee chat pairing. You'll automatically be included in the round after that.`,
              },
            },
          ],
          replace_original: false,
        });
      } catch (error) {
        await respond({
          text: `❌ Error skipping next pairing: ${error}`,
          replace_original: false,
        });
      }
    },
  );
}
