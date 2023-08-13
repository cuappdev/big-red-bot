import { App } from "@slack/bolt";

const app = new App({
  token: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const startServer = async () => {
  await app.start(process.env.PORT || 3000);
  console.log("✅ Slackbot up and running!");
};

startServer();
