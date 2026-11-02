import { Screen } from '../src/screen';
import { DEFAULT_REROUTER_CONFIG, DEFAULT_SCREEN_CONFIG } from '../src/defaults';
import { rerouter } from '../src/rerouter';

// FIXME: should use a test framework. Run: npx ts-node --transpile-only test/stillScreen.test.ts
let failed = 0;
function check(name: string, ok: boolean, detail: string = '') {
  process.stdout.write((ok ? 'ok   ' : 'FAIL ') + name + ' ' + detail + '\n');
  if (!ok) {
    failed++;
  }
}

const g = global as any;
let now = Date.UTC(2026, 9, 31, 4, 0, 0);
const realNow = Date.now;
Date.now = () => now;

// the screens the script sees: the name of the picture is its number; getIdentityScore says 1 for two of the same number, 0.2 for others
let showing = 'A';
let thumbs = 0, released = 0;
g.getScreenshotModify = () => ({ pic: showing });
g.getScreenshot = () => ({ pic: showing });
g.getImageSize = () => ({ width: 640, height: 360 });
g.resizeImage = (image: any, w: number, h: number) => { thumbs++; return { pic: image.pic, w, h }; };
g.getIdentityScore = (a: any, b: any) => (a.pic === b.pic ? 1 : 0.2);
g.releaseImage = () => { released++; };
g.saveImage = () => {};
g.execute = () => '';

const said: string[] = [];
// ---- the defaults: the frozen-screen restart is on, as it always was; comparing every screenshot is off
check('the frozen screen restart is on by default', DEFAULT_REROUTER_CONFIG.checkFrozenScreen === true, '');
check('comparing every screenshot is off by default', DEFAULT_SCREEN_CONFIG.trackStillScreen === false, '');
check('nothing about writing the still screen to the log is left in the settings', !('logStillScreen' in DEFAULT_SCREEN_CONFIG) && !('stillScreenHeartbeatSeconds' in DEFAULT_SCREEN_CONFIG), '');

