// FIXME: should use a test framework. Run: npx ts-node --transpile-only test/routeEvents.test.ts
let failed = 0;
function check(name: string, ok: boolean, detail: string = '') {
  process.stdout.write((ok ? 'ok   ' : 'FAIL ') + name + ' ' + detail + '\n');
  if (!ok) {
    failed++;
  }
}

const printed: string[] = [];
const realLog = console.log;
console.log = (...args: any[]) => {
  printed.push(args.join(' '));
};
const g = global as any;
let now = Date.UTC(2026, 10, 2, 0, 0, 0);
Date.now = () => now;
g.sleep = (ms: number) => {
  now += ms;
};
g.releaseImage = () => {};
const { rerouter } = require('../src/rerouter');

const events = () => printed.filter(l => l.indexOf('@ev ') === 0).map(l => JSON.parse(l.substring(4)));

// frames: pvp matches /a twice, then does not match anything twice, then /b, and the last action finishes the round
const frames: (string | null)[] = ['/a', '/a', null, null, '/b'];
let frame = 0;
const r = rerouter as any;
r.rerouterConfig.checkFrozenScreen = false;
r.rerouterConfig.autoLaunchApp = false;
let lastImage: any = { name: '2026-11-02T00.00.01_log', ageMs: 400 };
r.screen = { getRotation: () => 'vertical', getCvtDevScreenshot: () => ({}), getLastLogImage: () => lastImage, isTrackingStill: () => false, getFrozenSeconds: () => 0, taskNameProvider: () => 'pvp' };
r.findMatchedRouteImpl = () => {
  const path = frames[frame++];
  return path === null ? [] : [{ matchedRoute: { path }, matchedPages: [{ name: 'page' + path.replace('/', '') }] }];
};
r.doActionForRoute = (context: any, _image: any, route: any, _pages: any, finishRound: any) => {
  if (frame >= frames.length) {
    finishRound(false);
  }
};
r.unknownRouteAction = () => {};
const task = { name: 'pvp', startTime: now, config: { findRouteDelay: 1000, maxTaskDuring: 0, forceStop: false } };
r.running = true;

// off (the default): nothing is written by Rerouter
r.rerouterConfig.eventLog = false;
r.startRouteLoop(task);
check('eventLog off: no event line', events().length === 0, printed.join(' | '));

// on
frame = 0;
r.routeContext = null;
r.lastRealPath = '';
r.rerouterConfig.eventLog = true;
printed.length = 0;
r.startRouteLoop(task);
const got = events();
const names = got.map((e: any) => e.e + ':' + (e.path || e.n));
check('route only when it changes, unknown at every step', names.join(',') === 'route:/a,unknown:1,unknown:2,route:/b', names.join(','));
check('first route: from nothing, in the task', got[0].from === '' && got[0].task === 'pvp' && got[0].pages === 'pagea', JSON.stringify(got[0]));
check('unknown counts its time and says the last route that matched, at every step', got[1].n === 1 && got[1].ms === 0 && got[2].ms === 1000 && got[1].last === '/a' && got[2].last === '/a', JSON.stringify(got[2]));
check('route after unknown: how long the unknown stayed', got[3].from === '' && got[3].prev_ms === 2000, JSON.stringify(got[3]));
check('going into unknown is not a route event', got.filter((e: any) => e.e === 'route').length === 2);

check('route and unknown say the picture, how old it is, and the route before an unknown stretch',
  got[1].img === '2026-11-02T00.00.01_log' && got[1].img_ms === 400 && got[3].img === got[1].img && got[3].last === '/a' && got[0].last === undefined, JSON.stringify(got[3]));

// no picture saved yet: no img field
lastImage = null;
frame = 0;
r.routeContext = null;
printed.length = 0;
r.startRouteLoop(task);
check('no picture, no img', events().every((e: any) => e.img === undefined && e.img_ms === undefined));

