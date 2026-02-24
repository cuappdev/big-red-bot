# AppDev BigRedBot

## Description

Big Red Bot is an internal tool used by AppDev to boost member productivity and handle various logistical tasks/reminders.

## Setup Instructions

### Prerequisites

- Node.js v24.13.1 (or compatible version)
- npm (comes with Node.js)
- MongoDB instance (local or remote)
- Slack workspace with bot permissions
- Google Service Account (for Google Sheets integration)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/cuappdev/big-red-bot.git
   cd big-red-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

1. Create a `.env` file in the root directory by copying the `.env.template` and populating the values.

2. Add your Google Service Account credentials:
   - Place your `service_account.json` file in the root directory
   - Ensure this file contains your Google API credentials

### Running the Application

#### Development Mode

```bash
npm run dev
```

This runs the application with hot-reloading using nodemon.

#### Production Mode

```bash
npm start
```

## Features

### 1. Form Completion Reminders

Automatically tracks form completion status via Google Sheets and sends daily Slack reminders to members who haven't completed forms that are due.

- Integrates with Google Sheets to track form completion
- Creates dedicated Slack channels for each form reminder
- Sends automated daily reminders for forms due today

### 2. Coffee Chat Pairings

Biweekly coffee chat pairings to help team members get to know each other better.

#### Setup Coffee Chats

1. In any Slack channel where you want to enable coffee chats, run:

   ```
   /register-coffee-chats
   ```

2. The bot will automatically pair members every 2 weeks and send DMs with pairing information.

#### Slash Commands

- `/register-coffee-chats` - Enable biweekly coffee chat pairings for the current channel
- `/trigger-coffee-chats` - Manually trigger coffee chat pairings (useful for testing)
- `/disable-coffee-chats` - Disable coffee chat pairings for the current channel

#### How It Works

- Members are randomly paired every 2 weeks
- The algorithm avoids pairing people who were recently matched (within the last 4 weeks)
- Each pairing receives a random activity suggestion (e.g., "grab coffee at a local café", "play a board game", "visit a museum")
- If there's an odd number of members, one group will have 3 people
- All participants receive a DM with their pairing information and activity suggestion
- Pairings are tracked in MongoDB to prevent frequent repeats
