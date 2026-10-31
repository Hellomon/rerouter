import type { ScreenConfig, XY, XYRGB } from './struct';
import { Utils } from './utils';
import { DEFAULT_REROUTER_CONFIG } from './defaults';
import { overrideConsole } from './overrides';

export class Screen {
  private config: ScreenConfig;
  // what the image log saved since it last said so (see checkAndSaveScreenshots)
  private logSavedCount = 0;
  private logSavedSince = 0;
  private logLastFile = '';
  // the still screen (trackStill): the small copy of the last screenshot, when it was taken, and the run of screenshots that were the same
  private still = { thumb: null as Image | null, lastAt: 0, runStart: 0, runEnd: 0, watchedMs: 0, frames: 0, lastBeat: 0, announced: false };
  /** The name of the task that runs now, for the `SCR` lines; Rerouter sets it. */
  public taskNameProvider: () => string = () => '-';

  public constructor(config: ScreenConfig) {
    this.config = config;
  }

  public getScreenX(devX: number): number {
    return Math.floor(this.config.screenOffsetX + (devX * this.config.screenWidth) / this.config.devWidth) || 0;
  }

  public getScreenY(devY: number): number {
    return Math.floor(this.config.screenOffsetY + (devY * this.config.screenHeight) / this.config.devHeight) || 0;
  }

  public getScreenXY(devXY: XY): { x: number; y: number };
  public getScreenXY(devX: number, devY: number): { x: number; y: number };
  public getScreenXY(p1: any, p2: any = undefined): { x: number; y: number } {
    if (typeof p1 === 'object') {
      const x = this.getScreenX(p1.x);
      const y = this.getScreenY(p1.y);
      return { x, y };
    } else if (typeof p1 === 'number' && typeof p2 === 'number') {
      const x = this.getScreenX(p1);
      const y = this.getScreenY(p2);
      return { x, y };
    } else {
      throw new Error(`getScreenXY wrong params ${p1}, ${p2}`);
    }
  }

  public tap(devXY: { x: number; y: number }): void;
  public tap(devX: number, devY: number): void;
  public tap(p1: any, p2: any = undefined): void {
    if (typeof p1 === 'object') {
      const x = this.getScreenX(p1.x);
      const y = this.getScreenY(p1.y);
      tap(x, y, this.config.actionDuring);
    } else if (typeof p1 === 'number' && typeof p2 === 'number') {
      const x = this.getScreenX(p1);
      const y = this.getScreenY(p2);
      tap(x, y, this.config.actionDuring);
    } else {
      throw new Error(`tapDown wrong params ${p1}, ${p2}`);
    }
  }

  public tapDown(devXY: { x: number; y: number }): void;
  public tapDown(devX: number, devY: number): void;
  public tapDown(p1: any, p2: any = undefined): void {
    if (typeof p1 === 'object') {
      const x = this.getScreenX(p1.x);
      const y = this.getScreenY(p1.y);
      tapDown(x, y, this.config.actionDuring);
    } else if (typeof p1 === 'number' && typeof p2 === 'number') {
      const x = this.getScreenX(p1);
      const y = this.getScreenY(p2);
      tapDown(x, y, this.config.actionDuring);
    } else {
      throw new Error(`tapDown wrong params ${p1}, ${p2}`);
    }
  }

  public moveTo(devXY: { x: number; y: number }): void;
  public moveTo(devX: number, devY: number): void;
  public moveTo(p1: any, p2: any = undefined): void {
    if (typeof p1 === 'object') {
      const x = this.getScreenX(p1.x);
      const y = this.getScreenY(p1.y);
      moveTo(x, y, this.config.actionDuring);
    } else if (typeof p1 === 'number' && typeof p2 === 'number') {
      const x = this.getScreenX(p1);
      const y = this.getScreenY(p2);
      moveTo(x, y, this.config.actionDuring);
    } else {
      throw new Error(`tapDown wrong params ${p1}, ${p2}`);
    }
  }

