import type { ConfigValue, RerouterConfig, ScreenConfig } from './struct';

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
  saveImageRoot: '/sdcard/Pictures/Screenshots/robotmon',
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
  actionDuring: 180,
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
