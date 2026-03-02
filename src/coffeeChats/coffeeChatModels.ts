import { getModelForClass, prop, index } from "@typegoose/typegoose";
import { DEFAULT_PAIRING_FREQUENCY_DAYS } from "../app";

class CoffeeChatPairing {
  // Id of the Slack channel where the pairing is taking place
  @prop({ required: true })
  channelId!: string;

  // List of user IDs in the pairing (usually length 2, sometimes 3 for trio pairings)
  @prop({ required: true, type: () => [String] })
  userIds!: string[];

  @prop({ required: true })
  createdAt!: Date;

  // Always set to createdAt + pairingFrequencyDays - 1 frequency so that pairings are due the day before the next round of pairings is created
  @prop({ required: true })
  dueDate!: Date;

  // DM groupchat id for the pairing, used to send reminders
  @prop()
  conversationId?: string;

  @prop({ default: false })
  midpointReminderSent!: boolean;

  @prop({ default: false })
  meetupConfirmed!: boolean;
}

class CoffeeChatConfig {
  @prop({ required: true, unique: true })
  channelId!: string;

  @prop({ required: true })
  channelName!: string;

  // Flag to enable/disable coffee chats in this channel without deleting the config (when disabled, all isActive pairing fields will be set to false)
  @prop({ default: true })
  isActive!: boolean;

  @prop({ default: DEFAULT_PAIRING_FREQUENCY_DAYS })
  pairingFrequencyDays!: number;

  @prop()
  lastPairingDate?: Date;

  // Always set to lastPairingDate + pairingFrequencyDays
  @prop()
  nextPairingDate?: Date;
}

@index({ userId: 1, channelId: 1 }, { unique: true })
class CoffeeChatUserPreference {
  @prop({ required: true })
  userId!: string;

  @prop({ required: true })
  channelId!: string;

  @prop({ default: true })
  isOptedIn!: boolean;

  @prop({ default: false })
  skipNextPairing!: boolean;
}

const CoffeeChatPairingModel = getModelForClass(CoffeeChatPairing);
const CoffeeChatConfigModel = getModelForClass(CoffeeChatConfig);
const CoffeeChatUserPreferenceModel = getModelForClass(
  CoffeeChatUserPreference,
);

export {
  CoffeeChatPairing,
  CoffeeChatPairingModel,
  CoffeeChatConfig,
  CoffeeChatConfigModel,
  CoffeeChatUserPreference,
  CoffeeChatUserPreferenceModel,
};
