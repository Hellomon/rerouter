import type { ScreenConfig, XY, XYRGB } from './struct';
import { Utils } from './utils';
import { DEFAULT_REROUTER_CONFIG } from './defaults';
import { overrideConsole } from './overrides';

export class Screen {
  private config: ScreenConfig;
  // what the image log saved since it last said so (see checkAndSaveScreenshots)
  private logSavedCount = 0;
  private logThumbCount = 0;      // thumbnails saved since the last line, and the time that took
  private logThumbMs = 0;
  private logSavedSince = 0;
  private logLastFile = '';
  private logLastAt = 0;
  // the still screen (trackStill): the small copy of the last screenshot, when it was taken, and since when the screen has not changed
  private still = { thumb: null as Image | null, lastAt: 0, frozenSince: 0 };
  // the screens kept by pinStuckScreenshot (the newest first): the file name, and the small copy that a new one is compared with
  private pinned: { name: string; thumb: Image }[] = [];
  private static readonly PINNED_REMEMBERED = 20;
  /** The name of the task that runs now, for the event lines; Rerouter sets it. */
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

    // With a thumbnail the capture is used twice (saved whole, then made small): it is taken here, when the caller did not bring one, and released here.
    const thumbnail = this.config.logScreenshotThumbnail;
    const shot = image === undefined && thumbnail ? getScreenshot() : image;
    try {
      // quiet: not a line of the log for every picture
      this.logLastFile = Utils.saveScreenshotToDisk(folderPath, 'log', true, shot, DEFAULT_REROUTER_CONFIG.saveImageRoot, true);
      this.logLastAt = Date.now();
      if (thumbnail && shot !== undefined) {
        this.saveLogThumbnail(shot, this.logLastFile);
      }
    } finally {
      if (shot !== image) {
        releaseImage(shot);
      }
    }
    if (this.logSavedCount === 0) {
      this.logSavedSince = Date.now();
    }
    this.logSavedCount++;