// a long unknown stretch: the first five steps, then every tenth; the route after it says the whole time
frames.length = 0;
for (let i = 0; i < 25; i++) { frames.push(null); }
frames.push('/c');
frame = 0;
r.routeContext = null;
r.lastRealPath = '/a';
printed.length = 0;
r.startRouteLoop(task);
const long = events();
check('a long unknown stretch is thinned', long.filter((e: any) => e.e === 'unknown').map((e: any) => e.n).join(',') === '1,2,3,4,5,10,20', long.filter((e: any) => e.e === 'unknown').map((e: any) => e.n).join(','));
const after = long[long.length - 1];
check('the route after it has the whole time', after.e === 'route' && after.path === '/c' && after.prev_ms === 25000 && after.last === '/a', JSON.stringify(after));

// the screen is kept when the unknown stretch has lasted stuckAfterSec, and at 4 times that; the picture of the event is that one
r.screenConfig.stuckScreenshot = true;
r.screenConfig.stuckAfterSec = 15;
const kept: any[] = [];
r.screen.pinStuckScreenshot = () => { const answer = kept.length === 0 ? { name: 'p1_stuck', same: false } : { name: 'p1_stuck', same: true }; kept.push(answer); return answer; };
task.config.findRouteDelay = 5000;
frames.length = 0;
for (let i = 0; i < 20; i++) { frames.push(null); }
frames.push('/c');
frame = 0;
r.routeContext = null;
r.lastRealPath = '/a';
r.pinStage = 0;
r.unknownEntries = {};
printed.length = 0;
r.startRouteLoop(task);
const pins = events().filter((e: any) => e.e === 'unknown' && e.pin);
check('kept at 15 s and at 60 s, once each', kept.length === 2 && pins.map((e: any) => e.n + ':' + e.ms).join(',') === '4:15000,13:60000', pins.map((e: any) => e.n + ':' + e.ms).join(','));
check('the event says the kept picture and whether it was new', pins[0].img === 'p1_stuck' && pins[0].pin === 'new' && pins[0].img_ms === undefined && pins[1].pin === 'same', JSON.stringify(pins));

// a route that matches starts the moments again
frames.length = 0;
frames.push(null, null, null, null, '/a', null, null, null, null, '/b');
frame = 0;
r.routeContext = null;
r.pinStage = 0;
r.unknownEntries = {};
kept.length = 0;
r.screenConfig.stuckAfterSec = 10;
printed.length = 0;
r.startRouteLoop(task);
check('a route in between starts again at the first moment: one each side of it', kept.length === 2, String(kept.length));

// going round in a circle: /a, an unknown screen, BACK, /a ... the unknown screen is kept sooner from the third time
r.screenConfig.stuckScreenshot = true;
r.screenConfig.stuckAfterSec = 15;
frames.length = 0;
for (let i = 0; i < 4; i++) { frames.push('/a', null, null); }
frames.push('/a');
frame = 0;
r.routeContext = null;
r.lastRealPath = '';
r.pinStage = 0;
r.unknownEntries = {};
kept.length = 0;
printed.length = 0;
r.startRouteLoop(task);
const circle = events().filter((e: any) => e.e === 'unknown' && e.pin);
check('the third and the fourth time round, the unknown screen is kept at 5 s', kept.length === 2 && circle.map((e: any) => e.ms).join(',') === '5000,5000', circle.map((e: any) => e.n + ':' + e.ms).join(','));
check('the first two times it is not (10 s is less than 15 s)', circle.length === 2);

