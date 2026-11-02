# Rerouter

## Event lines (`logEvent`)

`logEvent(name, fields?)` writes one line for a machine to read (the monitor, Tailmon), apart from the log for people:

```
@ev {"v":1,"e":"outcome","task":"pvp","name":"battle.finished","res":"ok"}
```

- `v` is the version of the shape, `e` the name of the event, `task` the task that runs (`-` when none; from Rerouter, or `fields.task`). The time is the time of the line in the log.
- What a script writes with `logEvent` (a difficulty it met, what it achieved) gets the `task` and the `route` that matches now from Rerouter: the script does not have to say where it is. Rerouter's own events say their own `path`.
- It does not go through the overridden `console`: no time header, no level, no cut at 1000 characters. It writes only what you call it for; it does not depend on a setting.
- The line is never cut in the middle. Over `EVENT_MAX_CHARS` (800) the long values are shortened, then the last fields are dropped, and `"trunc":true` says it. `formatEvent()` gives the line without printing it.
- `rerouterConfig.eventLog` (default `false`): when on, Rerouter itself writes these. Off, Rerouter writes nothing new.
  - `task_start` (`max` = seconds the task may take) and `task_end` (`ms`, `runs`, `reason` = `done` or `timeout`) for every round of a task.
  - `route` when the route that matches changes: `path`, `from` (the one before; `''` when the step before matched none), `prev_ms` (how long that one stayed), `pages`, and `last` (the route before the unknown stretch that this one ends).
  - `unknown` at the first five steps where no route matches, then at every tenth (the next `route` event says the whole time): `n` (steps so far), `ms` (since the first), `last` (the last route that matched, kept over all the unknown steps).
  - `stay` when a route that matches stays the route for `stuckStayAfterSec` (60) seconds, and at 4, 20, 60 and 240 times that: `path`, `ms`, `times`, `pages`; its screen is kept too when `stuckScreenshot` is on. No progress without an unknown screen. Nothing is done (no cost) when neither `eventLog` nor `stuckScreenshot` is on.
  - `restart` when the game is stopped or started again or the emulator is rebooted, with `reason` and `how` (`restart`, `stop`, `start`, `reboot`). Give the reason: `restartApp(reason?)`, `stopApp(maxRetries?, retryDelay?, reason?)`, `stopEmulator(reason?)` (all optional, so a caller that gives none changes nothing; `restartApp()` says `unspecified`). Rerouter's own: `route-conflict`, `app-not-running`, `screen-frozen`.
  - `odd` (level `yellow`): Rerouter finds something odd by its own rules, so that nobody has to know the rules to write a script. `why`: `unknown-long` (a screen no route matches for `oddRules.unknownSec`, once for each stretch), `loop` (the same way round `oddRules.loopCount` times in one round of a task, and again at twice that), `frozen` (a route that matches while the screen has not changed for `frozenSec`), `no-effect` (a route that stays whose action was called `noEffectActions` times, each one short, without the route changing). The rules are in `rerouterConfig.oddRules` (0 turns one off): when yellow shows too often, change them there.  An unknown screen that keeps changing (a fight, a loading screen: it has changed within `unknownStillSec`, needs `trackStillScreen`) is not kept, not `unknown-long` and not counted for a loop, but it is never hidden: its `unknown` events are written (with `still`) and it is `unknown-moving` when it goes on for `movingUnknownSec`.
  - `stay` also has `actions` and `action_ms` (how many times the action of the route was done while it stayed, and how long they took: Rerouter measures it, the script says nothing), and `still` (seconds the screen has not changed; only with `trackStillScreen`): 0 is a screen that keeps changing (the script is working), a long one is frozen.
  - `route` and `unknown` also carry `img` (the picture of the image log saved last, e.g. `2026-11-02T10.15.30_log`, no folder, no `.png`) and `img_ms` (how long before the event it was saved; the image log saves one picture per `logScreenshotMinIntervalInSec`). No `img` when nothing was saved yet.

## Keep the screen that is stuck (`stuckScreenshot`)

The image log goes round (a fixed number of pictures), so a screen that no route matches may be gone before anybody looks. `screenConfig.stuckScreenshot = true` (default `false`) keeps it:

- When no route matches for `stuckAfterSec` (15) seconds, and again at 4, 20, 60 and 240 times that (60 s, 5 min, 15 min, 1 h), the screen the script sees (the development size, the one the pages are made for) is saved to `<logScreenshotFolder>/stuck/<date>T<time>_stuck.png`, with a thumbnail beside it (`.jpg`, as for the image log).
- A screen that is the same as one kept before (`getIdentityScore` of the 160x90 copies at least `stuckSameScore`, 0.99; the last 20 kept are compared) is **not kept again**: the event names the first one (`"pin":"same"`).
- Going round in a circle (a route leads into a screen the script does not know, it presses BACK, the route is there again): when one round of a task has entered the unknown screen from the same route `stuckRepeatEntries` (3) times, the unknown screen is kept after `stuckRepeatAfterSec` (5) seconds instead of 15, and at 4, 20, 60 and 240 times that.
- Its own limits, not the image log's: `stuckScreenshotMaxFiles` (300, thumbnails not counted) and `stuckScreenshotMaxDays` (14). Nothing has to be told to the devices: what is old, or beyond the number, goes the next time something is kept.
- With `eventLog` on, the `unknown` event of that moment has `img` = the kept picture and `pin` = `new` or `same`.
