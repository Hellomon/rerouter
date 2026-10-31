import { Screen } from '../src/screen';
import { DEFAULT_SCREEN_CONFIG } from '../src/defaults';
import { Utils } from '../src/utils';

// FIXME: should use a test framework. Run: npx ts-node --transpile-only test/thumbnail.test.ts
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
let fullShots = 0;
const released: any[] = [];
const saved: { image: any; path: string; quality?: number }[] = [];
const shell: string[] = [];
let lsAnswer = '';
let failThumb = false;
g.getScreenshotModify = () => ({ modify: true });
g.getScreenshot = () => { fullShots++; return { full: fullShots, ...deviceSize }; };
g.getImageSize = (image: any) => ({ width: image.width, height: image.height });
g.cropImage = (image: any, x: number, y: number, w: number, h: number) => ({ cropped: image, x, y, width: w, height: h });
g.resizeImage = (image: any, w: number, h: number) => ({ resized: image, width: w, height: h });
g.releaseImage = (image: any) => { released.push(image); };
g.saveImage = (image: any, path: string, quality?: number) => {
  if (failThumb && path.endsWith('.jpg')) { throw new Error('disk full'); }
  saved.push({ image, path, quality });
};
g.execute = (cmd: string) => { shell.push(cmd); return cmd.startsWith('ls -t1') ? lsAnswer : ''; };

function make(extra: object = {}) {
  return new Screen({ ...DEFAULT_SCREEN_CONFIG, logScreenshotFolder: 'dev1', logScreenshotMinIntervalInSec: 20, logScreenshotMaxFiles: 1000,
    devWidth: 640, devHeight: 360, screenWidth: 1280, screenHeight: 720, screenOffsetX: 0, screenOffsetY: 0, ...extra } as any);
}
const pngs = () => saved.filter(s => s.path.endsWith('.png'));
const jpgs = () => saved.filter(s => s.path.endsWith('.jpg'));

