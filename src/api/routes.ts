import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import slackbot from "../slackbot";
import { logWithTime } from "../utils/timeUtils";

export const registerApiRoutes = (app: Express) => {
  app.use(express.json());

  // Set up rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Limit each IP to 15 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      success: false,
      error: "Too many requests, please try again later.",
    },
  });

  app.post("/api/send-message", apiLimiter, async (req, res) => {
    const authHeader = req.headers.authorization;
    const apiSecret = process.env.API_SECRET;

    if (!apiSecret || authHeader !== `Bearer ${apiSecret}`) {
      res.status(401).send({ success: false, error: "Unauthorized" });
      return;
    }

    const { channelId, text, blocks } = req.body;

    if (!channelId || !text) {
      res
        .status(400)
        .send({ success: false, error: "Missing channelId or text" });
      return;
    }

    try {
      await slackbot.client.chat.postMessage({
        channel: channelId,
        text: text,
        ...(blocks ? { blocks } : {}),
      });
      res.status(200).send({ success: true });
    } catch (error) {
      const err = error as Error;
      logWithTime(`Error sending slack message: ${err.message}`);
      res.status(500).send({ success: false, error: err.message });
    }
  });
};
