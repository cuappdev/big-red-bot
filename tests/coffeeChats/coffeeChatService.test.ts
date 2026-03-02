// Mock dependencies first
// Mock app module to prevent unnecessary imports and side effects during testing
jest.mock("../../src/app", () => ({}));

// Mock slack dependencies to ensure tests run without actual Slack API calls
jest.mock("../../src/slackbot", () => {
  const mockConversationsMembers = jest
    .fn()
    .mockResolvedValue({ ok: true, members: [] });
  const mockConversationsOpen = jest
    .fn()
    .mockResolvedValue({ ok: true, channel: { id: "D12345" } });
  const mockUsersInfo = jest
    .fn()
    .mockResolvedValue({ ok: true, user: { is_bot: false } });
  const mockChatPostMessage = jest
    .fn()
    .mockResolvedValue({ ok: true, ts: "1234567890.123456" });

  return {
    default: {
      client: {
        conversations: {
          members: mockConversationsMembers,
          open: mockConversationsOpen,
        },
        users: {
          info: mockUsersInfo,
        },
        chat: {
          postMessage: mockChatPostMessage,
        },
      },
    },
    __esModule: true,
  };
});

// Make sure nothing is logged
jest.mock("../../src/utils/timeUtils", () => ({
  logWithTime: jest.fn(),
}));

import * as coffeeChatService from "../../src/coffeeChats/coffeeChatService";
import moment from "moment-timezone";
import {
  CoffeeChatConfigModel,
  CoffeeChatPairing,
  CoffeeChatPairingModel,
  CoffeeChatUserPreferenceModel,
} from "../../src/coffeeChats/coffeeChatModels";

