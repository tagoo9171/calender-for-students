# Daybook

A day planner for students that you can install on your phone and computer.

- **Day view:** an hourly timeline, an agenda with checkboxes, and the homework due that day (overdue work shows on today)
- **Week view:** all 7 days side by side, how much homework is due each day, and a weekly study goal
- **Homework:** add assignments with a due date and tick them off
- **Focus timer:** 25 minutes of focus and a 5 minute break; finished sessions add up to today's focus time
- **Stats:** hours planned and done this week, by type and by day
- **Repeating tasks:** for example "Gym every Mon, Wed and Fri", "Lab every 2 weeks" or "Maths every weekday until 18 Dec". You can change a single day without changing the rest.
- **Repeats screen:** all repeating tasks in one list, where you can change their times directly
- **Reminders:** a notification before a task starts (while the app is open)
- **Works offline**, and keeps your data on your device. Use *Settings → Download backup* to move it.

It's plain HTML, CSS and JavaScript with no build step and no dependencies.

## Run it on your computer

```bash
npm start          # opens a local server at http://localhost:8080
npm test           # runs the tests
```

Opening `index.html` by double-clicking won't work, because browsers block JavaScript modules on `file://`. Use `npm start` instead.

## Put it online (GitHub Pages)

1. Push this folder to a public GitHub repository.
2. On GitHub, go to **Settings → Pages**.
3. Under **Branch**, choose `main` and `/ (root)`, then click **Save**.
4. After a minute your app is live at `https://<your-username>.github.io/<repo-name>/`.

## Install it

- **Android (Chrome):** open the link, then tap **⋮ → Add to Home screen / Install app**.
- **iPhone (Safari):** open the link, then tap **Share → Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** open the link, then click the install icon in the address bar.

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | The page and its dialogs |
| `css/style.css` | All styles, light and dark theme |
| `js/app.js` | Starts the app and connects buttons to actions |
| `js/store.js` | Tasks, repeating rules, homework, focus time and saving |
| `js/views.js` | Draws the Day, Week and Stats screens |
| `js/editor.js` | The add / edit task dialog |
| `js/reminders.js` | Reminder checks and notifications |
| `js/stats.js` | Weekly totals |
| `js/focus.js` | The focus timer |
| `js/time.js` | Date and time helpers |
| `sw.js` | Service worker for offline use |
| `tests/` | Unit tests (`npm test`) |

When you change any file, raise the version in `CACHE` at the top of `sw.js` (for example `daybook-v2`) so installed apps download the update.

## Known limits

- Reminders only fire while the app is open. Background reminders on a locked phone need a push server, or a native wrapper such as Capacitor. That's a possible next step.
- Data isn't synced between devices. Use the backup file for now.
