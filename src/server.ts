import express from "express";
import slackbot from "./slackbot";

const app = express();

export const startServer = async () => {
  await slackbot.start(process.env.PORT || 3000);
  console.log("✅ Slackbot up and running!");

  app.listen(process.env.PORT || 8000);
  console.log("✅ Express server up and running!");
};