// a route that matches and stays: told at 60 s (and 4 times that), the screen kept; no unknown screen is in it
function stay(opts: { pin: boolean; events: boolean }, steps: number) {
  r.screenConfig.stuckScreenshot = opts.pin;
  r.rerouterConfig.eventLog = opts.events;
  frames.length = 0;
  for (let i = 0; i < steps; i++) { frames.push('/a'); }
  frames.push('/b');
  frame = 0; r.routeContext = null; r.lastRealPath = ''; r.pinStage = 0; r.stayStage = 0; r.unknownEntries = {};
  kept.length = 0; printed.length = 0;
  r.startRouteLoop(task);
  return events().filter((e: any) => e.e === 'stay');
}
let stays = stay({ pin: true, events: true }, 14);
check('a route that stays 60 s is told once, with the screen that was kept', stays.length === 1 && stays[0].path === '/a' && stays[0].ms === 60000 && stays[0].img === 'p1_stuck' && stays[0].times === 13 && kept.length === 1, JSON.stringify(stays));
stays = stay({ pin: true, events: true }, 60);
check('and again at 4 times that (240 s)', stays.map((e: any) => e.ms).join(',') === '60000,240000', stays.map((e: any) => e.ms).join(','));
stays = stay({ pin: false, events: true }, 14);
check('without stuckScreenshot the event has no screen and nothing is kept', stays.length === 1 && stays[0].img === undefined && kept.length === 0);
stays = stay({ pin: true, events: false }, 14);
check('without eventLog the screen is kept and nothing is written', stays.length === 0 && kept.length === 1);
stays = stay({ pin: false, events: false }, 14);
check('with neither, nothing at all (the ordinary machines)', stays.length === 0 && kept.length === 0);
r.rerouterConfig.eventLog = true;

// an unknown screen that the action says is expected (a fight): told as expected, not kept; when it stops being expected the moments that were passed are kept at once
r.screenConfig.stuckScreenshot = true;
r.rerouterConfig.eventLog = true;
let fighting = true;
r.unknownRouteAction = () => { if (fighting) { r.markUnknownExpected('battle'); } };
frames.length = 0;
for (let i = 0; i < 12; i++) { frames.push(null); }
frames.push('/c');
frame = 0; r.routeContext = null; r.lastRealPath = '/a'; r.pinStage = 0; r.unknownEntries = {};
kept.length = 0; printed.length = 0;
const stepBack = r.unknownRouteAction;
let step = 0;
r.unknownRouteAction = () => { step++; fighting = step <= 8; stepBack(); };       // a fight for 8 steps (35 s), then it is no fight
r.startRouteLoop(task);
const fight = events().filter((e: any) => e.e === 'unknown');
check('a fight: told as expected, the first five steps, nothing kept', fight.slice(0, 5).every((e: any) => e.expected === 'battle' && e.pin === undefined) && fight.slice(0, 5).map((e: any) => e.n).join(',') === '1,2,3,4,5', fight.map((e: any) => e.n + (e.expected ? 'e' : '') + (e.pin ? 'p' : '')).join(','));
check('when it is no fight any more, the screen is kept at once (the moments passed), once', kept.length === 1 && fight.filter((e: any) => e.pin).length === 1 && fight.filter((e: any) => e.pin)[0].n === 9, kept.length + ' ' + fight.map((e: any) => e.n + (e.expected ? 'e' : '') + (e.pin ? 'p' : '')).join(','));
r.unknownRouteAction = () => {};
r.screenConfig.stuckScreenshot = true;

// off: nothing is kept
r.screenConfig.stuckScreenshot = false;
frames.length = 0;
for (let i = 0; i < 20; i++) { frames.push(null); }
frames.push('/c');
frame = 0;
r.routeContext = null;
r.pinStage = 0;
r.unknownEntries = {};
kept.length = 0;
r.startRouteLoop(task);
check('off: nothing is kept', kept.length === 0);

// stay says whether the screen was changing (the script is working) or frozen
r.screen.isTrackingStill = () => true;
let frozenFor = 0;
r.screen.getFrozenSeconds = () => frozenFor;
frozenFor = 58;
stays = stay({ pin: false, events: true }, 14);
check('the stay says how long the screen has not changed', stays.length === 1 && stays[0].still === 58, JSON.stringify(stays));
frozenFor = 0;
stays = stay({ pin: false, events: true }, 14);
check('a screen that is changing: still 0', stays[0].still === 0);
r.screen.isTrackingStill = () => false;
stays = stay({ pin: false, events: true }, 14);
check('not tracked: no still field', stays[0].still === undefined);
r.rerouterConfig.eventLog = true;

