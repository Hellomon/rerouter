import { Screen } from '../src/screen';
import { DEFAULT_SCREEN_CONFIG } from '../src/defaults';

// FIXME: should use a test framework. Run: npx ts-node --transpile-only test/stuckPin.test.ts
let failed = 0;
function check(name: string, ok: boolean, detail: string = '') {
  process.stdout.write((ok ? 'ok   ' : 'FAIL ') + name + ' ' + detail + '\n');
  if (!ok) {
    failed++;
  }
}

const g = global as any;
let now = Date.UTC(2026, 10, 2, 2, 0, 0);
Date.now = () => now;
const saved: { path: string; quality?: number }[] = [];
const released: any[] = [];
const shell: string[] = [];
let lsAnswer = '';
// a picture is {id}; two pictures are the same screen when they have the same id
g.getImageSize = () => ({ width: 640, height: 360 });
g.resizeImage = (image: any, w: number, h: number) => ({ id: image.id, w, h });
g.getIdentityScore = (a: any, b: any) => (a.id === b.id ? 1 : 0.5);
g.releaseImage = (image: any) => { released.push(image); };
g.saveImage = (_image: any, path: string, quality?: number) => { saved.push({ path, quality }); };
g.execute = (cmd: string) => { shell.push(cmd); return cmd.indexOf('ls -t1') === 0 ? lsAnswer : ''; };

function make(extra: object = {}) {
  return new Screen({ ...DEFAULT_SCREEN_CONFIG, logScreenshotFolder: 'dev1', stuckScreenshot: true, devWidth: 640, devHeight: 360, screenWidth: 640, screenHeight: 360,
    screenOffsetX: 0, screenOffsetY: 0, ...extra } as any);
}
const pngs = () => saved.filter(s => s.path.endsWith('.png'));
const jpgs = () => saved.filter(s => s.path.endsWith('.jpg'));

