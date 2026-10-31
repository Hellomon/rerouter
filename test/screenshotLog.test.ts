import { Screen } from '../src/screen';
import { DEFAULT_SCREEN_CONFIG } from '../src/defaults';
import { Utils } from '../src/utils';

// FIXME: should use a test framework. Run: npx ts-node --transpile-only test/screenshotLog.test.ts
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

let deviceSize = { width: 1280, height: 720 };
let modifyShots = 0;          // getScreenshotModify: the capture of the script
let fullShots = 0;            // getScreenshot: the capture of the whole screen
const released: any[] = [];
const saved: { image: any; path: string }[] = [];
const shell: string[] = [];
const made = (): number => shell.filter(c => c.startsWith('mkdir')).length;
const cleanups = (): number => shell.filter(c => c.startsWith('ls -t1') || c.startsWith('find')).length;
let failSaves = 0;
g.getScreenshotModify = () => { modifyShots++; return { modify: modifyShots }; };
g.getScreenshot = () => { fullShots++; return { full: fullShots, ...deviceSize }; };
g.getImageSize = (image: any) => ({ width: image.width, height: image.height });
g.cropImage = (image: any, x: number, y: number, w: number, h: number) => ({ cropped: image, x, y, width: w, height: h });
g.resizeImage = (image: any, w: number, h: number) => ({ resized: image, width: w, height: h });
g.releaseImage = (image: any) => { released.push(image); };
g.saveImage = (image: any, path: string) => { if (failSaves > 0) { failSaves--; throw new Error('no folder'); } saved.push({ image, path }); };
g.execute = (cmd: string) => { shell.push(cmd); return ''; };

function make(extra: object) {
  return new Screen({ ...DEFAULT_SCREEN_CONFIG, logScreenshotFolder: 'dev1', logScreenshotMinIntervalInSec: 20, logScreenshotMaxFiles: 1000, logScreenshotThumbnail: false,   // the pictures alone here; the thumbnails are in thumbnail.test.ts
   
    devWidth: 640, devHeight: 360, screenWidth: 1280, screenHeight: 720, screenOffsetX: 0, screenOffsetY: 0, ...extra } as any);
}