// restart: the reason goes into the event; a caller that gives none changes nothing
r.doStopApp = () => {};
r.startApp = () => {};
r.stopEmulatorReal = r.stopEmulator;
const execd: string[] = [];
g.execute = (c: string) => { execd.push(c); return ''; };
printed.length = 0;
r.restartApp('battle-hang');
r.restartApp();
r.stopApp(3, 0, 'license-out');
r.stopApp();
r.stopEmulator('screen-frozen');
r.stopEmulator();
const restarts = events().filter((e: any) => e.e === 'restart');
check('restarts with a reason say it', restarts.map((e: any) => e.reason + ':' + e.how).join(',') === 'battle-hang:restart,unspecified:restart,license-out:stop,screen-frozen:reboot', restarts.map((e: any) => e.reason + ':' + e.how).join(','));
check('stopApp and stopEmulator without a reason write nothing, and still do what they did', restarts.length === 4 && execd.filter(c => c === 'reboot -p').length === 2, String(execd.length));
r.rerouterConfig.eventLog = false;
printed.length = 0;
r.restartApp('x');
check('eventLog off: no event line', events().length === 0);
r.rerouterConfig.eventLog = true;

// the odd rules: Rerouter says yellow by itself
const realDoAction = Object.getPrototypeOf(r).doActionForRoute;
function odds(frames_: (string | null)[], setup: () => void = () => {}) {
  r.rerouterConfig.eventLog = true; r.screenConfig.stuckScreenshot = false;
  frames.length = 0; frames_.forEach(f => frames.push(f)); frame = 0;
  r.routeContext = null; r.lastRealPath = ''; r.pinStage = 0; r.stayStage = 0; r.unknownEntries = {}; r.transitions = {}; r.unknownExpectedStretch = false; r.oddUnknownTold = false;
  r.stayActions = 0; r.stayActionMs = 0;
  setup(); printed.length = 0;
  r.startRouteLoop(task);
  return events().filter((e: any) => e.e === 'odd');
}
r.screen.isTrackingStill = () => true;
// a frozen screen on a route that matches
frozenFor = 75;
let odd = odds([...Array(14).fill('/a'), '/b']);
check('a route that stays 60 s on a frozen screen is odd: frozen, yellow', odd.length === 1 && odd[0].why === 'frozen' && odd[0].level === 'yellow' && odd[0].path === '/a' && odd[0].still === 75, JSON.stringify(odd));
frozenFor = 0;
odd = odds([...Array(14).fill('/a'), '/b']);
check('a screen that is changing is not odd (the script is working)', odd.length === 0, JSON.stringify(odd));
// the action is called again and again, each one short, the route does not change: the real action code counts and times it
r.doActionForRoute = function (context: any, image: any, route: any, pages: any, finishRound: any) {
  realDoAction.call(r, context, image, route, pages, finishRound);
  if (frame >= frames.length) { finishRound(false); }
};
frames.length = 0;
const quick = { action: () => { now += 100; }, shouldMatchTimes: 0, shouldMatchDuring: 0, beforeRoute: null, afterRoute: null, beforeActionDelay: 0, afterActionDelay: 0, debug: false, match: null };
r.findMatchedRouteImpl = () => {
  const path = frames[frame++];
  return path === null ? [] : [{ matchedRoute: Object.assign({ path }, quick), matchedPages: [{ name: 'p' }] }];
};
odd = odds([...Array(14).fill('/a'), '/b']);
check('the action called 13 times, each one short, and the route does not change: odd, no-effect', odd.length === 1 && odd[0].why === 'no-effect' && odd[0].actions >= 10 && odd[0].action_ms < odd[0].ms / 2, JSON.stringify(odd));
const slow = Object.assign({}, quick, { action: () => { now += 9000; } });
r.findMatchedRouteImpl = () => {
  const path = frames[frame++];
  return path === null ? [] : [{ matchedRoute: Object.assign({ path }, slow), matchedPages: [{ name: 'p' }] }];
};
odd = odds([...Array(14).fill('/a'), '/b']);
const stay1 = events().filter((e: any) => e.e === 'stay');
check('an action that takes most of the time (the script is working inside it) is not odd, and the stay says so', odd.length === 0 && stay1.length === 1 && stay1[0].action_ms > stay1[0].ms / 2, JSON.stringify(stay1));
r.doActionForRoute = function (context: any, image: any, route: any, pages: any, finishRound: any) { if (frame >= frames.length) { finishRound(false); } };
r.findMatchedRouteImpl = () => {
  const path = frames[frame++];
  return path === null ? [] : [{ matchedRoute: { path }, matchedPages: [{ name: 'page' + path.replace('/', '') }] }];
};
r.screen.isTrackingStill = () => false;
// a long unknown screen, once per stretch; not for a fight
r.unknownRouteAction = () => {};
odd = odds([...Array(8).fill(null), '/b']);
check('a screen that no route matches for 15 s is odd once: unknown-long', odd.length === 1 && odd[0].why === 'unknown-long' && odd[0].ms >= 15000 && odd[0].level === 'yellow', JSON.stringify(odd));
odd = odds([...Array(8).fill(null), '/b'], () => { r.unknownRouteAction = () => { r.markUnknownExpected('battle'); }; });
check('a fight that the action says is expected is not odd', odd.length === 0, JSON.stringify(odd));
r.unknownRouteAction = () => {};
// a loop: the same way round, in one round of a task
odd = odds(['/a', '/b', '/a', '/b', '/a', '/b', '/a', '/b', '/a', '/b', '/a', '/b', '/a', '/b']);
const ab = odd.filter((e: any) => e.from === '/a' && e.to === '/b');
check('the same way round 3 times is odd: loop, and again at 6', ab.map((e: any) => e.count).join(',') === '3,6' && ab[0].via === 'route' && ab[0].why === 'loop', JSON.stringify(ab));
odd = odds(['/a', null, '/a', null, '/a', null, '/a']);
check('a / unknown / a: a loop through an unknown screen', odd.some((e: any) => e.why === 'loop' && e.via === 'unknown' && e.from === '/a' && e.to === '/a' && e.count === 3), JSON.stringify(odd));
odd = odds(['/a', null, '/a', null, '/a', null, '/a'], () => { r.unknownRouteAction = () => { r.markUnknownExpected('battle'); }; });
check('the same through a fight is not odd', odd.filter((e: any) => e.why === 'loop').length === 0, JSON.stringify(odd));
r.unknownRouteAction = () => {};
r.rerouterConfig.oddRules = { unknownSec: 0, frozenSec: 0, noEffectActions: 0, loopCount: 0 };
odd = odds(['/a', '/b', '/a', '/b', '/a', '/b', '/a'].concat(Array(8).fill(null) as any, ['/b']));
check('a rule that is 0 is off', odd.length === 0, JSON.stringify(odd));
r.rerouterConfig.oddRules = { unknownSec: 15, frozenSec: 60, noEffectActions: 10, loopCount: 3 };