  public tapUp(devXY: { x: number; y: number }): void;
  public tapUp(devX: number, devY: number): void;
  public tapUp(p1: any, p2: any = undefined): void {
    if (typeof p1 === 'object') {
      const x = this.getScreenX(p1.x);
      const y = this.getScreenY(p1.y);
      tapUp(x, y, this.config.actionDuring);
    } else if (typeof p1 === 'number' && typeof p2 === 'number') {
      const x = this.getScreenX(p1);
      const y = this.getScreenY(p2);
      tapUp(x, y, this.config.actionDuring);
    } else {
      throw new Error(`tapDown wrong params ${p1}, ${p2}`);
    }
  }

  public swipe(fromPnt: { x: number; y: number }, toPnt: { x: number; y: number }, steps: number = 4): void {
    const step_x = (toPnt.x - fromPnt.x) / steps;
    const step_y = (toPnt.y - fromPnt.y) / steps;

    let x = this.getScreenX(fromPnt.x);
    let y = this.getScreenY(fromPnt.y);
    tapDown(x, y, 40, 0);
    sleep(10);
    moveTo(x, y, 40, 0);
    sleep(10);

    for (let i = 0; i < steps; i++) {
      x = this.getScreenX(fromPnt.x + step_x * i);
      y = this.getScreenY(fromPnt.y + step_y * i);

      moveTo(x, y, 40, 0);
      sleep(100);
    }

    moveTo(this.getScreenX(toPnt.x), this.getScreenY(toPnt.y), 40, 0);
    sleep(500);
    tapUp(this.getScreenX(toPnt.x), this.getScreenY(toPnt.y), 40, 0);
    sleep(500);
  }

  public getScreenColor(devXY: { x: number; y: number }): RGB;
  public getScreenColor(devX: number, devY: number): RGB;
  public getScreenColor(p1: any, p2: any = undefined): RGB {
    if (typeof p1 === 'object') {
      const img = this.getCvtDevScreenshot();
      const rgb = getImageColor(img, p1.x, p1.y);
      releaseImage(img);
      return rgb;
    } else if (typeof p1 === 'number' && typeof p2 === 'number') {
      const img = this.getCvtDevScreenshot();
      const rgb = getImageColor(img, p1, p2);
      releaseImage(img);
      return rgb;
    } else {
      throw new Error(`tapDown wrong params ${p1}, ${p2}`);
    }
  }

  public isSameColor(devColorPoint: XYRGB, thres: number = 0.9): boolean {
    const rgb = this.getScreenColor(devColorPoint);
    const score = Utils.identityColor(rgb, devColorPoint);
    if (score > thres) {
      return true;
    }
    return false;
  }

  public isSameColorImage(devColorPoint: XYRGB, image: Image, thres: number = 0.9) {
    const rgb = getImageColor(image, devColorPoint.x, devColorPoint.y);
    const score = Utils.identityColor(rgb, devColorPoint);
    if (score > thres) {
      return true;
    }
    return false;
  }

  // currently real device screenshot
  public getDeviceScreenshot(): Image {
    return getScreenshot();
  }

  // currently device screenshot cut by offset
  public getScreenScreenshot(): Image {
    return getScreenshotModify(
      this.config.screenOffsetX,
      this.config.screenOffsetY,
      this.config.screenWidth,
      this.config.screenHeight,
      this.config.screenWidth,
      this.config.screenHeight,
      100
    );
  }

