import { Screen } from './screen';

export interface XY {
  x: number;
  y: number;
}
export interface RECT {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface XYRGB {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  thres?: number;
  /** Set to false when the defined RGB should **not** match the actual point. If no value is set, `true` is assumed. */
  match?: boolean;
}

export class Icon {
  public name: string;
  public base64String: string;
  public image: Image;
  public thres: number;
  public next?: XY;
  public back?: XY;

  public constructor(name: string, base64String: string, thres: number | undefined = 0.9, next: XY | undefined = undefined, back: XY | undefined = undefined) {
    this.name = name;
    this.base64String = base64String;
    this.thres = thres;
    this.next = next;
    this.back = back;
  }

  public loadImage() {
    this.image = getImageFromBase64(this.base64String);
  }

  public releaseImage() {
    releaseImage(this.image);
  }
}

export class Page {
  public name: string;
  public points: XYRGB[];
  public next?: XY;
  public back?: XY;
  public thres?: number;

  public constructor(
    name: string,
    devPoints: XYRGB[],
    next: XY | undefined = undefined,
    back: XY | undefined = undefined,
    thres: number | undefined = undefined
  ) {
    this.name = name;
    this.points = devPoints;
    this.next = next;
    this.back = back;
    this.thres = thres;
  }
}

export class GroupPage {
  public name: string;
  public pages: Page[];
  public next?: XY;
  public back?: XY;
  public thres?: number;
  /**
   * How to match pages, '&&' for match all, '||' for match one
   */
  public matchOP: '||' | '&&';