describe("coffeeChatService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerCoffeeChatChannel", () => {
    it("should register a new coffee chat channel with default settings", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      // Call the function
      await coffeeChatService.registerCoffeeChatChannel(
        mockChannelId,
        mockChannelName,
        mockPairingFrequencyDays,
      );

      // Verify the channel was registered in the database
      const config = await CoffeeChatConfigModel.findOne({
        channelId: mockChannelId,
      });
      expect(config).not.toBeNull();
      expect(config?.channelId).toBe(mockChannelId);
      expect(config?.channelName).toBe(mockChannelName);
      expect(config?.isActive).toBe(true);
      expect(config?.pairingFrequencyDays).toBe(mockPairingFrequencyDays);
    });

    it("should not register a channel that already exists", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";

      // Create an existing config
      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: 14,
      }).save();

      const countBefore = await CoffeeChatConfigModel.countDocuments({
        channelId: mockChannelId,
      });

      // Try to register the same channel again
      await coffeeChatService.registerCoffeeChatChannel(
        mockChannelId,
        mockChannelName,
      );

      // Verify no duplicate was created
      const countAfter = await CoffeeChatConfigModel.countDocuments({
        channelId: mockChannelId,
      });
      expect(countAfter).toBe(countBefore);
    });
  });

  describe("startCoffeeChats", () => {
    it("should start coffee chats for a registered channel", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      // Create a config for the channel
      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Call the function
      await coffeeChatService.startCoffeeChats(mockChannelId);

      const config = await CoffeeChatConfigModel.findOne({
        channelId: mockChannelId,
      });
      expect(config).not.toBeNull();
      expect(config?.channelId).toBe(mockChannelId);
      expect(config?.channelName).toBe(mockChannelName);
      expect(config?.isActive).toBe(true);
      expect(config?.pairingFrequencyDays).toBe(mockPairingFrequencyDays);
      expect(config?.lastPairingDate).toStrictEqual(
        moment().tz("America/New_York").startOf("day").toDate(),
      );
      expect(config?.nextPairingDate).toStrictEqual(
        moment()
          .tz("America/New_York")
          .add(mockPairingFrequencyDays, "days")
          .startOf("day")
          .toDate(),
      );
    });

    it("should not start coffee chats for an unregistered channel", async () => {
      const mockChannelId = "C99999"; // This channel ID does not exist

      // Call the function
      await coffeeChatService.startCoffeeChats(mockChannelId);

      const config = await CoffeeChatConfigModel.findOne({
        channelId: mockChannelId,
      });
      expect(config).toBeNull();
    });

    it("should reactivate coffee chats for an inactive channel", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      // Create an inactive config for the channel
      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: false,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Call the function
      await coffeeChatService.startCoffeeChats(mockChannelId);

      // Verify that the channel was reactivated
      const config = await CoffeeChatConfigModel.findOne({
        channelId: mockChannelId,
      });
      expect(config).not.toBeNull();
      expect(config?.channelId).toBe(mockChannelId);
      expect(config?.channelName).toBe(mockChannelName);
      expect(config?.isActive).toBe(true);
      expect(config?.pairingFrequencyDays).toBe(mockPairingFrequencyDays);
      expect(config?.lastPairingDate).toStrictEqual(
        moment().tz("America/New_York").startOf("day").toDate(),
      );
      expect(config?.nextPairingDate).toStrictEqual(
        moment()
          .tz("America/New_York")
          .add(mockPairingFrequencyDays, "days")
          .startOf("day")
          .toDate(),
      );
    });
  });

  describe("pauseCoffeeChats", () => {
    it("should pause coffee chats for a channel", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      await coffeeChatService.pauseCoffeeChats(mockChannelId);

      const config = await CoffeeChatConfigModel.findOne({
        channelId: mockChannelId,
      });
      expect(config).not.toBeNull();
      expect(config?.channelId).toBe(mockChannelId);
      expect(config?.channelName).toBe(mockChannelName);
      expect(config?.isActive).toBe(false);
      expect(config?.pairingFrequencyDays).toBe(mockPairingFrequencyDays);
    });
  });

  describe("optOutOfCoffeeChats", () => {
    it("should opt out a user from coffee chats", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Call the function
      await coffeeChatService.optOutOfCoffeeChats(mockUserId, mockChannelId);

      // Verify the preference was saved in the database
      const preference = await CoffeeChatUserPreferenceModel.findOne({
        userId: mockUserId,
        channelId: mockChannelId,
      });
      expect(preference).not.toBeNull();
      expect(preference?.isOptedIn).toBe(false);
      expect(preference?.skipNextPairing).toBe(false);
    });
  });

  describe("optInToCoffeeChats", () => {
    it("should opt in a user to coffee chats", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Call the function
      await coffeeChatService.optInToCoffeeChats(mockUserId, mockChannelId);

      // Verify the preference was saved in the database
      const preference = await CoffeeChatUserPreferenceModel.findOne({
        userId: mockUserId,
        channelId: mockChannelId,
      });
      expect(preference).not.toBeNull();
      expect(preference?.isOptedIn).toBe(true);
      expect(preference?.skipNextPairing).toBe(false);
    });
  });

  describe("getCoffeeChatsOptInStatus", () => {
    it("should return true when user is opted in", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Create an opted-in preference
      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: mockUserId,
        isOptedIn: true,
      }).save();

      // Call the function
      const result = await coffeeChatService.getCoffeeChatsOptInStatus(
        mockUserId,
        mockChannelId,
      );

      // Verify the result
      expect(result).toBe(true);
    });

    it("should return true when user preference does not exist (default opt-in)", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Call the function without creating a preference first
      const result = await coffeeChatService.getCoffeeChatsOptInStatus(
        mockUserId,
        mockChannelId,
      );

      // Verify the result - should default to true
      expect(result).toBe(true);
    });

    it("should return false when user is opted out", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Create an opted-out preference
      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: mockUserId,
        isOptedIn: false,
      }).save();

      // Call the function
      const result = await coffeeChatService.getCoffeeChatsOptInStatus(
        mockUserId,
        mockChannelId,
      );

      // Verify the result
      expect(result).toBe(false);
    });
  });

  describe("confirmMeetup", () => {
    it("should mark a pairing as confirmed", async () => {
      const mockChannelId = "C12345";
      const now = new Date();
      const dueDate = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000); // 13 days from now

      // Create a pairing in the database
      const pairing = await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U12345", "U67890"],
        createdAt: now,
        dueDate: dueDate,
        meetupConfirmed: false,
      }).save();

      // Call the function
      await coffeeChatService.confirmMeetup(pairing._id.toString());

      // Verify the pairing was updated in the database
      const updatedPairing = await CoffeeChatPairingModel.findById(pairing._id);
      expect(updatedPairing).not.toBeNull();
      expect(updatedPairing?.channelId).toBe(mockChannelId);
      expect(updatedPairing?.userIds).toStrictEqual(["U12345", "U67890"]);
      expect(updatedPairing?.createdAt).toStrictEqual(now);
      expect(updatedPairing?.dueDate).toStrictEqual(dueDate);
      expect(updatedPairing?.meetupConfirmed).toBe(true);
    });
  });

  describe("skipNextPairing", () => {
    it("should set skipNextPairing to true for a user", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Call the function
      await coffeeChatService.skipNextPairing(mockUserId, mockChannelId);

      // Verify the preference was saved in the database
      const preference = await CoffeeChatUserPreferenceModel.findOne({
        userId: mockUserId,
        channelId: mockChannelId,
      });
      expect(preference).not.toBeNull();
      expect(preference?.isOptedIn).toBe(true);
      expect(preference?.skipNextPairing).toBe(true);
    });
  });

  describe("clearSkipFlags", () => {
    it("should set all skipNextPairings to false for a given channel", async () => {
      const mockChannelId = "C12345";
      const mockUserId1 = "U12345";
      const mockUserId2 = "U123456";

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: mockUserId1,
        isOptedIn: true,
        skipNextPairing: true,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: mockUserId2,
        isOptedIn: false,
        skipNextPairing: false,
      }).save();

      await coffeeChatService.clearSkipFlags(mockChannelId);

      const preference1 = await CoffeeChatUserPreferenceModel.findOne({
        channelId: mockChannelId,
        userId: mockUserId1,
      });
      const preference2 = await CoffeeChatUserPreferenceModel.findOne({
        channelId: mockChannelId,
        userId: mockUserId2,
      });

      expect(preference1).not.toBe(null);
      expect(preference1?.isOptedIn).toBe(true);
      expect(preference1?.skipNextPairing).toBe(false);

      expect(preference2).not.toBe(null);
      expect(preference2?.isOptedIn).toBe(false);
      expect(preference2?.skipNextPairing).toBe(false);
    });
  });

  describe("createNewCoffeeChatRounds", () => {
    it("create coffee chats for all active channels", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      // Get the mocked slackbot and configure mocks for this test
      const mockSlackbot = jest.requireMock("../../src/slackbot").default;

      mockSlackbot.client.conversations.members.mockResolvedValue({
        ok: true,
        members: ["U1", "U2", "U3", "U4"],
      });

      mockSlackbot.client.users.info.mockImplementation(
        async ({ user }: { user: string }) => ({
          ok: true,
          user: {
            id: user,
            is_bot: false,
          },
        }),
      );

      mockSlackbot.client.conversations.open.mockResolvedValue({
        ok: true,
        channel: { id: "D12345" },
      });

      mockSlackbot.client.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: "1234567890.123456",
      });

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(2);
      pairings.forEach((pairing: CoffeeChatPairing) => {
        expect(pairing.channelId).toBe(mockChannelId);
        expect(
          moment(pairing.createdAt)
            .tz("America/New_York")
            .startOf("day")
            .toDate(),
        ).toStrictEqual(
          moment().tz("America/New_York").startOf("day").toDate(),
        );
        expect(pairing.dueDate).toStrictEqual(
          moment()
            .tz("America/New_York")
            .add(mockPairingFrequencyDays - 1, "days")
            .endOf("day")
            .toDate(),
        );
        expect(pairing.meetupConfirmed).toBe(false);
        expect(pairing.midpointReminderSent).toBe(false);
        expect(pairing.userIds.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should not create pairings for inactive channels", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: false,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(0);
    });

    it("should not create pairings if nextPairingDate is in the future", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment().tz("America/New_York").add(1, "day").toDate(),
      }).save();

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(0);
    });

    it("should not create pairings if there are already active pairings", async () => {
      const mockChannelId = "C12345";
      const now = new Date();
      const dueDate = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000); // 13 days from now

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: "coffee-chats",
        isActive: true,
        pairingFrequencyDays: 14,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U12345", "U67890"],
        createdAt: now,
        dueDate: dueDate,
        meetupConfirmed: false,
      }).save();

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(1); // Should still only be the original pairing
    });

    it("should not create pairings if there are not enough members", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      // Get the mocked slackbot and configure mocks for this test
      const mockSlackbot = jest.requireMock("../../src/slackbot").default;

      mockSlackbot.client.conversations.members.mockResolvedValue({
        ok: true,
        members: ["U1"], // Only 1 member in the channel
      });

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(0); // Should not create any pairings with less than 2 members
    });

    it("should not create pairings if all members are opted out", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      // Get the mocked slackbot and configure mocks for this test
      const mockSlackbot = jest.requireMock("../../src/slackbot").default;

      mockSlackbot.client.conversations.members.mockResolvedValue({
        ok: true,
        members: ["U1", "U2", "U3"],
      });

      // All members are opted out
      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U1",
        isOptedIn: false,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U2",
        isOptedIn: false,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U3",
        isOptedIn: false,
      }).save();

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(0); // Should not create any pairings if all members are opted out
    });

    it("should create pairings for opted-in members if some members are opted out", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      // Get the mocked slackbot and configure mocks for this test
      const mockSlackbot = jest.requireMock("../../src/slackbot").default;

      mockSlackbot.client.conversations.members.mockResolvedValue({
        ok: true,
        members: ["U1", "U2", "U3", "U4"],
      });

      // 2 members are opted out, 2 are opted in
      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U1",
        isOptedIn: false,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U2",
        isOptedIn: false,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U3",
        isOptedIn: true,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U4",
        isOptedIn: true,
      }).save();

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(1); // Should create 1 pairing with the 2 opted-in members
      pairings.forEach((pairing: CoffeeChatPairing) => {
        expect(pairing.channelId).toBe(mockChannelId);
        expect(pairing.userIds).toContain("U3");
        expect(pairing.userIds).toContain("U4");
      });
    });

    it("should not create pairings if there are not enough opted-in members", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
        nextPairingDate: moment()
          .tz("America/New_York")
          .subtract(1, "second")
          .toDate(),
      }).save();

      // Get the mocked slackbot and configure mocks for this test
      const mockSlackbot = jest.requireMock("../../src/slackbot").default;

      mockSlackbot.client.conversations.members.mockResolvedValue({
        ok: true,
        members: ["U1", "U2", "U3"],
      });

      // Only 1 member is opted in
      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U1",
        isOptedIn: false,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U2",
        isOptedIn: false,
      }).save();

      await new CoffeeChatUserPreferenceModel({
        channelId: mockChannelId,
        userId: "U3",
        isOptedIn: true,
      }).save();

      await coffeeChatService.createNewCoffeeChatRounds();

      const pairings = await CoffeeChatPairingModel.find({
        channelId: mockChannelId,
      });
      expect(pairings).not.toBe(null);
      expect(pairings.length).toBe(0); // Should not create any pairings if there are not enough opted-in members
    });
  });

  describe("reportStats", () => {
    it("should report stats for a channel", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Create some pairings
      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
        createdAt: moment()
          .tz("America/New_York")
          .subtract(10, "days")
          .toDate(),
        dueDate: moment().tz("America/New_York").subtract(9, "days").toDate(),
        meetupConfirmed: true,
      }).save();

      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U3", "U4"],
        createdAt: moment().tz("America/New_York").subtract(5, "days").toDate(),
        dueDate: moment().tz("America/New_York").subtract(4, "days").toDate(),
        meetupConfirmed: false,
      }).save();

      // Call the function
      await coffeeChatService.reportStats();

      // Verify the function posted stats to Slack and logged a success message
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: mockChannelId,
          text: "Coffee Chat Stats",
        }),
      );

      const mockLogWithTime = jest.requireMock(
        "../../src/utils/timeUtils",
      ).logWithTime;

      expect(mockLogWithTime).toHaveBeenCalledWith(
        expect.stringContaining(`Posted stats for channel ${mockChannelName}`),
      );
    });

    it("should not report stats if channel is inactive", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: false,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Call the function
      await coffeeChatService.reportStats();

      // Verify the function did not post stats to Slack and logged an appropriate message
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).not.toHaveBeenCalled();

      const mockLogWithTime = jest.requireMock(
        "../../src/utils/timeUtils",
      ).logWithTime;

      expect(mockLogWithTime).toHaveBeenCalledWith(
        expect.stringContaining(
          `No coffee chat channels are due for stats reporting at this time`,
        ),
      );
    });

    it("should not report stats if there are no pairings", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Call the function
      await coffeeChatService.reportStats();

      // Verify the function did not post stats to Slack and logged an appropriate message
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it("should not report stats if there are no previous pairings", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Create a pairing that is not due for stats reporting
      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
        createdAt: moment().tz("America/New_York").toDate(),
        dueDate: moment().tz("America/New_York").add(1, "day").toDate(),
        meetupConfirmed: true,
      }).save();

      // Call the function
      await coffeeChatService.reportStats();

      // Verify the function did not post stats to Slack and logged an appropriate message
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  it("should not report stats if there is a previous pairing in a round long ago", async () => {
    const mockChannelId = "C12345";
    const mockChannelName = "coffee-chats";
    const mockPairingFrequencyDays = 14;

    await new CoffeeChatConfigModel({
      channelId: mockChannelId,
      channelName: mockChannelName,
      isActive: true,
      pairingFrequencyDays: mockPairingFrequencyDays,
    }).save();

    // Create a pairing that is due for stats reporting but has a previous pairing from a round long ago
    await new CoffeeChatPairingModel({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
      createdAt: moment().tz("America/New_York").subtract(30, "days").toDate(),
      dueDate: moment().tz("America/New_York").subtract(29, "days").toDate(),
      meetupConfirmed: true,
    }).save();

    // Call the function
    await coffeeChatService.reportStats();

    // Verify the function did not post stats to Slack and logged an appropriate message
    const mockPostMessage =
      jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  describe("sendMidwayReminders", () => {
    it("should send midway reminders for pairings that are halfway to due date", async () => {
      const mockChannelId = "C12345";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: "coffee-chats",
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Create a pairing that is halfway to due date, with a conversationId
      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
        createdAt: moment().tz("America/New_York").subtract(7, "days").toDate(),
        dueDate: moment().tz("America/New_York").add(6, "days").toDate(),
        meetupConfirmed: false,
        midpointReminderSent: false,
        conversationId: "D12345",
      }).save();

      // Call the function
      await coffeeChatService.sendMidwayReminders();

      // Verify the function sent reminders to Slack and updated the pairing
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "D12345",
          text: expect.stringContaining(
            `Just a friendly reminder about your coffee chat`,
          ),
        }),
      );

      const pairing = await CoffeeChatPairingModel.findOne({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
      });

      expect(pairing).not.toBeNull();
      expect(pairing?.midpointReminderSent).toBe(true);
    });

    it("should not send reminders for pairings that are not halfway to due date", async () => {
      const mockChannelId = "C12345";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: "coffee-chats",
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Create a pairing that is not halfway to due date
      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
        createdAt: moment().tz("America/New_York").subtract(2, "days").toDate(),
        dueDate: moment().tz("America/New_York").add(12, "days").toDate(),
        meetupConfirmed: false,
        midpointReminderSent: false,
        conversationId: "D12345",
      }).save();

      // Call the function
      await coffeeChatService.sendMidwayReminders();

      // Verify the function did not send reminders to Slack and did not update the pairing
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).not.toHaveBeenCalled();

      const pairing = await CoffeeChatPairingModel.findOne({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
      });

      expect(pairing).not.toBeNull();
      expect(pairing?.midpointReminderSent).toBe(false);
    });

    it("should not send reminders for pairings that are already confirmed", async () => {
      const mockChannelId = "C12345";
      const mockPairingFrequencyDays = 14;

      await new CoffeeChatConfigModel({
        channelId: mockChannelId,
        channelName: "coffee-chats",
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      }).save();

      // Create a pairing that is halfway to due date but already confirmed
      await new CoffeeChatPairingModel({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
        createdAt: moment().tz("America/New_York").subtract(7, "days").toDate(),
        dueDate: moment().tz("America/New_York").add(7, "days").toDate(),
        meetupConfirmed: true,
        midpointReminderSent: false,
        conversationId: "D12345",
      }).save();

      // Call the function
      await coffeeChatService.sendMidwayReminders();

      // Verify the function did not send reminders to Slack and did not update the pairing
      const mockPostMessage =
        jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

      expect(mockPostMessage).not.toHaveBeenCalled();

      const pairing = await CoffeeChatPairingModel.findOne({
        channelId: mockChannelId,
        userIds: ["U1", "U2"],
      });

      expect(pairing).not.toBeNull();
      expect(pairing?.midpointReminderSent).toBe(false);
    });
  });

  it("should not send reminders for inactive channels", async () => {
    const mockChannelId = "C12345";
    const mockPairingFrequencyDays = 14;

    await new CoffeeChatConfigModel({
      channelId: mockChannelId,
      channelName: "coffee-chats",
      isActive: false,
      pairingFrequencyDays: mockPairingFrequencyDays,
    }).save();

    // Create a pairing that is halfway to due date, with a conversationId
    await new CoffeeChatPairingModel({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
      createdAt: moment().tz("America/New_York").subtract(7, "days").toDate(),
      dueDate: moment().tz("America/New_York").add(7, "days").toDate(),
      meetupConfirmed: false,
      midpointReminderSent: false,
      conversationId: "D12345",
    }).save();

    // Call the function
    await coffeeChatService.sendMidwayReminders();

    // Verify the function did not send reminders to Slack and did not update the pairing
    const mockPostMessage =
      jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

    expect(mockPostMessage).not.toHaveBeenCalled();

    const pairing = await CoffeeChatPairingModel.findOne({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
    });

    expect(pairing).not.toBeNull();
    expect(pairing?.midpointReminderSent).toBe(false);
  });

  it("should not send reminders if there is no conversationId", async () => {
    const mockChannelId = "C12345";
    const mockPairingFrequencyDays = 14;

    await new CoffeeChatConfigModel({
      channelId: mockChannelId,
      channelName: "coffee-chats",
      isActive: true,
      pairingFrequencyDays: mockPairingFrequencyDays,
    }).save();

    // Create a pairing that is halfway to due date but has no conversationId
    await new CoffeeChatPairingModel({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
      createdAt: moment().tz("America/New_York").subtract(7, "days").toDate(),
      dueDate: moment().tz("America/New_York").add(7, "days").toDate(),
      meetupConfirmed: false,
      midpointReminderSent: false,
      conversationId: undefined,
    }).save();

    // Call the function
    await coffeeChatService.sendMidwayReminders();

    // Verify the function did not send reminders to Slack and did not update the pairing
    const mockPostMessage =
      jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

    expect(mockPostMessage).not.toHaveBeenCalled();

    const pairing = await CoffeeChatPairingModel.findOne({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
    });

    expect(pairing).not.toBeNull();
    expect(pairing?.midpointReminderSent).toBe(false);
  });

  it("should send reminders to all pairings that are halfway to due date - odd pairingFrequency", async () => {
    const mockChannelId = "C12345";
    const mockPairingFrequencyDays = 15;

    await new CoffeeChatConfigModel({
      channelId: mockChannelId,
      channelName: "coffee-chats",
      isActive: true,
      pairingFrequencyDays: mockPairingFrequencyDays,
    }).save();

    // Create 2 pairings that are halfway to due date, with conversationIds
    await new CoffeeChatPairingModel({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
      createdAt: moment().tz("America/New_York").subtract(7, "days").toDate(),
      dueDate: moment().tz("America/New_York").add(8, "days").toDate(),
      meetupConfirmed: false,
      midpointReminderSent: false,
      conversationId: "D12345",
    }).save();

    await new CoffeeChatPairingModel({
      channelId: mockChannelId,
      userIds: ["U3", "U4"],
      createdAt: moment().tz("America/New_York").subtract(7, "days").toDate(),
      dueDate: moment().tz("America/New_York").add(8, "days").toDate(),
      meetupConfirmed: false,
      midpointReminderSent: false,
      conversationId: "D67890",
    }).save();

    // Call the function
    await coffeeChatService.sendMidwayReminders();

    // Verify the function sent reminders to Slack and updated the pairings
    const mockPostMessage =
      jest.requireMock("../../src/slackbot").default.client.chat.postMessage;

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D12345",
        text: expect.stringContaining(
          `Just a friendly reminder about your coffee chat`,
        ),
      }),
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "D67890",
        text: expect.stringContaining(
          `Just a friendly reminder about your coffee chat`,
        ),
      }),
    );

    const pairing1 = await CoffeeChatPairingModel.findOne({
      channelId: mockChannelId,
      userIds: ["U1", "U2"],
    });

    expect(pairing1).not.toBeNull();
    expect(pairing1?.midpointReminderSent).toBe(true);

    const pairing2 = await CoffeeChatPairingModel.findOne({
      channelId: mockChannelId,
      userIds: ["U3", "U4"],
    });

    expect(pairing2).not.toBeNull();
    expect(pairing2?.midpointReminderSent).toBe(true);
  });
});
