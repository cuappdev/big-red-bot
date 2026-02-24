import { getModelForClass, prop, index } from "@typegoose/typegoose";

class CoffeeChatPairing {
  @prop({ required: true })
  channelId!: string;

  @prop({ required: true, type: () => [String] })
  userIds!: string[];

  @prop({ required: true })
  createdAt!: Date;

  @prop()
  notifiedAt?: Date;

  @prop()
  conversationId?: string;

  @prop({ default: true })
  isActive!: boolean;

  @prop({ default: false })
  reminderSent!: boolean;

  @prop({ default: false })
  photosPosted!: boolean;
}

class CoffeeChatConfig {
  @prop({ required: true, unique: true })
  channelId!: string;

  @prop({ required: true })
  channelName!: string;

  @prop({ default: true })
  isActive!: boolean;

  @prop()
  lastPairingDate?: Date;
}

@index({ userId: 1, channelId: 1 }, { unique: true })
class CoffeeChatUserPreference {
  @prop({ required: true })
  userId!: string;

  @prop({ required: true })
  channelId!: string;

  @prop({ default: true })
  isOptedIn!: boolean;

  @prop()
  updatedAt?: Date;
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
