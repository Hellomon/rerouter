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
r.screen = { getRotation: () => 'vertical', getCvtDevScreenshot: () => ({}), getLastLogImage: () => lastImage };
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
const pins = events().filter((e: any) => e.pin);
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
const circle = events().filter((e: any) => e.pin);
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

console.log = realLog;
process.stdout.write(failed ? failed + ' failed\n' : 'route events passed\n');
process.exit(failed ? 1 : 0);
