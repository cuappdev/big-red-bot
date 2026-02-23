import { getModelForClass, prop } from "@typegoose/typegoose";

class CoffeeChatPairing {
  @prop({ required: true })
  channelId!: string;

  @prop({ required: true, type: () => [String] })
  userIds!: string[];

  @prop({ required: true })
  createdAt!: Date;

  @prop()
  notifiedAt?: Date;
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

const CoffeeChatPairingModel = getModelForClass(CoffeeChatPairing);
const CoffeeChatConfigModel = getModelForClass(CoffeeChatConfig);

export {
  CoffeeChatPairing,
  CoffeeChatPairingModel,
  CoffeeChatConfig,
  CoffeeChatConfigModel,
};