const logLines = console.log;
const warnLines = console.warn;
const said: string[] = [];
const warned: string[] = [];
console.log = (...args: any[]) => { said.push(args.join(' ')); };
console.warn = (...args: any[]) => { warned.push(args.join(' ')); };
const imageLogLines = (): number => said.filter(l => l.startsWith('Image log:')).length;
try {
  // ---- a screen that is scaled: 1280x720 at the development size 640x360
  let screen = make({});
  const first = screen.getCvtDevScreenshot();
  check('the log is due: the whole screen is captured once, and that capture is saved', fullShots === 1 && saved.length === 1 && saved[0].image.full === 1, '');
  check('the script gets that capture at the development size', first.resized.full === 1 && first.width === 640 && first.height === 360, JSON.stringify(first).slice(0, 80));
  check('no second capture of the script', modifyShots === 0, String(modifyShots));
  check('the whole screen is released once it is not needed', released.some(r => r.full === 1), '');
  check('the file is in the folder of the device', /dev1\/.*_log\.png$/.test(saved[0].path), saved[0].path);
  check('no mkdir: saveImage makes the folder', made() === 0, String(made()));
  const firstCleanups = cleanups();
  check('the old files are looked for at the first save', firstCleanups === 1, String(firstCleanups));
  check('no line of the log for the picture', !said.some(l => l.startsWith('Write to file')), said.join(' | '));
  check('one line says what was saved, when the old files are looked for', imageLogLines() === 1 && /saved/.test(said[said.length - 1]), said[said.length - 1]);

  now += 5000;
  const plain = screen.getCvtDevScreenshot();
  check('before the interval the script takes its own capture and nothing is saved', plain.modify === 1 && fullShots === 1 && saved.length === 1, '');
  now += 16000; screen.getCvtDevScreenshot();
  check('the next one is saved after 20 s', saved.length === 2 && fullShots === 2, String(saved.length));
    check('the old files are not looked for again', cleanups() === firstCleanups, String(cleanups()));

  for (let i = 0; i < 28; i++) { now += 20000; screen.getCvtDevScreenshot(); }   // about 9 more minutes
  check('still not looked for before 10 minutes since the last time', cleanups() === firstCleanups, String(cleanups()));
  now += 60000; screen.getCvtDevScreenshot();
  check('looked for again after 10 minutes, once', cleanups() === firstCleanups + 1, String(cleanups()));
  check('and one more line then, not one for every picture', imageLogLines() === 2 && !said.some(l => l.startsWith('Write to file')), String(imageLogLines()));
  check('the line has the count of the pictures', /Image log: \d+ saved in \d+ min, last .*_log\.png/.test(said[said.length - 1]) && Number(/Image log: (\d+)/.exec(said[said.length - 1])![1]) > 10, said[said.length - 1]);
  check('and still no mkdir', made() === 0, String(made()));

  // a folder that was deleted: the save fails, the folder is made again, the file is saved
  failSaves = 1; now += 21000;
  const before = saved.length, madeBefore = made();
  screen.getCvtDevScreenshot();
  check('a save that fails makes the folder and saves again, once', saved.length === before + 1 && made() === madeBefore + 1, '');
  check('and says so', warned.some(l => l.startsWith('saveImage failed')), warned.join(' | '));
  // a save that fails twice does not take the screenshot from the caller
  failSaves = 2; now += 21000;
  const survived = screen.getCvtDevScreenshot();
  check('a save that cannot be done still gives the script its image', survived !== undefined && survived.width === 640, '');

  // ---- a screen with an offset: the area is cut first, then scaled
  fullShots = 0; saved.length = 0;
  screen = make({ screenOffsetX: 0, screenOffsetY: 40, screenHeight: 640, devHeight: 320, logScreenshotLastTime: 0, logScreenshotLastCleanupTime: 0 });
  now += 60000;
  const cut = screen.getCvtDevScreenshot();
  check('the area is cut from the capture and scaled', cut.resized.cropped.full === 1 && cut.resized.y === 40 && cut.resized.height === 640 && cut.height === 320, '');
  check('the saved one is the whole screen', saved.length === 1 && saved[0].image.full === 1 && saved[0].image.width === 1280, '');
  check('the piece that was cut is released too', released.some(r => r.cropped && r.y === 40), '');

  // ---- the screen is the development size already: the capture is the image, saved and returned as it is
  deviceSize = { width: 640, height: 360 }; fullShots = 0; saved.length = 0; released.length = 0;
  screen = make({ screenWidth: 640, screenHeight: 360, logScreenshotLastTime: 0 });
  const same = screen.getCvtDevScreenshot();
  check('saved and returned are the same capture, not released', saved.length === 1 && saved[0].image === same && !released.includes(same), '');

  // ---- not known yet which area is the screen: as before, two captures
  fullShots = 0; modifyShots = 0; saved.length = 0;
  screen = make({ screenWidth: 0, screenHeight: 0, logScreenshotLastTime: 0 });
  screen.getCvtDevScreenshot();
  check('without the screen size it falls back to the old way', modifyShots === 1 && saved.length === 1, `${modifyShots} ${saved.length}`);

  // ---- called with no image (an older caller): it checks the time and takes a screenshot itself
  fullShots = 0; saved.length = 0;
  screen = make({ logScreenshotLastTime: 0 });
  screen.checkAndSaveScreenshots();
  check('with no image it takes one itself', fullShots === 1 && saved.length === 1, '');
  screen.checkAndSaveScreenshots();
  check('and it keeps the interval', saved.length === 1, '');

  // ---- the other callers of saveScreenshotToDisk still get their line
  said.length = 0;
  const written = Utils.saveScreenshotToDisk('matched', 'x', false, { x: 1 } as any, '/root/');
  check('another caller still says where it wrote', said.length === 1 && said[0] === 'Write to file: /root/matched/x.png' && written === '/root/matched/x.png', said.join(' | '));

  // ---- no folder: nothing at all
  const quiet = new Screen({ ...DEFAULT_SCREEN_CONFIG, screenWidth: 1280, screenHeight: 720 } as any);
  const count = saved.length; fullShots = 0;
  now += 60000; quiet.getCvtDevScreenshot();
  check('no folder, no save, no whole-screen capture', saved.length === count && fullShots === 0, '');
} finally {
  console.log = logLines;
  console.warn = warnLines;
  Date.now = realNow;
}
if (failed > 0) {
  throw new Error(failed + ' case(s) failed');
}
process.stdout.write('screenshot log passed\n');
