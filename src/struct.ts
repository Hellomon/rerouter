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
  /**
   * Alias for beforeTask (for backward compatibility).
   * Callback function executed before entering the route matching loop.
   */
  beforeRoute?: null | ((task: Task) => void | 'skipRouteLoop');
  /**
   * Alias for afterTask (for backward compatibility).
   * Callback function executed after the task completes.
   */
  afterRoute?: null | ((task: Task) => void);
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
  readonly logScreenshotFolder: string; // readonly property
}

export interface RerouterConfig {
  packageName: string;
  taskDelay: number;
  startAppDelay: number;
  autoLaunchApp: boolean;
  testingScreenshotPath: string;
  instanceId: string; // the ID of the framework instance
  deviceId: string; // the ID of the device the framework runs on
  strictMode: boolean;
  checkFrozenScreen: boolean; // enable/disable screen frozen detection
  savePageReference?: {
    enable: boolean;
    folderPath: string;
    rgba?: { r: number; g: number; b: number; a: number };
  };
  debugSlackUrl: string;
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
  XYRGBThres: number;
  PageThres: number;
  GroupPageThres: number;
  GroupPageMatchOP: '||' | '&&';
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
