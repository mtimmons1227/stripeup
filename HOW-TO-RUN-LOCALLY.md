# Running StripeUp Locally

A quick guide to launching the app on your own computer so you can preview
changes before they go live.

## First time only — make the desktop icon

1. Open the `C:\StripeUp\officials` folder.
2. Double-click **`Setup-Desktop-Icon.bat`**.
3. A "StripeUp Dev" icon appears on your Desktop. That's it.

## Every time after that

Just double-click the **StripeUp Dev** icon on your Desktop.

It will:

1. Check that Node.js is installed (and send you to the download page if not).
2. Install the Netlify CLI the first time (one-time, ~1 minute).
3. Start the local server.
4. Open the app at **http://localhost:8888** in your browser.
5. Open Claude Code in the project folder so you can keep building.

Keep the black launcher window open while you work — closing it stops the server.

## What you need installed

- **Node.js** (required). Get the "LTS" version from https://nodejs.org.
  The launcher checks for this and points you to it if it's missing.
- **Claude Code CLI** (optional, for AI help). If it's missing the server
  still runs; to add it later, open a terminal and run:
  `npm install -g @anthropic-ai/claude-code`

## Good to know

- **Live site vs. local:** Your live site at
  https://officials-scheduler.netlify.app always runs the code that's been
  pushed to GitHub. Local (localhost:8888) runs the files on your computer,
  including edits you haven't pushed yet.
- **Sending real invites locally:** The email function (`send-invites`) needs
  secret keys that live in your Netlify dashboard, not on your computer. So
  real emails may not send from localhost. Use **Demo Mode** in the app to
  test the invitation flow without sending real emails.
- **First launch may ask to connect to Netlify:** You can continue without
  linking; the site and functions still run locally.

## Where you left off (from CLAUDE.md)

- Full self-schedule flow browser test: invite link -> official picks blocks
  -> confirm -> assigner sees it in View Responses / Confirmed Officials.
- Add travel-radius UI fields (home city / state / radius) to the Officials
  roster table.