  public constructor(
    name: string,
    pages: Page[],
    next: XY | undefined = undefined,
    back: XY | undefined = undefined,
    thres: number | undefined = undefined,
    matchOP: '||' | '&&' | undefined = undefined
  ) {
    this.name = name;
    this.pages = pages;
    this.next = next;
    this.back = back;
    this.thres = thres;
    this.matchOP = matchOP || '||';
  }
}

export interface RouteContext {
  task: Task;
  screen: Screen;
  path: string;
  lastMatchedPath: string;
  scriptRunning: boolean;
  matchTimes: number;
  matchStartTS: number;
  matchDuring: number;
}

export interface RouteConfig {
  path: string;
  action: 'goNext' | 'goBack' | 'keycodeBack' | ((context: RouteContext, image: Image, matched: Page[], finishRound: (exitTask?: boolean) => void) => void);
  match?: null | Page | GroupPage;
  // TODO: notMatch?: null | Page | GroupPage;
  customMatch?: null | ((taskName: string, image: Image) => boolean);
  /**
   * One Route should be decided to one rotation, Rerouter will check this with screen rotation
   */
  rotation?: 'vertical' | 'horizontal';
  shouldMatchTimes?: number;
  shouldMatchDuring?: number;
  beforeActionDelay?: number;
  afterActionDelay?: number;
  priority?: number;
  debug?: boolean;
  /**
   * Callback function executed before this specific route's action.
   * Called when a route matches and is about to execute its action.
   */
  beforeRoute?: null | ((context: RouteContext, image: Image, matched: Page[]) => void);
  /**
   * Callback function executed after this specific route's action.
   * Called after a route's action has been executed.
   */
  afterRoute?: null | ((context: RouteContext, image: Image, matched: Page[]) => void);
}

export interface TaskConfig {
  /** Task name identifier */
  name: string;
  /** Maximum number of times this task can run before automatically stopping */
  maxTaskRunTimes?: number;
  /** Maximum duration (in milliseconds) this task is allowed to run */
  maxTaskDuring?: number;
  /** Minimum interval (in milliseconds) between task rounds/iterations */
  minRoundInterval?: number;
  /**
   * Determines the behavior when a task's execution time exceeds maxTaskDuring.
   * If this option is set to true, Rerouter will forcefully stop the current task and immediately start the next one once the task's execution time exceeds maxTaskDuring.
   * If this option is set to false or not set, Rerouter will allow the current task to continue running until completion, even if its execution time exceeds maxTaskDuring, before starting the next task.
   */
  forceStop?: boolean;
  /**
   * Under this task, delay(sleep) time between Rerouter to match routes
   * If task is compact, delay time can be shorter
   * If task is loose, delay time can be longer
   */
  findRouteDelay?: number;
  /**
   * Callback function executed before entering the route matching loop.
   * If it returns 'skipRouteLoop', the route matching loop will be skipped entirely.
   */
  beforeTask?: null | ((task: Task) => void | 'skipRouteLoop');
  /** Callback function executed after the task completes */
  afterTask?: null | ((task: Task) => void);
}

export interface Task {
  name: string;
  config: Required<TaskConfig>;
  startTime: number;
  lastRunTime: number;
  runTimes: number; // currentRunTimes
}

export interface ScreenConfig {
  devWidth: number; // developer measure
  devHeight: number; // developer measure
  deviceWidth: number; // runtime detect
  deviceHeight: number; // runtime detect
  screenWidth: number; // developer calculated
  screenHeight: number; // developer calculated
  screenOffsetX: number; // developer calculated
  screenOffsetY: number; // developer calculated
  actionDuring: number; // FPS, should > frame ms
  rotation: 'vertical' | 'horizontal';
  logScreenshotLastTime: number;
  logScreenshotMinIntervalInSec: number;
  logScreenshotMaxFiles: number;
  logScreenshotLastCleanupTime: number;
  logScreenshotCleanupIntervalInSec: number; // the old files are looked for this often, not at every save
  logScreenshotMaxDays: number; // maximum days to keep screenshot files, -1 to disable date-based cleanup and folder organization
  readonly logScreenshotFolder: string; // readonly property
  logScreenshotThumbnail: boolean; // a small JPEG beside every picture of the image log (same name, `.jpg`), kept and deleted with it; the count of the pictures is not changed
  logScreenshotThumbnailSize: number; // the long side of the thumbnail in pixels: 160 (the default) makes 160x90 of a 1280x720 screen, 240 makes 240x135; never larger than the screen
  logScreenshotThumbnailQuality: number; // JPEG quality, 1 to 100
  trackStillScreen: boolean; // compare every screenshot the script takes with the one before it (and let checkScreenFrozen read that); off by default, off keeps the old frozen check
  stillScreenScore: number; // two screenshots with a getIdentityScore above this are the same screen
  stuckScreenshot: boolean; // keep the screen when no route matches for stuckAfterSec (see Screen.pinStuckScreenshot): in its own folder, with its own limits, apart from the image log; off by default
  stuckAfterSec: number; // the unknown screen is kept at this many seconds, and again at 4, 20, 60 and 240 times that (15, 60, 300, 900, 3600 s)
  stuckScreenshotMaxFiles: number; // the newest pictures that the stuck folder keeps (the thumbnails are not counted)
  stuckScreenshotMaxDays: number; // and nothing older than this many days; -1 for no limit by age
  stuckStayAfterSec: number; // a route that matches and stays the route for this many seconds (and 4, 20, 60, 240 times that) is told as a `stay` event, and its screen is kept too when stuckScreenshot is on; 0 for never
  stuckRepeatEntries: number; // a task that goes into the unknown screen from the same route this many times in one round is going round in a circle (A, a page it does not know, BACK, A ...)
  stuckRepeatAfterSec: number; // and then the unknown screen is kept after this many seconds (not stuckAfterSec): the script usually presses BACK sooner than that
  stuckSameScore: number; // a screen with a getIdentityScore of at least this to one that is kept already is the same screen: it is not kept again
}

export interface RerouterConfig {
  packageName: string;
  taskDelay: number;
  startAppDelay: number;
  autoLaunchApp: boolean;
  /** Additional package names considered as "in app" (e.g. browser/WebView during OAuth login flow) */
  inAppExtraPackageNames: string[];
  instanceId: string; // the ID of the framework instance
  deviceId: string; // the ID of the device the framework runs on
  strictMode: boolean;
  checkFrozenScreen: boolean; // enable/disable screen frozen detection
  debugSlackUrl: string;
  eventLog: boolean; // if true, Rerouter itself writes event lines (`@ev {...}`, see logEvent) for the monitor; off by default. logEvent() called by a script always writes
  logger: {
    overrideGlobalConsole: boolean; // if true, this will override global console among all modules
    timezoneOffsetHour: number | undefined;
    logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'ALL';
  };
  conflictRoutesHandler?: ConflictRoutesHandler;

  saveImageRoot: string;
  saveMatchedScreen: boolean;
}

export type ConflictRoutesHandler = (args: {
  isStrictMode: boolean;
  taskName: string;
  screen: Screen;
  image: Image;
  matches: { matchedRoute: Required<RouteConfig> | null; matchedPages: Page[] }[];
  finishRound: (exitTask?: boolean) => void;
}) => void;

export interface ConfigValue {
  PageThres: number;
  GroupPageThres: number;
  RouteConfigShouldMatchTimes: number;
  RouteConfigShouldMatchDuring: number;
  RouteConfigBeforeActionDelay: number;
  RouteConfigAfterActionDelay: number;
  RouteConfigPriority: number;
  RouteConfigDebug: boolean;
  TaskConfigMaxTaskRunTimes: number;
  TaskConfigMaxTaskDuring: number;
  TaskConfigMinRoundInterval: number;
  TaskConfigAutoStop: boolean;
  TaskConfigFindRouteDelay: number;
}

export enum GameStatus {
  WAIT_FOR_LOGIN_INPUT = 'wait-for-input',
  LOGIN_SUCCEEDED = 'login-succeeded',
  LOGIN_FAILED = 'login-failed',
  LAUNCHING = 'launching',
  PLAYING = 'playing',
  NEW_ACCOUNT = 'new-account',
}
export enum EventName {
  RUNNING = 'running',
}