const logLines = console.log;
const warnLines = console.warn;
const said: string[] = [];
const warned: string[] = [];
console.log = (...args: any[]) => { said.push(args.join(' ')); };
console.warn = (...args: any[]) => { warned.push(args.join(' ')); };
try {
  check('it is on by default, 240 on the long side, quality 60', DEFAULT_SCREEN_CONFIG.logScreenshotThumbnail === true && DEFAULT_SCREEN_CONFIG.logScreenshotThumbnailSize === 240 && DEFAULT_SCREEN_CONFIG.logScreenshotThumbnailQuality === 60, '');

  // ---- a thumbnail beside every picture
  let screen = make();
  screen.getCvtDevScreenshot();
  check('one picture and one thumbnail', pngs().length === 1 && jpgs().length === 1, saved.map(s => s.path).join(' '));
  check('the thumbnail has the name of the picture, with .jpg', jpgs()[0].path === pngs()[0].path.replace(/\.png$/, '.jpg') && /dev1\/.*_log\.jpg$/.test(jpgs()[0].path), jpgs()[0].path);
  check('240x135 of a 1280x720 screen, made from the whole capture', jpgs()[0].image.width === 240 && jpgs()[0].image.height === 135 && jpgs()[0].image.resized.full === 1, JSON.stringify(jpgs()[0].image).slice(0, 80));
  check('with the quality of the config', jpgs()[0].quality === 60, String(jpgs()[0].quality));
  check('the small image is released', released.includes(jpgs()[0].image), '');

  // ---- the interval and the number of pictures are as before
  now += 5000; screen.getCvtDevScreenshot();
  check('before the interval nothing is saved, no thumbnail either', pngs().length === 1 && jpgs().length === 1, '');
  now += 16000; screen.getCvtDevScreenshot();
  check('every picture gets one thumbnail, no more', pngs().length === 2 && jpgs().length === 2, '');

  // ---- a screen that is upright: the long side is the height
  deviceSize = { width: 360, height: 640 }; saved.length = 0;
  screen = make({ screenWidth: 360, screenHeight: 640, devWidth: 360, devHeight: 640 });
  screen.getCvtDevScreenshot();
  check('135x240 of a 360x640 screen', jpgs().length === 1 && jpgs()[0].image.width === 135 && jpgs()[0].image.height === 240, JSON.stringify(jpgs()[0] && jpgs()[0].image).slice(0, 80));
  // a screen smaller than the size is not made bigger
  deviceSize = { width: 200, height: 100 }; saved.length = 0;
  screen = make({ screenWidth: 200, screenHeight: 100, devWidth: 200, devHeight: 100 });
  screen.getCvtDevScreenshot();
  check('a small screen keeps its size', jpgs()[0].image.width === 200 && jpgs()[0].image.height === 100, '');
  deviceSize = { width: 1280, height: 720 };

  // ---- the old way of calling it, with no image: the capture is taken here, once, and released here
  saved.length = 0; released.length = 0; fullShots = 0;
  screen = make();
  screen.checkAndSaveScreenshots();
  check('with no image: one capture, a picture and a thumbnail', fullShots === 1 && pngs().length === 1 && jpgs().length === 1, `${fullShots}`);
  check('and that capture is released once', released.filter(r => r.full === 1).length === 1, '');

  // ---- off: no thumbnail, and the picture is saved as before
  saved.length = 0;
  screen = make({ logScreenshotThumbnail: false });
  screen.getCvtDevScreenshot();
  check('off: the picture only', pngs().length === 1 && jpgs().length === 0, '');

  // ---- a thumbnail that cannot be saved never costs the picture
  saved.length = 0; warned.length = 0; failThumb = true;
  screen = make();
  const kept = screen.getCvtDevScreenshot();
  failThumb = false;
  check('the picture is saved and the script gets its image', pngs().length === 1 && jpgs().length === 0 && kept.width === 640, '');
  check('a warning says so', warned.some(w => w.startsWith('Warning in the thumbnail')), warned.join(' | '));

  // ---- the line of the log says how much the thumbnails cost
  said.length = 0; saved.length = 0;
  screen = make();
  now += 60000; screen.getCvtDevScreenshot();
  check('the line has the thumbnails', said.some(l => /^Image log: 1 saved .*; thumbnails 1, \d+ ms each$/.test(l)), said.join(' | '));

  // ---- the cleanup: the pictures are counted, the thumbnails are not, and they go together
  const folder = '/data/media/0/Downloads/dev1';
  const listing = (names: string[]) => names.join('\n');
  const run = (names: string[], max: number): string => {
    shell.length = 0; lsAnswer = listing(names);
    Utils.removeOldestFilesIfExceedsLimit('dev1', max, -1, '/data/media/0/Downloads/');
    return shell.filter(c => c.startsWith('rm ')).join(' ');
  };
  // newest first, as `ls -t1` gives them
  const pair = (t: string) => [`2026-10-31T${t}_log.png`, `2026-10-31T${t}_log.jpg`];
  const names = [...pair('10.00.50'), ...pair('10.00.40'), ...pair('10.00.30'), ...pair('10.00.20'), ...pair('10.00.10')];
  check('3 pictures with their 3 thumbnails: nothing is deleted when 3 are allowed', run(names.slice(0, 6), 3) === '', run(names.slice(0, 6), 3));
  const removal = run(names, 3);
  check('5 pictures, 3 allowed: the 2 oldest pictures go', removal.includes('10.00.20_log.png') && removal.includes('10.00.10_log.png'), removal);
  check('and their thumbnails with them', removal.includes('10.00.20_log.jpg') && removal.includes('10.00.10_log.jpg'), removal);
  check('the 3 that stay keep their thumbnails', !/10\.00\.(50|40|30)_log/.test(removal), removal);
  const orphan = run(['2026-10-31T10.00.50_log.png', '2026-10-31T10.00.50_log.jpg', '2026-10-31T09.00.00_log.jpg'], 5);
  check('a thumbnail whose picture is not there is deleted', orphan.includes('09.00.00_log.jpg') && !orphan.includes('10.00.50'), orphan);
  const old = run(['2026-10-31T10.00.50_log.png', '2026-10-31T10.00.40_log.png', '2026-10-31T10.00.30_log.png'], 2);
  check('folders without thumbnails (old ones) are cleaned as before', old.includes('10.00.30_log.png') && !old.includes('10.00.40'), old);
  check('the path is the folder of the device', removal.includes(folder + '/'), removal.slice(0, 80));
} finally {
  console.log = logLines;
  console.warn = warnLines;
  Date.now = realNow;
}
if (failed > 0) {
  throw new Error(failed + ' case(s) failed');
}
process.stdout.write('thumbnail passed\n');