  /**
   * The image log: a screenshot of the whole screen is saved when logScreenshotMinIntervalInSec has passed since the last one.
   * Called with the image (getCvtDevScreenshot does, the capture it made anyway) it saves that one, whatever the time says: the caller has decided.
   * Called with no image (an older script, or another caller) it checks the time and takes a screenshot itself, as it did before.
   * The old files are looked for at most every logScreenshotCleanupIntervalInSec, and not at every save: it is not exact, up to that much
   * more than logScreenshotMaxFiles (or maxDays) is on the disk until the next time.
   */
  checkAndSaveScreenshots(image: Image | undefined = undefined) {
    if (this.config.logScreenshotFolder === '') {
      return;
    }
    if (image === undefined) {
      if (!this.isLogScreenshotDue()) {
        return;
      }
      this.config.logScreenshotLastTime = Date.now();
    }

    // Build folder path with date if maxDays is configured
    let folderPath = this.config.logScreenshotFolder;
    if (this.config.logScreenshotMaxDays > 0) {
      const timeStr = Utils.timeLabel(overrideConsole.timezoneOffsetHour);
      const datePart = timeStr.split(' ')[0];
      folderPath = `${this.config.logScreenshotFolder}/${datePart}`;
    }

    // quiet: not a line of the log for every picture
    this.logLastFile = Utils.saveScreenshotToDisk(folderPath, 'log', true, image, DEFAULT_REROUTER_CONFIG.saveImageRoot, true);
    if (this.logSavedCount === 0) {
      this.logSavedSince = Date.now();
    }
    this.logSavedCount++;

    if (Date.now() - this.config.logScreenshotLastCleanupTime > this.config.logScreenshotCleanupIntervalInSec * 1000) {
      this.config.logScreenshotLastCleanupTime = Date.now();
      // one line for all of them, when the old files are looked for
      console.log(`Image log: ${this.logSavedCount} saved in ${Math.max(1, Math.round((Date.now() - this.logSavedSince) / 60000))} min, last ${this.logLastFile}`);
      this.logSavedCount = 0;
      Utils.removeOldestFilesIfExceedsLimit(
        this.config.logScreenshotFolder,
        this.config.logScreenshotMaxFiles,
        this.config.logScreenshotMaxDays,
        DEFAULT_REROUTER_CONFIG.saveImageRoot
      );
    }
  }

  private isLogScreenshotDue(): boolean {
    return this.config.logScreenshotFolder !== '' && Date.now() - this.config.logScreenshotLastTime > this.config.logScreenshotMinIntervalInSec * 1000;
  }

  public getCvtDevScreenshot(): Image {
    const image = this.captureCvtDevScreenshot();
    this.trackStillSafely(image);
    return image;
  }

  private captureCvtDevScreenshot(): Image {
    const c = this.config;
    if (!this.isLogScreenshotDue() || c.screenWidth <= 0 || c.screenHeight <= 0) {
      this.checkAndSaveScreenshots();
      return getScreenshotModify(c.screenOffsetX, c.screenOffsetY, c.screenWidth, c.screenHeight, c.devWidth, c.devHeight, 100);
    }
    // The log is due: the whole screen is captured once. That image is saved as it is (the log keeps the resolution of the device), and the image
    // for the script is made from it in the same way getScreenshotModify makes it: cut the screen area, scale it to the development size.
    c.logScreenshotLastTime = Date.now();
    const full = getScreenshot();
    try {
      this.checkAndSaveScreenshots(full);
    } catch (error: any) {
      // the image log is never a reason to lose the screenshot the caller asked for
      console.warn(`Warning in checkAndSaveScreenshots: ${error.message}`);
    }
    return this.toDevImage(full);
  }

  /** The screen area of a screenshot of the whole screen, at the development size. The image that is given is released unless it is the one that is returned. */
  private toDevImage(full: Image): Image {
    const c = this.config;
    const { width, height } = getImageSize(full);
    let image = full;
    if (c.screenOffsetX !== 0 || c.screenOffsetY !== 0 || c.screenWidth !== width || c.screenHeight !== height) {
      image = cropImage(full, c.screenOffsetX, c.screenOffsetY, c.screenWidth, c.screenHeight);
    }
    if (c.devWidth !== c.screenWidth || c.devHeight !== c.screenHeight) {
      const scaled = resizeImage(image, c.devWidth, c.devHeight);
      if (image !== full) {
        releaseImage(image);
      }
      image = scaled;
    }
    if (image !== full) {
      releaseImage(full);
    }
    return image;
  }

