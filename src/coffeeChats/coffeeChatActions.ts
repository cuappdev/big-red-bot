import { App, BlockAction, SlackActionMiddlewareArgs } from "@slack/bolt";
import { KnownBlock } from "@slack/types";
import {
  optOutOfCoffeeChats,
  optInToCoffeeChats,
  confirmMeetup,
  skipNextPairing,
  setTrioPairingPreference,
  getTrioPairingPreference,
} from "./coffeeChatService";
import { CoffeeChatPairingModel } from "./coffeeChatModels";

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
          replace_original: true,
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
            {
              type: "actions",
              elements: [
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
                    text: "🚫 Opt Out",
                  },
                  style: "danger",
                  action_id: "coffee_chat_opt_out",
                  value: channelId,
                },
              ],
            },
          ],
          replace_original: true,
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
        const userId = body.user.id;
        const action = body.actions[0];
        const pairingId = ("value" in action ? action.value : "") as string;

        // Verify the user clicking the button is actually part of this pairing
        const pairing = await CoffeeChatPairingModel.findById(pairingId);
        if (!pairing) {
          await respond({
            text: `❌ Pairing not found.`,
            replace_original: false,
          });
          return;
        }
        if (!pairing.userIds.includes(userId)) {
          await respond({
            text: `❌ You can only confirm meetups that you are part of.`,
            replace_original: false,
          });
          return;
        }

        await confirmMeetup(pairingId);

        const confirmationSections: KnownBlock[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ Awesome! Thanks for confirming your meetup. We hope you had a great time! 🎉`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📸 Don't forget to share any photos from your meetup in the channel to celebrate!`,
            },
          },
        ];

        // Update the original message for everyone in the DM using chat.update,
        // so both (or all) participants see the buttons replaced with the confirmation.
        const channelId = body.channel?.id;
        const messageTs = body.message?.ts;
        const originalBlocks: KnownBlock[] =
          (body.message?.blocks as KnownBlock[]) ?? [];

        // Keep all original blocks except the actions block, then append confirmation
        const updatedBlocks: KnownBlock[] = [
          ...originalBlocks.filter((b) => b.type !== "actions"),
          ...confirmationSections,
        ];

        if (channelId && messageTs) {
          await slackbot.client.chat.update({
            channel: channelId,
            ts: messageTs,
            text: `Thanks for confirming! 🎉`,
            blocks: updatedBlocks,
          });
        } else {
          // Fallback: reply only to the person who clicked
          await respond({
            text: `Thanks for confirming! 🎉`,
            blocks: updatedBlocks,
            replace_original: true,
          });
        }
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
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "↩️ Undo Skip",
                  },
                  style: "primary",
                  action_id: "coffee_chat_opt_in",
                  value: channelId,
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "🚫 Opt Out",
                  },
                  style: "danger",
                  action_id: "coffee_chat_opt_out",
                  value: channelId,
                },
              ],
            },
          ],
          replace_original: true,
        });
      } catch (error) {
        await respond({
          text: `❌ Error skipping next pairing: ${error}`,
          replace_original: false,
        });
      }
    },
  );

  // Action handler for toggling the 3-person (trio) pairing preference
  slackbot.action(
    "coffee_chat_trio_toggle",
    async ({ ack, body, respond }: SlackActionMiddlewareArgs<BlockAction>) => {
      await ack();

      try {
        const userId = body.user.id;
        const action = body.actions[0];
        const channelId = ("value" in action ? action.value : "") as string;

        const currentPref = await getTrioPairingPreference(userId, channelId);
        const newPref = !currentPref;
        await setTrioPairingPreference(userId, channelId, newPref);

        await respond({
          text: newPref
            ? `You've opted in for 3-person coffee chats!`
            : `You've switched back to 1-on-1 pairings.`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: newPref
                  ? `✅ You've opted in for *3-person coffee chats*! When possible, you'll be grouped with two others.`
                  : `✅ You've switched back to *1-on-1 pairings*. You'll be paired with one other person each round.`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: newPref
                      ? "👫 Switch to 1-on-1"
                      : "👥 Prefer 3-Person Chat",
                  },
                  action_id: "coffee_chat_trio_toggle",
                  value: channelId,
                },
              ],
            },
          ],
          replace_original: true,
        });
      } catch (error) {
        await respond({
          text: `❌ Error updating 3-person pairing preference: ${error}`,
          replace_original: false,
        });
      }
    },
  );
}