const real = console.log;
const scr = (): string[] => said.filter(l => l.startsWith('SCR '));
console.log = (...a: any[]) => { said.push(a.join(' ')); };
try {
  // off by default: nothing at all
  thumbs = 0;
  const off = new Screen({ ...DEFAULT_SCREEN_CONFIG, screenWidth: 640, screenHeight: 360, devWidth: 640, devHeight: 360 } as any);
  now += 5000; off.getCvtDevScreenshot(); now += 5000; off.getCvtDevScreenshot();
  check('off by default: no line, no small picture', said.length === 0 && thumbs === 0, `${said.length} ${thumbs}`);

  // ---- the frozen screen: every screenshot compared with the one before, nothing written, and what checkScreenFrozen reads
  said.length = 0; showing = 'A';
  const watcher = new Screen({ ...DEFAULT_SCREEN_CONFIG, screenWidth: 640, screenHeight: 360, devWidth: 640, devHeight: 360, trackStillScreen: true } as any);
  const seeW = (pic: string, afterSeconds: number) => { now += afterSeconds * 1000; showing = pic; watcher.getCvtDevScreenshot(); };
  seeW('A', 0); seeW('A', 4); seeW('A', 4);
  check('compared with nothing written when trackStillScreen is on', scr().length === 0 && watcher.getFrozenSeconds() === 8, `${scr().length} ${watcher.getFrozenSeconds()}`);
  seeW('A', 100);                               // the script looked away for 100 s: the screen is the same as it was, the frozen time goes on
  check('a gap does not end a frozen screen (the screen is the same as the last time)', watcher.getFrozenSeconds() === 108, String(watcher.getFrozenSeconds()));
  seeW('B', 4);
  check('a change ends it', watcher.getFrozenSeconds() === 0, String(watcher.getFrozenSeconds()));
  const nobody = new Screen({ ...DEFAULT_SCREEN_CONFIG, screenWidth: 640, screenHeight: 360, devWidth: 640, devHeight: 360 } as any);
  thumbs = 0; now += 5000; nobody.getCvtDevScreenshot(); now += 5000; nobody.getCvtDevScreenshot();
  check('nothing is compared when trackStillScreen is off', thumbs === 0 && nobody.getFrozenSeconds() === 0, String(thumbs));

  // ---- Rerouter.checkScreenFrozen: no screenshot of its own, restarts after 10 minutes of the same screen
  let frozen = 0, stops = 0, captures = 0;
  const r = rerouter as any;
  r.screen = { isTrackingStill: () => true, getFrozenSeconds: () => frozen, getCvtDevScreenshot: () => { captures++; } };
  r.stopEmulator = () => { stops++; };
  r.sendLog = () => true;
  r.screenFrozenTimes = 0;
  said.length = 0;
  frozen = 30; r.checkScreenFrozen();
  check('less than a minute: nothing', said.length === 0 && stops === 0, said.join(' | '));
  frozen = 61; r.checkScreenFrozen(); r.checkScreenFrozen();
  check('a minute: said once, not at every call', said.filter(l => l.startsWith('Screen is frozen, times 1')).length === 1, said.join(' | '));
  frozen = 5 * 60 + 5; r.checkScreenFrozen();
  check('minutes count up', /times 5$/.test(said[said.length - 1]) && stops === 0, said[said.length - 1]);
  frozen = 0; r.checkScreenFrozen();
  frozen = 119; r.checkScreenFrozen();
  check('a change starts over', /times 1$/.test(said[said.length - 1]) && stops === 0, said[said.length - 1]);
  frozen = 599; r.checkScreenFrozen();
  check('9 minutes: no restart', stops === 0, String(stops));
  frozen = 600; r.checkScreenFrozen();
  check('10 minutes: restart', stops === 1, String(stops));
  check('and it never took a screenshot of its own', captures === 0, String(captures));

  // ---- with the switch off (the default) checkScreenFrozen is what it always was: once a minute a screenshot of its own, compared with the one before
  let own = 0, legacyStops = 0;
  r.screen = { isTrackingStill: () => false, getCvtDevScreenshot: () => { own++; return { pic: showing }; } };
  r.stopEmulator = () => { legacyStops++; };
  r.screenFrozenTimes = 0; r.lastScreenshotImage = null; r.lastCheckScreenFrozenTime = 0;
  said.length = 0; showing = 'A';
  const minute = () => { now += 61000; r.checkScreenFrozen(); };
  r.checkScreenFrozen();
  check('off: the first call takes the first screenshot', own === 1, String(own));
  now += 30000; r.checkScreenFrozen();
  check('off: not again before a minute', own === 1, String(own));
  minute();
  check('off: a minute later one more, compared, and the score is said', own === 2 && said.some(l => l.startsWith('checkScreenFrozen: score: 1')) && said.some(l => l === 'Screen is frozen, times 1'), said.join(' | '));
  showing = 'B'; minute();
  check('off: a change starts over', said[said.length - 1].startsWith('checkScreenFrozen: score: 0.2') && r.screenFrozenTimes === 0, said[said.length - 1]);
  for (let i = 0; i < 9; i++) { minute(); }
  check('off: 9 minutes of the same screen are not enough', legacyStops === 0 && r.screenFrozenTimes === 9, `${legacyStops} ${r.screenFrozenTimes}`);
  minute();
  check('off: the 10th restarts', legacyStops === 1, String(legacyStops));

  // an error of the monitor does not take the screenshot away
  g.getIdentityScore = () => { throw new Error('no such function'); };
  const screen = new Screen({ ...DEFAULT_SCREEN_CONFIG, screenWidth: 640, screenHeight: 360, devWidth: 640, devHeight: 360, trackStillScreen: true } as any);
  now += 5000; showing = 'X'; screen.getCvtDevScreenshot();
  now += 5000; showing = 'Y';
  const got = screen.getCvtDevScreenshot();
  check('a failing comparison still gives the script its image', got !== undefined && got.pic === 'Y', '');
} finally {
  console.log = real;
  Date.now = realNow;
}
if (failed > 0) {
  throw new Error(failed + ' case(s) failed');
}
process.stdout.write('still screen passed\n');
