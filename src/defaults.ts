import type { ConfigValue, RerouterConfig, ScreenConfig, RouteConfig, Page, ConflictRoutesHandler } from './struct';

// NOTE: we should not use this config, but use rerouter.rerouterConfig instead
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
  saveImageRoot: '/data/media/0/Downloads/', // redroid default download folder
  saveMatchedScreen: false,
};

// NOTE: we should not use this config, but use rerouter.screenConfig instead
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

// NOTE: we should not use this config, but use rerouter.configValue instead
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

// NOTE: we should not use this function, but use rerouter.rerouterConfig.conflictRoutesHandler instead
export const defaultHandleConflictRoutes: ConflictRoutesHandler = ({ isStrictMode, taskName, finishRound }): Error | undefined => {
  if (isStrictMode) {
    return new Error(`conflict detected, task: ${taskName}`);
  }
  console.log(`try handle conflict`);
  finishRound(true);
  keycode('BACK', DEFAULT_SCREEN_CONFIG.actionDuring);
};