  private trackStillSafely(image: Image) {
    try {
      this.trackStill(image);
    } catch (error: any) {
      // the monitor is never a reason to lose the screenshot the caller asked for
      console.warn(`Warning in trackStill: ${error.message}`);
    }
  }

  /**
   * Is the screen changing? Every screenshot the script takes is compared with the one before it (both as a small picture, so it costs little) and
   * what was seen is written to the log, for the monitor (Tailmon) to read without the pictures:
   *
   *   SCR ts=2026-10-31T05:38:25 task=pvp still=18 end=changed      a run of the same screen, 18 s long, has ended (end=ongoing: it goes on)
   *   SCR ts=2026-10-31T05:39:25 task=pvp watch=60 frames=14        in the last 60 s 14 screenshots were compared (what was looked at)
   *
   * A run is from the first of the screenshots that were the same to the last of them, so it is a little shorter than the screen really stood
   * still: the screenshots are a few seconds apart. Two screenshots more than MAX_STILL_GAP_MS apart are not compared (the script was not looking).
   */
  private trackStill(image: Image) {
    const c = this.config;
    if (!c.logStillScreen) {
      return;
    }
    const now = Date.now();
    const st = this.still;
    const thumb = resizeImage(image, 160, 90);
    if (!st.announced) {
      st.announced = true;
      st.lastBeat = now;
      this.logStill(`on score=${c.stillScreenScore} min=${c.stillScreenMinSeconds} beat=${c.stillScreenHeartbeatSeconds}`);
    }
    if (st.thumb !== null) {
      const gap = now - st.lastAt;
      if (gap > Screen.MAX_STILL_GAP_MS) {
        this.endStillRun('gap');
      } else {
        st.watchedMs += gap;
        st.frames++;
        if (getIdentityScore(thumb, st.thumb) > c.stillScreenScore) {
          if (st.runStart === 0) {
            st.runStart = st.lastAt;
          }
          st.runEnd = now;
        } else {
          this.endStillRun('changed');
        }
      }
      releaseImage(st.thumb);
    }
    st.thumb = thumb;
    st.lastAt = now;

    if (now - st.lastBeat >= c.stillScreenHeartbeatSeconds * 1000) {
      if (st.runStart !== 0 && st.runEnd - st.runStart >= c.stillScreenMinSeconds * 1000) {
        this.logStill(`still=${Math.round((st.runEnd - st.runStart) / 1000)} end=ongoing`);
      }
      if (st.frames > 0) {
        // nothing is said of a minute in which nothing was compared: that the line is not there is how the monitor knows it was not looked at
        this.logStill(`watch=${Math.round(st.watchedMs / 1000)} frames=${st.frames}`);
      }
      st.watchedMs = 0;
      st.frames = 0;
      st.lastBeat = now;
    }
  }

  private endStillRun(reason: string) {
    const st = this.still;
    if (st.runStart !== 0 && st.runEnd - st.runStart >= this.config.stillScreenMinSeconds * 1000) {
      this.logStill(`still=${Math.round((st.runEnd - st.runStart) / 1000)} end=${reason}`);
    }
    st.runStart = 0;
    st.runEnd = 0;
  }

  private logStill(fields: string) {
    const stamp = Utils.timeLabel(overrideConsole.timezoneOffsetHour).replace(' ', 'T');
    console.log(`SCR ts=${stamp} task=${this.taskNameProvider()} ${fields}`);
  }

  private static readonly MAX_STILL_GAP_MS = 30000;

  public getRotation(): 'vertical' | 'horizontal' {
    const { width, height } = getScreenSize();
    if (width > height) {
      return 'horizontal';
    }
    return 'vertical';
  }

  public getImageRotation(image: Image): 'vertical' | 'horizontal' {
    const { width, height } = getImageSize(image);
    if (width > height) {
      return 'horizontal';
    }
    return 'vertical';
  }

  public keycode(code: string): void {
    keycode(code, this.config.actionDuring);
  }

  public setActionDuring(during: number) {
    this.config.actionDuring = during;
  }
}