const realLog = console.log;
const realWarn = console.warn;
const warned: string[] = [];
console.log = () => {};
console.warn = (...args: any[]) => { warned.push(args.join(' ')); };
try {
  check('off by default', DEFAULT_SCREEN_CONFIG.stuckScreenshot === false && DEFAULT_SCREEN_CONFIG.stuckAfterSec === 15 && DEFAULT_SCREEN_CONFIG.stuckScreenshotMaxFiles === 300 && DEFAULT_SCREEN_CONFIG.stuckScreenshotMaxDays === 14 && DEFAULT_SCREEN_CONFIG.stuckRepeatEntries === 3 && DEFAULT_SCREEN_CONFIG.stuckRepeatAfterSec === 5);

  let screen = make({ stuckScreenshot: false });
  check('off: nothing is kept', screen.pinStuckScreenshot({ id: 'a' }) === null && saved.length === 0);
  screen = make({ logScreenshotFolder: '' });
  check('no folder: nothing is kept', screen.pinStuckScreenshot({ id: 'a' }) === null && saved.length === 0);

  screen = make();
  let r = screen.pinStuckScreenshot({ id: 'a' });
  const first = r ? r.name : '';
  check('a new screen: a picture and a thumbnail in the stuck folder', r !== null && !r.same && pngs().length === 1 && jpgs().length === 1 && /dev1\/stuck\/.*_stuck\.png$/.test(pngs()[0].path), saved.map(s => s.path).join(' '));
  check('the name is the file without the folder and .png', r !== null && /^\d{4}-\d\d-\d\dT\d\d\.\d\d\.\d\d_stuck$/.test(r.name), r ? r.name : '');
  check('the thumbnail has the name of the picture', jpgs()[0].path === pngs()[0].path.replace(/\.png$/, '.jpg') && jpgs()[0].quality === 60);

  now += 45000;
  r = screen.pinStuckScreenshot({ id: 'a' });
  check('the same screen again: not kept again, the name of the first comes back', r !== null && r.same && r.name === first && pngs().length === 1, JSON.stringify(r));
  r = screen.pinStuckScreenshot({ id: 'b' });
  check('another screen: kept', r !== null && !r.same && pngs().length === 2, JSON.stringify(r));
  r = screen.pinStuckScreenshot({ id: 'a' });
  check('the first one is still known after another was kept', r !== null && r.same && r.name === first && pngs().length === 2);

  // only the last PINNED_REMEMBERED are compared: older ones are forgotten and released
  for (let i = 0; i < 25; i++) { now += 1000; screen.pinStuckScreenshot({ id: 'x' + i }); }
  r = screen.pinStuckScreenshot({ id: 'a' });
  check('a screen of long ago is kept again (only the last 20 are compared)', r !== null && !r.same);
  check('the small copies that are forgotten are released', released.filter((x: any) => x.w === 160 && x.h === 90).length >= 7);

  // the limits: the folder is cleaned with its own numbers and its own suffix
  shell.length = 0;
  screen = make({ stuckScreenshotMaxFiles: 3, stuckScreenshotMaxDays: 5 });
  screen.pinStuckScreenshot({ id: 'c' });
  check('old files by age, then by number', shell.some(c => /find ".*dev1\/stuck" .*-mtime \+5/.test(c)) && shell.some(c => c.indexOf('ls -t1') === 0 && c.indexOf('dev1/stuck') > 0), shell.join(' | '));
  shell.length = 0;
  lsAnswer = ['e_stuck.jpg', 'e_stuck.png', 'd_stuck.jpg', 'd_stuck.png', 'c_stuck.jpg', 'c_stuck.png', 'b_stuck.jpg', 'b_stuck.png', 'a_stuck.png'].join('\n');
  screen.pinStuckScreenshot({ id: 'd' });
  const removal = shell.find(c => c.indexOf('rm -rf') === 0) || '';
  check('the thumbnails are not counted, the thumbnail goes with its picture, one without a picture goes', /b_stuck\.jpg/.test(removal) && /b_stuck\.png/.test(removal) && /a_stuck\.png/.test(removal) && !/c_stuck/.test(removal) && !/e_stuck/.test(removal), removal);

  // the image log's own cleanup (flat folder) must not take the stuck folder, which lives inside it
  const { Utils } = require('../src/utils');
  shell.length = 0;
  lsAnswer = ['stuck', '2026-11-02T10.00.12_log.jpg', '2026-11-02T10.00.12_log.png', '2026-11-02T10.00.09_log.jpg', '2026-11-02T10.00.09_log.png', '2026-11-02T10.00.06_log.png'].join('\n');
  Utils.removeOldestFilesIfExceedsLimit('dev1', 1, -1);
  const logRemoval = shell.find(c => c.indexOf('rm -rf') === 0) || '';
  check('the cleanup of the image log leaves the stuck folder alone and still removes the old pictures', logRemoval.indexOf('stuck') < 0 && /10\.00\.09_log\.png/.test(logRemoval) && /10\.00\.06_log\.png/.test(logRemoval) && !/10\.00\.12/.test(logRemoval), logRemoval);

  shell.length = 0;
  Utils.removeOldestFilesIfExceedsLimit('dev1', 10, 3);
  check('the cleanup of the days of the image log leaves the stuck folder alone too', shell.some(c => /^find .*dev1".* -mtime \+3 ! -name stuck/.test(c)), shell.join(' | '));

  // a failure is a warning, not the end of the script
  g.saveImage = () => { throw new Error('disk full'); };
  g.execute = () => { throw new Error('no shell'); };
  warned.length = 0;
  r = make().pinStuckScreenshot({ id: 'z' });
  check('a failed save: null and a warning', r === null && warned.length > 0, warned.join('|'));
} finally {
  console.log = realLog;
  console.warn = realWarn;
}
process.stdout.write(failed ? failed + ' failed\n' : 'stuck pin passed\n');
process.exit(failed ? 1 : 0);
