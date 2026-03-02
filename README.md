# AppDev BigRedBot

## Description

Big Red Bot is an internal tool used by AppDev to boost member productivity and handle various logistical tasks/reminders.

## Setup Instructions

### Prerequisites

- Node.js v24+ (or compatible version)
- npm (comes with Node.js)
- MongoDB instance (local or remote)
- Slack workspace with bot permissions
- Google Service Account (for Google Sheets integration — only required if form services are enabled)

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

2. If using form services, add your Google Service Account credentials:
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

#### Other Scripts

```bash
npm test              # Run tests
npm run test:coverage # Run tests with coverage report
npm run format        # Format code with Prettier
npm run lint          # Lint and auto-fix with ESLint
```

## Features

### 1. Form Completion Reminders

> **Note:** Form services are currently disabled. To re-enable, uncomment `initializeFormServices()` in `src/app.ts`.

Automatically tracks form completion status via Google Sheets and sends daily Slack reminders to members who haven't completed forms that are due.

- Integrates with Google Sheets to track form completion
- Creates dedicated Slack channels for each form reminder
- Sends automated daily reminders for forms due today

### 2. Coffee Chat Pairings

Configurable coffee chat pairings to help team members get to know each other better. Defaults to every 14 days (biweekly).

#### Setup Coffee Chats

1. In any Slack channel where you want to enable coffee chats, register it (optionally specify a custom pairing frequency):

   ```
   /register-coffee-chats [days]
   ```

   For example, `/register-coffee-chats 7` sets weekly pairings. Defaults to 14 days if no argument is given.

2. Start the pairing cycle:

   ```
   /start-coffee-chats
   ```

   The bot will create the first round of pairings immediately, then automatically pair members on the configured schedule.

#### Slash Commands

| Command                         | Visibility | Description                                                                                             |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `/register-coffee-chats [days]` | Channel    | _(Admin only)_ Register the current channel for coffee chats with an optional pairing frequency in days |
| `/start-coffee-chats`           | Channel    | _(Admin only)_ Start the pairing cycle and create the first round of pairings                           |
| `/pause-coffee-chats`           | Channel    | _(Admin only)_ Pause automatic scheduling — no new pairings will be created                             |
| `/coffee-chat-status`           | Only you   | Check your opt-in/out status across all registered channels                                             |
| `/my-coffee-chats`              | Only you   | View your full pairing history across all channels                                                      |

#### How It Works

- New pairings are created and channel stats from the previous round are posted every day at **9:00 AM ET** (for any channel whose next pairing date has arrived)
- Midway reminders are sent every day at **4:00 PM ET** to pairings that haven't confirmed a meetup yet
- Members are randomly paired using a shuffle algorithm that avoids repeating pairings from the last 6 weeks
- If there is an odd number of members, one group will have 3 people
- Each pairing DM includes a random activity suggestion (e.g., "grab coffee", "play a board game", "visit a museum") and a deadline by which to meet
- If any paired members have scheduling links (Calendly, Cal.com, etc.) in their Slack profile, those are included in the DM
- Participants can interact directly from the pairing DM using buttons:
  - **✅ We Met!** — Confirm the meetup (recorded for stats)
  - **⏭️ Skip Next Time** — Sit out the next pairing round only
  - **⏸️ Pause Future Pairings** — Opt out of all future pairings
- After opting out, a **▶️ Resume Pairings** button lets users opt back in
- Pairings are tracked in MongoDB to prevent frequent repeats