// task_end: cut off at its time limit by the time that really passed
r.rerouterConfig.eventLog = true;
function round(maxMs: number, spendMs: number) {
  const t: any = { name: 'pvp', lastRunTime: 0, startTime: 0, runTimes: 0, config: { minRoundInterval: 0, maxTaskRunTimes: 1, maxTaskDuring: maxMs, beforeTask: null, afterTask: null, findRouteDelay: 0 } };
  r.tasks = [t]; r.globalBeforeTaskAction = null; r.globalAfterTaskAction = null; r.rerouterConfig.taskDelay = 0;
  r.startRouteLoop = () => { now += spendMs; r.running = false; return false; };
  r.running = true; printed.length = 0;
  r.startTaskLoop();
  return events().filter((e: any) => e.e === 'task_start' || e.e === 'task_end');
}
let marks = round(180000, 186000);
check('a task that took 186 s of the 180 s it may take is cut off', marks[0].e === 'task_start' && marks[0].max === 180 && marks[1].e === 'task_end' && marks[1].reason === 'timeout' && marks[1].ms === 186000, JSON.stringify(marks));
marks = round(180000, 60000);
check('a task that took 60 s of 180 s is done', marks[1].reason === 'done' && marks[1].ms === 60000, JSON.stringify(marks));
marks = round(0, 60000);
check('no limit: done', marks[1].reason === 'done' && marks[0].max === undefined, JSON.stringify(marks));

console.log = realLog;
process.stdout.write(failed ? failed + ' failed\n' : 'route events passed\n');
process.exit(failed ? 1 : 0);
