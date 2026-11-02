import { plainLog } from './overrides';

/**
 * Event lines: one line of the log for a machine (the monitor reads them, nobody has to). The shape is fixed:
 *
 *   @ev {"v":1,"e":"outcome","task":"pvp","name":"battle.finished","res":"ok"}
 *
 * `v` is the version of the shape, `e` the name of the event, `task` the task that runs (`-` when none), the rest are the fields of the caller.
 * The time is the time of the line in the log; it is not repeated here. The line is never cut in the middle: when it is too long the long values
 * are shortened, and when that is not enough the last fields are dropped and `trunc` says so, so a reader can tell "it happened, the details are lost".
 */
export type EventFields = { [key: string]: string | number | boolean | null | undefined };

export const EVENT_MARK = '@ev ';
export const EVENT_VERSION = 1;
export const EVENT_MAX_CHARS = 800;
const LONG_VALUE_CHARS = 80;

let taskProvider: (() => string) | undefined;
let routeProvider: (() => string) | undefined;

/** where `task` comes from when the caller does not give one (Rerouter sets it to the task that runs) */
export function setEventTaskProvider(provider: (() => string) | undefined): void {
  taskProvider = provider;
}

/** where `route` comes from for the events that a script writes with logEvent (Rerouter sets it to the route that matches now; '' when none does) */
export function setEventRouteProvider(provider: (() => string) | undefined): void {
  routeProvider = provider;
}

function toLine(body: { [key: string]: any }): string {
  return EVENT_MARK + JSON.stringify(body);
}

/** the line of an event, within EVENT_MAX_CHARS (pure: nothing is printed) */
export function formatEvent(name: string, fields?: EventFields, task?: string, maxChars?: number, withRoute: boolean = false): string {
  const limit = maxChars || EVENT_MAX_CHARS;
  const body: { [key: string]: any } = { v: EVENT_VERSION, e: name };
  const given = fields || {};
  body.task = given.task !== undefined && given.task !== null ? String(given.task) : task !== undefined ? task : taskProvider ? taskProvider() : '-';
  if (withRoute && given.route === undefined && routeProvider) {
    const route = routeProvider();
    if (route) {
      body.route = route;
    }
  }
  const keys = Object.keys(given).filter(function (k) {
    return k !== 'task' && k !== 'v' && k !== 'e' && given[k] !== undefined;
  });
  keys.forEach(function (k) {
    body[k] = given[k];
  });

  let line = toLine(body);
  if (line.length <= limit) {
    return line;
  }
  // 1. the long values are shortened
  keys.forEach(function (k) {
    const v = body[k];
    if (typeof v === 'string' && v.length > LONG_VALUE_CHARS) {
      body[k] = v.substring(0, LONG_VALUE_CHARS) + '…';
    }
  });
  body.trunc = true;
  line = toLine(body);
  // 2. the last fields are dropped, one by one
  while (line.length > limit && keys.length > 0) {
    delete body[keys.pop() as string];
    line = toLine(body);
  }
  if (line.length > limit) {
    // the name or the task alone is too long: nothing of the fields is left, and the name is cut as well
    return toLine({ v: EVENT_VERSION, e: String(name).substring(0, 60), trunc: true });
  }
  return line;
}

/**
 * Say something that only the script knows (a difficulty it met, what it achieved), as a line for the monitor. The task and the route that matches now are put in by Rerouter, and the
 * time is the time of the line: the monitor puts it together with what Rerouter saw (where the script was, for how long) without the script saying where it is.
 * Does not depend on any setting: whoever calls it wants the line.
 */
export function logEvent(name: string, fields?: EventFields): void {
  plainLog(formatEvent(name, fields, undefined, undefined, true));
}

/** The line of an event of Rerouter itself (no `route`: its events say their own `path`). */
export function writeEvent(name: string, fields?: EventFields): void {
  plainLog(formatEvent(name, fields));
}
