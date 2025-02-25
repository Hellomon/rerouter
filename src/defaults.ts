import type { ConfigValue, RerouterConfig, ScreenConfig, RouteConfig, Page, ConflictRoutesHandler } from './struct';
import { Utils } from './utils';

export const DEFAULT_REROUTER_CONFIG: RerouterConfig = {
  packageName: '',
  taskDelay: 2000,
  startAppDelay: 6000,
  autoLaunchApp: true,
  testingScreenshotPath: './screenshot',
  instanceId: '',
  deviceId: '',
  strictMode: false,
  debugSlackUrl: '',
  logger: {
    overrideGlobalConsole: false,
    timezoneOffsetHour: 8,
    logLevel: 'ALL',
  },
  conflictRoutesHandler: undefined,
  saveImageRoot: '/data/media/0/Download/', // redroid default download folder
  saveMatchedScreen: false,
};

export const DEFAULT_SCREEN_CONFIG: ScreenConfig = {
  devWidth: 640,
  devHeight: 360,
  deviceWidth: 0,
  deviceHeight: 0,
  screenWidth: 0,
  screenHeight: 0,
  screenOffsetX: 0,
  screenOffsetY: 0,
  actionDuring: 100,
  rotation: 'horizontal',
  logScreenshotLastTime: 0,
  logScreenshotMinIntervalInSec: 10,
  logScreenshotMaxFiles: 100,
  logScreenshotFolder: '',
};

export const DEFAULT_CONFIG_VALUE: ConfigValue = {
  XYRGBThres: 0.9,
  PageThres: 0.9,
  GroupPageThres: 0.9,
  GroupPageMatchOP: '||',
  RouteConfigShouldMatchTimes: 1,
  RouteConfigShouldMatchDuring: 0,
  RouteConfigBeforeActionDelay: 250,
  RouteConfigAfterActionDelay: 250,
  RouteConfigPriority: 1,
  RouteConfigDebug: false,
  TaskConfigMaxTaskRunTimes: 1,
  TaskConfigMaxTaskDuring: 0,
  TaskConfigMinRoundInterval: 0,
  TaskConfigAutoStop: false,
  TaskConfigFindRouteDelay: 2000,
};

export const defaultHandleConflictRoutes: ConflictRoutesHandler = ({ isStrictMode, taskName, finishRound }): Error | undefined => {
  if (isStrictMode) {
    // TODO: save image rather than take another screenshot
    Utils.saveScreenshotToDisk(DEFAULT_REROUTER_CONFIG.saveImageRoot, `${DEFAULT_REROUTER_CONFIG.deviceId}_conflictedRoutes`);
    return new Error(`conflict detected, task: ${taskName}`);
  }
  console.log(`try handle conflict`);
  finishRound(true);
  keycode('BACK', DEFAULT_SCREEN_CONFIG.actionDuring);
};