    if (Date.now() - this.config.logScreenshotLastCleanupTime > this.config.logScreenshotCleanupIntervalInSec * 1000) {
      this.config.logScreenshotLastCleanupTime = Date.now();
      // one line for all of them, when the old files are looked for
      console.log(`Image log: ${this.logSavedCount} saved in ${Math.max(1, Math.round((Date.now() - this.logSavedSince) / 60000))} min, last ${this.logLastFile}` +
        (this.logThumbCount > 0 ? `; thumbnails ${this.logThumbCount}, ${Math.round(this.logThumbMs / this.logThumbCount)} ms each` : ''));
      this.logSavedCount = 0;
      this.logThumbCount = 0;
      this.logThumbMs = 0;
      Utils.removeOldestFilesIfExceedsLimit(
        this.config.logScreenshotFolder,
        this.config.logScreenshotMaxFiles,
        this.config.logScreenshotMaxDays,
        DEFAULT_REROUTER_CONFIG.saveImageRoot
      );
    }
  }

  /**
   * The small copy of a picture of the image log, beside it: the same name with `.jpg`. It is for looking at (Tailmon pulls these first, and the whole picture
   * when somebody asks for it), so it is a JPEG of a few KB. It never costs the picture: an error here is a warning.
   */
  private saveLogThumbnail(shot: Image, pngPath: string) {
    const started = Date.now();
    let thumb: Image | undefined;
    try {
      const { width, height } = getImageSize(shot);
      const scale = Math.min(1, this.config.logScreenshotThumbnailSize / Math.max(width, height));
      thumb = resizeImage(shot, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
      // the quality is the third argument of saveImage (`.jpg` only); the declaration of this package knows two
      (saveImage as (img: Image, path: string, quality?: number) => void)(thumb, pngPath.replace(/\.png$/, '.jpg'), this.config.logScreenshotThumbnailQuality);
      this.logThumbCount++;
      this.logThumbMs += Date.now() - started;
    } catch (error: any) {
      console.warn(`Warning in the thumbnail of the image log: ${error.message}`);
    } finally {
      if (thumb !== undefined) {
        releaseImage(thumb);
      }
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
   * Is the screen changing? Every screenshot the script takes is compared with the one before it (both as a small picture, so it costs little): getFrozenSeconds says how
   * long the screen has been the same, which checkScreenFrozen reads instead of taking a screenshot of its own. Nothing is written to the log.
   */
  private trackStill(image: Image) {
    const c = this.config;
    if (!this.isTrackingStill()) {
      return;
    }
    const st = this.still;
    const thumb = resizeImage(image, 160, 90);
    if (st.thumb !== null) {
      // the frozen time goes on through a gap: the screen is the same as the last time it was looked at, only a change ends it
      if (getIdentityScore(thumb, st.thumb) > c.stillScreenScore) {
        if (st.frozenSince === 0) {
          st.frozenSince = st.lastAt;
        }
      } else {
        st.frozenSince = 0;
      }
      releaseImage(st.thumb);
    }
    st.thumb = thumb;
    st.lastAt = Date.now();
  }

  /** Is every screenshot compared with the one before (trackStillScreen)? */
  public isTrackingStill(): boolean {
    return this.config.trackStillScreen;
  }

  /** How long the screen has not changed, in seconds, as of the last screenshot (0 when it changed, or when nothing is compared). */
  public getFrozenSeconds(): number {
    const st = this.still;
    return st.frozenSince === 0 ? 0 : (st.lastAt - st.frozenSince) / 1000;
  }

  /**
   * The picture of the image log that was saved last, to put in an event line: `name` is the file without the folder and the `.png` (the time of the
   * picture in the clock of the script: `2026-11-02T10.15.30_log`), `ageMs` how long before now it was saved. null when the image log has saved nothing.
   */
  public getLastLogImage(): { name: string; ageMs: number } | null {
    if (this.logLastFile === '') {
      return null;
    }
    const name = this.logLastFile.substring(this.logLastFile.lastIndexOf('/') + 1).replace(/\.png$/, '');
    return { name: name, ageMs: Date.now() - this.logLastAt };
  }

  /**
   * Keep the screen that no route matches (Rerouter calls it when that has lasted a while). The picture is the one the script sees (the development size,
   * the one the pages are made for) and goes to `<logScreenshotFolder>/stuck/`, with a thumbnail, in its own limits (stuckScreenshotMaxFiles, stuckScreenshotMaxDays),
   * so that the image log going round does not take it away. A screen that is the same as one that was kept (stuckSameScore) is not kept again: the name of that one
   * comes back with `same: true`. null when this is off, there is no folder, or saving failed (a warning: the script goes on).
   */
  public pinStuckScreenshot(image: Image): { name: string; same: boolean } | null {
    const c = this.config;
    if (!c.stuckScreenshot || c.logScreenshotFolder === '') {
      return null;
    }
    let thumb: Image | undefined;
    try {
      thumb = resizeImage(image, 160, 90);
      for (let i = 0; i < this.pinned.length; i++) {
        if (getIdentityScore(thumb, this.pinned[i].thumb) >= c.stuckSameScore) {
          const found = this.pinned.splice(i, 1)[0];
          this.pinned.unshift(found);
          return { name: found.name, same: true };
        }
      }
      const folder = `${c.logScreenshotFolder}/stuck`;
      const path = Utils.saveScreenshotToDisk(folder, 'stuck', true, image, DEFAULT_REROUTER_CONFIG.saveImageRoot, true);
      if (c.logScreenshotThumbnail) {
        this.saveLogThumbnail(image, path);
      }
      const name = path.substring(path.lastIndexOf('/') + 1).replace(/\.png$/, '');
      this.pinned.unshift({ name: name, thumb: thumb });
      thumb = undefined; // kept
      while (this.pinned.length > Screen.PINNED_REMEMBERED) {
        releaseImage((this.pinned.pop() as { name: string; thumb: Image }).thumb);
      }
      Utils.cleanupFlatFolder(folder, c.stuckScreenshotMaxFiles, c.stuckScreenshotMaxDays, '_stuck', DEFAULT_REROUTER_CONFIG.saveImageRoot);
      return { name: name, same: false };
    } catch (error: any) {
      console.warn(`Warning in pinStuckScreenshot: ${error.message}`);
      return null;
    } finally {
      if (thumb !== undefined) {
        releaseImage(thumb);
      }
    }
  }

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
