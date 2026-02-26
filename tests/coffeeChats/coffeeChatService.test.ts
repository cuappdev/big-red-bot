// Mock dependencies before importing
jest.mock("../../src/slackbot", () => ({
  default: {
    client: {
      conversations: {
        members: jest.fn(),
      },
      users: {
        info: jest.fn(),
      },
      chat: {
        postMessage: jest.fn(),
      },
    },
  },
}));
jest.mock("../../src/coffeeChats/coffeeChatModels");
jest.mock("../../src/app", () => ({
  DEFAULT_PAIRING_FREQUENCY_DAYS: 14,
}));
jest.mock("../../src/utils/timeUtils", () => ({
  logWithTime: jest.fn(),
}));

import * as coffeeChatService from "../../src/coffeeChats/coffeeChatService";
import {
  CoffeeChatConfigModel,
  CoffeeChatPairingModel,
  CoffeeChatUserPreferenceModel,
} from "../../src/coffeeChats/coffeeChatModels";

describe("coffeeChatService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("registerCoffeeChatChannel", () => {
    it("should register a new coffee chat channel with default settings", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";
      const mockPairingFrequencyDays = 14;

      // Mock the findOne to return null (channel doesn't exist)
      const mockFindOne = jest.fn().mockResolvedValue(null);
      (CoffeeChatConfigModel.findOne as jest.Mock) = mockFindOne;

      // Mock the save method
      const mockSave = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        channelName: mockChannelName,
        isActive: true,
        pairingFrequencyDays: mockPairingFrequencyDays,
      });

      // Mock the constructor
      (CoffeeChatConfigModel as any).mockImplementation(() => ({
        save: mockSave,
      }));

      // Call the function
      await coffeeChatService.registerCoffeeChatChannel(
        mockChannelId,
        mockChannelName,
        mockPairingFrequencyDays,
      );

      // Verify findOne was called with correct parameters
      expect(mockFindOne).toHaveBeenCalledWith({ channelId: mockChannelId });

      // Verify save was called
      expect(mockSave).toHaveBeenCalled();
    });

    it("should not register a channel that already exists", async () => {
      const mockChannelId = "C12345";
      const mockChannelName = "coffee-chats";

      // Mock the findOne to return an existing config
      const mockFindOne = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        channelName: mockChannelName,
      });
      (CoffeeChatConfigModel.findOne as jest.Mock) = mockFindOne;

      const mockSave = jest.fn();
      (CoffeeChatConfigModel as any).mockImplementation(() => ({
        save: mockSave,
      }));

      // Call the function
      await coffeeChatService.registerCoffeeChatChannel(
        mockChannelId,
        mockChannelName,
      );

      // Verify findOne was called
      expect(mockFindOne).toHaveBeenCalledWith({ channelId: mockChannelId });

      // Verify save was NOT called
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe("optOutOfCoffeeChats", () => {
    it("should opt out a user from coffee chats", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Mock findOneAndUpdate
      const mockFindOneAndUpdate = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        userId: mockUserId,
        isOptedIn: false,
      });
      (CoffeeChatUserPreferenceModel.findOneAndUpdate as jest.Mock) =
        mockFindOneAndUpdate;

      // Call the function
      await coffeeChatService.optOutOfCoffeeChats(mockUserId, mockChannelId);

      // Verify findOneAndUpdate was called with correct parameters
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockUserId, channelId: mockChannelId },
        { isOptedIn: false, skipNextPairing: false },
        { upsert: true },
      );
    });
  });

  describe("optInToCoffeeChats", () => {
    it("should opt in a user to coffee chats", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Mock findOneAndUpdate
      const mockFindOneAndUpdate = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        userId: mockUserId,
        isOptedIn: true,
      });
      (CoffeeChatUserPreferenceModel.findOneAndUpdate as jest.Mock) =
        mockFindOneAndUpdate;

      // Call the function
      await coffeeChatService.optInToCoffeeChats(mockUserId, mockChannelId);

      // Verify findOneAndUpdate was called with correct parameters
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockUserId, channelId: mockChannelId },
        { isOptedIn: true, skipNextPairing: false },
        { upsert: true },
      );
    });
  });

  describe("getCoffeeChatsOptInStatus", () => {
    it("should return true when user is opted in", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Mock findOne to return opted-in preference
      const mockFindOne = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        userId: mockUserId,
        isOptedIn: true,
      });
      (CoffeeChatUserPreferenceModel.findOne as jest.Mock) = mockFindOne;

      // Call the function
      const result = await coffeeChatService.getCoffeeChatsOptInStatus(
        mockUserId,
        mockChannelId,
      );

      // Verify the result
      expect(result).toBe(true);
      expect(mockFindOne).toHaveBeenCalledWith({
        userId: mockUserId,
        channelId: mockChannelId,
      });
    });

    it("should return true when user preference does not exist (default opt-in)", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Mock findOne to return null (no preference set)
      const mockFindOne = jest.fn().mockResolvedValue(null);
      (CoffeeChatUserPreferenceModel.findOne as jest.Mock) = mockFindOne;

      // Call the function
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

      // Mock findOne to return opted-out preference
      const mockFindOne = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        userId: mockUserId,
        isOptedIn: false,
      });
      (CoffeeChatUserPreferenceModel.findOne as jest.Mock) = mockFindOne;

      // Call the function
      const result = await coffeeChatService.getCoffeeChatsOptInStatus(
        mockUserId,
        mockChannelId,
      );

      // Verify the result
      expect(result).toBe(false);
    });
  });

  describe("skipNextPairing", () => {
    it("should set skipNextPairing to true for a user", async () => {
      const mockChannelId = "C12345";
      const mockUserId = "U12345";

      // Mock findOneAndUpdate
      const mockFindOneAndUpdate = jest.fn().mockResolvedValue({
        channelId: mockChannelId,
        userId: mockUserId,
        skipNextPairing: true,
      });
      (CoffeeChatUserPreferenceModel.findOneAndUpdate as jest.Mock) =
        mockFindOneAndUpdate;

      // Call the function
      await coffeeChatService.skipNextPairing(mockUserId, mockChannelId);

      // Verify findOneAndUpdate was called with correct parameters
      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { userId: mockUserId, channelId: mockChannelId },
        { skipNextPairing: true },
        { upsert: true },
      );
    });
  });

  describe("confirmMeetup", () => {
    it("should mark a pairing as confirmed", async () => {
      const mockPairingId = "pairing123";

      // Mock findByIdAndUpdate
      const mockFindByIdAndUpdate = jest.fn().mockResolvedValue({
        _id: mockPairingId,
        meetupConfirmed: true,
      });
      (CoffeeChatPairingModel.findByIdAndUpdate as jest.Mock) =
        mockFindByIdAndUpdate;

      // Call the function
      await coffeeChatService.confirmMeetup(mockPairingId);

      // Verify findByIdAndUpdate was called with correct parameters
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(mockPairingId, {
        meetupConfirmed: true,
      });
    });
  });
});
