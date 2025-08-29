import { RerouterConfig, RouteConfig, ScreenConfig, TaskConfig, Task, RouteContext, Page, GroupPage, ConfigValue, GameStatus, EventName } from './struct';
import { Screen } from './screen';
import { Utils } from './utils';
import { updateGameStatus as xrUpdateGameStatus, sendActivityLog as xrSendActivityLog, sendLog as xrSendLog } from './xr';

import { overrideConsole } from './overrides';
import { DEFAULT_REROUTER_CONFIG, DEFAULT_SCREEN_CONFIG, DEFAULT_CONFIG_VALUE, defaultHandleConflictRoutes } from './defaults';

import 'core-js/es/object/assign';
import 'core-js/es/array/find-index';

// FIXME: clean up log related logic
// singleton class
export class Rerouter {
  public debug: boolean = true;
  public defaultConfig: ConfigValue = DEFAULT_CONFIG_VALUE;
  public rerouterConfig: RerouterConfig = DEFAULT_REROUTER_CONFIG;
  public screenConfig: ScreenConfig = DEFAULT_SCREEN_CONFIG;
  public screen: Screen = new Screen(this.screenConfig);

  private running: boolean = false;
  private routeConflictRecord: number[] = [];
  private routes: Required<RouteConfig>[] = [];
  private tasks: Required<Task>[] = [];
  private routeContext: RouteContext | null = null;
  private unknownRouteAction: ((context: RouteContext, image: Image, finishRound: (exitTask?: boolean) => void) => void) | null = null;
  private startAppRouteAction: ((context: RouteContext, finishRound: (exitTask?: boolean) => void) => void) | null = null;

  private localGameStatus: GameStatus | null = null;
  private cloudGameStatus: GameStatus | null = null;

  // for screen frozen detection
  private lastScreenshotImage: any | null = null;
  private lastCheckScreenFrozenTime: number = 0;
  private screenFrozenTimes: number = 0;

  private static instance: Rerouter | undefined;

  private constructor() {}

  public static getInstance(): Rerouter {
    if (Rerouter.instance === undefined) {
      Rerouter.instance = new Rerouter();
    }
    return Rerouter.instance;
  }

  public reset(): void {
    // NOTE: this is an another way that resets Rerouter, just leaving here for memory
    // rerouterContainer.instance = new Rerouter();
    // @ts-ignore included 'core-js/es/object/assign'
    Object.assign(this, new Rerouter());
  }

  /**
   * Recalculate some value like device width or height in screenConfig
   */
  private init(): void {
    // sort routes by priority
    this.routes.sort((a, b) => b.priority - a.priority);
    // check and calculate screen config
    const deviceWH = getScreenSize();
    const max = Math.max(deviceWH.width, deviceWH.height);
    const min = Math.min(deviceWH.width, deviceWH.height);
    const dWidth = this.screenConfig.rotation === 'horizontal' ? max : min;
    const dHeight = this.screenConfig.rotation === 'vertical' ? max : min;
    this.screenConfig.deviceWidth = this.screenConfig.deviceWidth || dWidth;
    this.screenConfig.deviceHeight = this.screenConfig.deviceHeight || dHeight;
    this.screenConfig.screenWidth = this.screenConfig.screenWidth || dWidth;
    this.screenConfig.screenHeight = this.screenConfig.screenHeight || dHeight;
    this.log(`screenWidth: ${this.screenConfig.screenWidth}, screenHeight: ${this.screenConfig.screenHeight}`);
    (this.screenConfig as any).logScreenshotFolder = this.rerouterConfig.deviceId; // Type assertion to bypass readonly restriction
    if (this.rerouterConfig.savePageReference?.enable) {
      const folderPath = this.rerouterConfig.savePageReference.folderPath || Utils.joinPaths(this.rerouterConfig.saveImageRoot, 'pageReference');
      this.rerouterConfig.savePageReference.folderPath = folderPath;
      execute(`mkdir -p ${folderPath}`);
    }

    overrideConsole.setLogLevel(this.rerouterConfig.logger.logLevel);
    overrideConsole.setTimezoneOffsetHour(this.rerouterConfig.logger.timezoneOffsetHour);
    overrideConsole.doOverrideGlobalConsole(this.rerouterConfig.logger.overrideGlobalConsole);

    // new screen if screen config changed
    this.screen = new Screen(this.screenConfig);
  }

  /**
   * Add RouteConfig to Rerouter routes, after starting Rerouter will run over all RouteConfigs to match screen and do action
   * @param config information about how route match and route action
   */
  public addRoute(config: RouteConfig): void {
    // @ts-ignore included 'core-js/es/array/find-index'
    const existingRouteIndex = this.routes.findIndex(route => route.path === config.path);

    // If it exists, log a warning and decide what to do next
    if (existingRouteIndex !== -1) {
      this.warning(`A route with the path '${config.path}' already exists. Duplicate route will not be added.`);

      // Option 1: Update the existing route with the new configuration
      // this.routes[existingRouteIndex] = this.wrapRouteConfigWithDefault(config);

      // Option 2: Simply return and don't add the new route
      return;
    }

    // If it doesn't exist, push the new route
    this.routes.push(this.wrapRouteConfigWithDefault(config));
  }

  /**
   * Gets a copy of all route configurations to prevent external modifications.
   * @returns an array of RouteConfig
   */
  public getRoutes(): RouteConfig[] {
    return this.routes.slice(); // Return a copy of the routes array to prevent modifications
  }

  /**
   * Tell Rerouter what to do if not matching any route
   * @param action function to do if not matching
   */
  public addUnknownAction(action: ((context: RouteContext, image: Image, finishRound: (exitTask?: boolean) => void) => void) | null): void {
    this.unknownRouteAction = action;
  }

  public addStartAppAction(action: ((context: RouteContext, finishRound: (exitTask?: boolean) => void) => void) | null): void {
    this.startAppRouteAction = action;
  }

  /**
   * Add TaskConfig to Rerouter tasks, after starting Rerouter will run over all Tasks by task condition
   * @param config information about how task works
   */
  public addTask(config: TaskConfig): void {
    // Check if a task with the same name already exists
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].name === config.name) {
        this.warning(`A task with the name '${config.name}' already exists. Duplicate task will not be added.`);
        return;
      }
    }

    this.tasks.push({
      name: config.name,
      config: this.wrapTaskConfigWithDefault(config),
      startTime: 0,
      lastRunTime: 0,
      runTimes: 0,
    });
  }

  /**
   * start Rerouter to run over tasks and routes
   * @param packageName
   */
  public start(packageName: string): void {
    this.rerouterConfig.packageName = packageName;
    // check tasks
    if (this.tasks.length === 0) {
      this.log(`Rerouter start failed, no tasks ...`);
      return;
    }

    this.init();
    this.log(`Rerouter started ...`);
    // task controller
    this.running = true;
    this.startTaskLoop();
    this.log(`Rerouter stopped ...`);
  }

  /**
   * stop Rerouter
   */
  public stop(): void {
    this.log(`Rerouter stop called, trying to stop task loop`);
    this.running = false;
    if (this.routeContext !== null) {
      this.routeContext.scriptRunning = false;
    }
    overrideConsole.doOverrideGlobalConsole(false);
  }

  public checkInApp(): boolean {
    const [packageName] = Utils.getCurrentApp();
    if (packageName === this.rerouterConfig.packageName) {
      return true;
    }
    return Utils.isAppOnTop(this.rerouterConfig.packageName);
  }

  public checkAndStartApp(): boolean {
    if (!this.checkInApp()) {
      this.log(`AppIsNotStarted, startApp ${this.rerouterConfig.packageName}`);
      this.startApp();
      return true;
    }
    return false;
  }
  public startApp(maxRetries: number = 3, retryDelay: number = 3000): void {
    this.log('startApp: start');

    if (!this.rerouterConfig.packageName) {
      this.log(`Rerouter start app failed, no packageName ...`);
      return;
    }

    let isInApp = this.checkInApp();
    let attempts = 0;
    const infiniteRetry = maxRetries === -1;

    while (!isInApp && (infiniteRetry || attempts < maxRetries)) {
      Utils.startApp(this.rerouterConfig.packageName);
      Utils.sleep(this.rerouterConfig.startAppDelay || retryDelay);
      isInApp = this.checkInApp();
      attempts++;

      if (infiniteRetry && attempts > 0 && attempts % 5 === 0) {
        this.log(`startApp: still trying after ${attempts} attempts...`);
      }
    }

    this.log('startApp: done');
  }
  public stopApp(maxRetries: number = 3, retryDelay: number = 3000): void {
    this.log('stopApp: start');

    if (!this.rerouterConfig.packageName) {
      this.log(`Rerouter stop app failed, no packageName ...`);
      return;
    }

    let isInApp = this.checkInApp();
    let attempts = 0;
    const infiniteRetry = maxRetries === -1;

    while (isInApp && (infiniteRetry || attempts < maxRetries)) {
      Utils.stopApp(this.rerouterConfig.packageName);
      Utils.sleep(retryDelay);
      isInApp = this.checkInApp();
      attempts++;

      if (infiniteRetry && attempts > 0 && attempts % 5 === 0) {
        this.log(`stopApp: still trying after ${attempts} attempts...`);
      }
    }

    this.log('stopApp: done');
  }

  public stopEmulator(): void {
    execute('reboot -p');
  }

  public restartApp(): void {
    this.stopApp();
    this.startApp();
  }

  public goNext(page: Page | GroupPage): void {
    if (page.next !== undefined) {
      this.screen.tap(page.next);
    } else {
      this.warning(`${page.name} action == goNext, but no next xy`);
    }
  }

  public goBack(page: Page | GroupPage): void {
    if (page.back !== undefined) {
      this.screen.tap(page.back);
    } else {
      this.warning(`${page.name} action == goBack, but no back xy`);
    }
  }

  public isPageMatch(page: Page | GroupPage | string): boolean {
    const image = this.screen.getCvtDevScreenshot();
    const isMatch = this.isPageMatchImage(page, image);
    releaseImage(image);
    return isMatch;
  }

  public isPageMatchImage(page: Page | GroupPage | string, image: Image): boolean {
    if (typeof page === 'string') {
      const p = this.getPageByName(page);
      if (p === null) {
        this.warning(`isPageMatchImage ${page} not exist`);
        return false;
      }
      page = p;
    }
    if (page instanceof Page) {
      return this.isMatchPageImpl(image, page, this.defaultConfig.PageThres, this.debug);
    } else {
      const pages = this.isMatchGroupPageImpl(image, page, this.defaultConfig.GroupPageThres, this.debug);
      return pages.length > 0;
    }
  }

  public getPagesMatch(groupPage: GroupPage): Page[] {
    const image = this.screen.getCvtDevScreenshot();
    const match = this.getPagesMatchImage(groupPage, image, this.defaultConfig.GroupPageThres);
    releaseImage(image);
    return match;
  }

  public getPagesMatchImage(groupPage: GroupPage, image: Image, parentThres?: number, debug?: boolean): Page[] {
    let pages: Page[] = [];
    const thres = groupPage.thres ?? parentThres ?? this.defaultConfig.PageThres;

    for (let i = 0; i < groupPage.pages.length; i++) {
      const page = groupPage.pages[i];
      const isPageMatch = this.isMatchPageImpl(image, page, thres, this.debug);

      if (isPageMatch) {
        pages.push(page);
      }
    }
    return pages;
  }

  public waitScreenForMatchingPage(page: Page | GroupPage, timeout: number, matchTimes: number = 1, interval = 600): boolean {
    return Utils.waitForAction(() => this.isPageMatch(page), timeout, matchTimes, interval);
  }

  public isRouteMatch(route: RouteConfig | string): boolean {
    const image = this.screen.getCvtDevScreenshot();
    const isMatch = this.isRouteMatchImage(route, image);
    releaseImage(image);
    return isMatch;
  }

  public isRouteMatchImage(route: RouteConfig | string, image: Image): boolean {
    const routeConfig = this.getRouteConfig(route);
    if (routeConfig === null) {
      this.warning(`isRouteMatchImage ${route} not exist`);
      return false;
    }
    const filledRouteConfig = this.wrapRouteConfigWithDefault(routeConfig);
    const rotation = this.screen.getImageRotation(image);
    const { isMatched } = this.isMatchRouteImpl(image, rotation, filledRouteConfig, 'waitScreenForMatchingRoute');
    if (isMatched) {
      return true;
    }
    return false;
  }

  public waitScreenForMatchingRoute(route: RouteConfig | string, timeout: number, matchTimes: number = 1, interval = 600): boolean {
    return Utils.waitForAction(() => this.isRouteMatch(route), timeout, matchTimes, interval);
  }

  public getPageByName(name: string): Page | GroupPage | null {
    for (const route of this.routes) {
      if (name === route.match?.name) {
        return route.match;
      }
    }
    return null;
  }

  public getRouteConfigByPath(path: string): RouteConfig | null {
    for (const route of this.routes) {
      if (path === route.path) {
        return route;
      }
    }
    return null;
  }

  public getCurrentMatchNames(): string[] {
    const image = this.screen.getCvtDevScreenshot();
    const matchedNames: string[] = [];
    this.routes.forEach(route => {
      const match = route.match;
      if (
        (match instanceof Page && this.isMatchPageImpl(image, match, this.defaultConfig.PageThres, this.debug)) ||
        (match instanceof GroupPage && this.isMatchGroupPageImpl(image, match, this.defaultConfig.PageThres, this.debug).length > 0)
      ) {
        matchedNames.push(match.name);
      }
    });
    this.log(`current match: `, matchedNames);
    releaseImage(image);
    return matchedNames;
  }
  private getRouteConfig(r: RouteConfig | string): RouteConfig | null {
    let route: RouteConfig | null;
    if (typeof r === 'string') {
      route = this.getRouteConfigByPath(r);
    } else {
      route = r;
    }
    return route;
  }

  private wrapRouteConfigWithDefault(config: RouteConfig): Required<RouteConfig> {
    return {
      path: config.path,
      action: config.action,
      match: config.match ?? null,
      customMatch: config.customMatch ?? null,
      rotation: config.rotation ?? this.screenConfig.rotation,
      shouldMatchTimes: config.shouldMatchTimes ?? this.defaultConfig.RouteConfigShouldMatchTimes,
      shouldMatchDuring: config.shouldMatchDuring ?? this.defaultConfig.RouteConfigShouldMatchDuring,
      beforeActionDelay: config.beforeActionDelay ?? this.defaultConfig.RouteConfigBeforeActionDelay,
      afterActionDelay: config.afterActionDelay ?? this.defaultConfig.RouteConfigAfterActionDelay,
      priority: config.priority ?? this.defaultConfig.RouteConfigPriority,
      debug: config.debug ?? this.defaultConfig.RouteConfigDebug,
      beforeRoute: config.beforeRoute ?? null,
      afterRoute: config.afterRoute ?? null,
    };
  }

  private wrapTaskConfigWithDefault(config: TaskConfig): Required<TaskConfig> {
    const beforeTask = config.beforeTask ?? config.beforeRoute ?? null;
    const afterTask = config.afterTask ?? config.afterRoute ?? null;
    return {
      name: config.name,
      maxTaskRunTimes: config.maxTaskRunTimes ?? this.defaultConfig.TaskConfigMaxTaskRunTimes,
      maxTaskDuring: config.maxTaskDuring ?? this.defaultConfig.TaskConfigMaxTaskDuring,
      minRoundInterval: config.minRoundInterval ?? this.defaultConfig.TaskConfigMinRoundInterval,
      forceStop: config.forceStop ?? this.defaultConfig.TaskConfigAutoStop,
      findRouteDelay: config.findRouteDelay ?? this.defaultConfig.TaskConfigFindRouteDelay,
      beforeTask,
      afterTask,
      beforeRoute: beforeTask,
      afterRoute: afterTask,
    };
  }

  private startTaskLoop(): void {
    let taskIdx = 0;
    while (this.running) {
      const task = this.tasks[taskIdx % this.tasks.length];
      taskIdx++;
      const now = Date.now();
      const isTaskRunFirstTime = task.lastRunTime === 0;
      if (now - task.lastRunTime <= task.config.minRoundInterval && !isTaskRunFirstTime) {
        this.log(`Task: ${task.name} during: ${now - task.lastRunTime} <= minRoundInterval, skip`);
        Utils.sleep(this.rerouterConfig.taskDelay);
        continue;
      }

      task.startTime = now;
      task.runTimes = 0;
      let exitTask = false;
      for (let i = 0; i < task.config.maxTaskRunTimes && this.running && !exitTask; i++) {
        this.log(`Task: ${task.name} run ${task.runTimes}`);
        let skipRoute = false;
        if (task.config.beforeRoute !== null) {
          this.log(`Task: ${task.name} run ${task.runTimes} do beforeRoute()`);
          if (task.config.beforeRoute(task) === 'skipRouteLoop') {
            skipRoute = true;
          }
        }

        if (skipRoute) {
          this.log(`Task: ${task.name} run ${task.runTimes} skipRouteLoop`);
        } else {
          exitTask = this.startRouteLoop(task);
        }

        if (task.config.afterRoute !== null) {
          this.log(`Task: ${task.name} run ${task.runTimes} do afterRoute()`);
          task.config.afterRoute(task);
        }

        task.runTimes++;
        task.lastRunTime = now;
        const during = now - task.startTime;
        if (task.config.maxTaskDuring > 0 && during >= task.config.maxTaskDuring) {
          this.log(`Task: ${task.name} taskDuring: ${during}/${task.config.maxTaskDuring} reached, stop`);
          break;
        }
      }
      Utils.sleep(this.rerouterConfig.taskDelay);
    }
  }

  private startRouteLoop(task: Task): boolean {
    this.routeContext = {
      task: task,
      screen: this.screen,
      scriptRunning: this.running,
      path: '',
      lastMatchedPath: this.routeContext?.lastMatchedPath ?? '',
      matchTimes: 0,
      matchStartTS: 0,
      matchDuring: 0,
    };

    let routeLoop = true;
    let exitTaskResult = false;
    const finishRoundFunc = (exitTask: boolean = false) => {
      routeLoop = false;
      exitTaskResult = exitTask;
      this.log(`finish round: ${this.routeContext?.task.name}; exitTask: ${exitTask}`);
    };
    // pointer for short code
    const context = this.routeContext;
    while (routeLoop && this.running) {
      if (this.rerouterConfig.checkFrozenScreen) {
        this.checkScreenFrozen();
      }

      const now = Date.now();

      // check task.autoStop
      const taskRunDuring = now - task.startTime;
      if (task.config.forceStop && taskRunDuring > task.config.maxTaskDuring && task.config.maxTaskDuring > 0) {
        this.log(`Task ${task.name} AutoStop, exceed taskRunDuring`);
        break;
      }

      // check isAppOn or auto launch it
      if (this.rerouterConfig.autoLaunchApp) {
        if (this.checkAndStartApp()) {
          if (this.startAppRouteAction !== null) {
            this.startAppRouteAction(context, finishRoundFunc);
          }
          continue;
        }
      }

      const rotation = this.screen.getRotation();
      const image = this.screen.getCvtDevScreenshot();

      const matches = this.findMatchedRouteImpl(task.name, image, rotation);
      const matchedRoute: Required<RouteConfig> = matches[0]?.matchedRoute;
      const matchedPages: Page[] = matches[0]?.matchedPages;

      // context.matchStartTS = 0 if init run
      context.matchStartTS = context.matchStartTS || now;
      context.path = matchedRoute?.path ?? '';

      // first match
      if (context.path !== context.lastMatchedPath) {
        context.matchTimes = 0;
        context.matchStartTS = now;
      }
      context.matchDuring = now - context.matchStartTS;
      context.matchTimes++;

      if (matches.length === 0) {
        // no match
        if (this.unknownRouteAction !== null) {
          this.unknownRouteAction(context, image, finishRoundFunc);
        }
      } else if (matches.length === 1) {
        // single match with highest priority
        if (this.rerouterConfig.saveMatchedScreen) {
          Utils.saveScreenshotToDisk('matched', `${matches[0].matchedRoute.path}`, false, image, this.rerouterConfig.saveImageRoot);
        }
        this.doActionForRoute(context, image, matchedRoute, matchedPages, finishRoundFunc);
      } else {
        // conflict: multiple matches with same highest priority
        const error = this.handleConflictRoutes(task.name, image, matches, finishRoundFunc);
        if (error) {
          releaseImage(image);
          throw error;
        }
      }

      // update lastMatchedPath after action done
      // otherwise the lastMatchedPath will be current path when doing action
      context.lastMatchedPath = context.path;

      releaseImage(image);
      Utils.sleep(task.config.findRouteDelay);
    }

    return exitTaskResult;
  }

  private doActionForRoute(context: RouteContext, image: Image, route: Required<RouteConfig>, matchedPages: Page[], finishRound: (exitTask?: boolean) => void) {
    // TODO fix me, currently force print route.path
    const pageNames = matchedPages.map(page => page.name).join(', ');
    console.log(`handleMatchedRoute: ${route.path}, pages: [${pageNames}], times: ${context.matchTimes}, during: ${context.matchDuring}`);
    // this.logImpl(route.debug, `handleMatchedRoute: ${route.path}, times: ${context.matchTimes}, during: ${context.matchDuring}`);
    if (context.matchTimes < route.shouldMatchTimes || context.matchDuring < route.shouldMatchDuring) {
      // should still wait for matching condition
      return;
    }

    // Execute beforeRoute callback if defined
    if (route.beforeRoute !== null) {
      this.logImpl(route.debug, `Route: ${route.path} executing beforeRoute callback`);
      try {
        route.beforeRoute(context, image, matchedPages);
      } catch (error) {
        this.warning(`Route: ${route.path} beforeRoute callback error:`, error);
      }
    }

    const nextXY = matchedPages[0]?.next;
    const backXY = matchedPages[0]?.back;
    // matched and fit condition, do action
    Utils.sleep(route.beforeActionDelay);

    try {
      if (route.action === 'goNext') {
        if (nextXY !== undefined) {
          this.screen.tap(nextXY);
        } else {
          this.warning(`${route.path} action == goNext, but no next xy`);
        }
      } else if (route.action === 'goBack') {
        if (backXY !== undefined) {
          this.screen.tap(backXY);
        } else {
          this.warning(`${route.path} action == goBack, but no back xy`);
        }
      } else if (route.action === 'keycodeBack') {
        keycode('BACK', this.screenConfig.actionDuring);
      } else {
        route.action(context, image, matchedPages, finishRound);
      }
    } catch (error) {
      this.warning(`Route: ${route.path} action execution error:`, error);
    }

    this.savePageReferenceImage(image, matchedPages);
    Utils.sleep(route.afterActionDelay);

    // Execute afterRoute callback if defined
    if (route.afterRoute !== null) {
      this.logImpl(route.debug, `Route: ${route.path} executing afterRoute callback`);
      try {
        route.afterRoute(context, image, matchedPages);
      } catch (error) {
        this.warning(`Route: ${route.path} afterRoute callback error:`, error);
      }
    }
  }

  private findMatchedRouteImpl(
    taskName: string,
    image: Image,
    rotation: 'vertical' | 'horizontal'
  ): {
    matchedRoute: Required<RouteConfig>;
    matchedPages: Page[];
  }[] {
    const matches: {
      matchedRoute: Required<RouteConfig>;
      matchedPages: Page[];
    }[] = [];
    let currentHighestPriority: number | null = null;

    // routes are already sorted by priority (high to low) in init()
    for (const route of this.routes) {
      // If we already found matches with higher priority, skip lower priority routes
      if (currentHighestPriority !== null && route.priority < currentHighestPriority) {
        break;
      }

      const { isMatched, matchedPages } = this.isMatchRouteImpl(image, rotation, route, taskName);
      if (isMatched) {
        this.logImpl(
          route.debug,
          'current match:',
          matchedPages.map(p => p.name)
        );

        // First match found - set as current highest priority
        if (currentHighestPriority === null) {
          currentHighestPriority = route.priority;
        }

        // Add match (either first match or same priority as existing matches)
        // Note: route.priority < currentHighestPriority is impossible here due to early break above
        matches.push({ matchedRoute: route, matchedPages });
      }
    }
    return matches;
  }

  private handleConflictRoutes(
    taskName: string,
    image: Image,
    matches: { matchedRoute: Required<RouteConfig> | null; matchedPages: Page[] }[],
    finishRound: (exitTask?: boolean) => void
  ): Error | undefined {
    // BACKLOG: all below parts cannot be handled by user defined handler
    const matchDetails = matches
      .map(item => {
        const path = item.matchedRoute?.path || 'emptyRoutePath';
        const pages = item.matchedPages.map(p => p.name);
        return `${path}: (${pages.join(', ')})`;
      })
      .join('\n');

    const warningMsg = `a route conflict when in Task: "${taskName}", details: \n${matchDetails}`;
    this.warning(warningMsg);

    if (this.rerouterConfig.debugSlackUrl !== '') {
      Utils.sendSlackMessage(this.rerouterConfig.debugSlackUrl, 'Conflict Routes Report', `${DEFAULT_REROUTER_CONFIG.deviceId} just logged ${warningMsg}`);
    }

    const now = Date.now();
    this.routeConflictRecord.push(now);
    const duringLimit = 60 * 1_000;
    const countsLimit = 5;
    while (this.routeConflictRecord.length > 0 && now - this.routeConflictRecord[0] > duringLimit) {
      this.routeConflictRecord.shift();
    }
    if (this.routeConflictRecord.length >= countsLimit) {
      this.routeConflictRecord = [now];
      this.restartApp();
      return;
    }

    if (this.rerouterConfig.strictMode) {
      Utils.saveScreenshotToDisk('', `${this.rerouterConfig.deviceId}_conflictedRoutes`, true, image, this.rerouterConfig.saveImageRoot);
    }

    const handler = this.rerouterConfig.conflictRoutesHandler || defaultHandleConflictRoutes;
    handler({
      isStrictMode: this.rerouterConfig.strictMode,
      taskName,
      image,
      matches,
      finishRound,
      screen: this.screen,
    });
  }

  private isMatchRouteImpl(
    image: Image,
    rotation: 'vertical' | 'horizontal',
    route: Required<RouteConfig>,
    taskName: string
  ): {
    isMatched: boolean;
    matchedPages: Page[];
  } {
    // check rotation
    if (route.rotation !== rotation) {
      this.logImpl(route.debug, `findMatchedRoute ${route.path} not match rotation, skip`);
      return { isMatched: false, matchedPages: [] };
    }
    let isMatched = false;
    const matchedPages: Page[] = [];
    // check route.match
    if (route.match !== null) {
      if (route.match instanceof Page) {
        const match = this.isMatchPageImpl(image, route.match, this.defaultConfig.PageThres, route.debug);
        if (match) {
          isMatched = true;
          matchedPages.push(route.match);
        }
      } else if (route.match instanceof GroupPage) {
        const match = this.isMatchGroupPageImpl(image, route.match, this.defaultConfig.GroupPageThres, route.debug);
        if (match.length !== 0) {
          isMatched = true;
          matchedPages.push(...match);
        }
      }
    }
    // check route.isMatch function
    if (!isMatched && route.customMatch !== null) {
      isMatched = route.customMatch(taskName, image);
      this.logImpl(route.debug, `findMatchedRoute ${route.path} isMatch() => ${isMatched}`);
    }
    this.logImpl(route.debug, `findMatchedRoute ${route.path} match: ${isMatched}, firstPage: ${matchedPages[0]?.name}`);

    return {
      isMatched,
      matchedPages,
    };
  }

  private isMatchPageImpl(image: Image, page: Page, parentThres: number, debug: boolean): boolean {
    const pageThres = page.thres;
    let isSame = true;
    this.logImpl(debug, `checkMatchPage[${page.name}]`);

    for (let i = 0; isSame && i < page.points.length; i++) {
      const point = page.points[i];
      const thres = point.thres ?? pageThres ?? parentThres;
      const shouldMatch = point.match ?? true;
      const color = getImageColor(image, point.x, point.y);
      const score = Utils.identityColor(point, color);
      const isPointColorMatch = score >= thres === shouldMatch;
      if (!isPointColorMatch) {
        isSame = false;
        this.logImpl(
          debug,
          `point[${i}] match false: score: ${score}, thres: ${thres}\n`,
          `expect: ${Utils.formatXYRGB(point)}\n`,
          `   get: ${Utils.formatXYRGB({ ...color, x: point.x, y: point.y })}`
        );
      }
    }

    this.logImpl(debug, `checkMatchPage[${page.name}][match: ${isSame}]`);
    return isSame;
  }

  private isMatchGroupPageImpl(image: Image, groupPage: GroupPage, parentThres: number, debug: boolean): Page[] {
    const thres = groupPage.thres ?? parentThres;
    const matchedPages: Page[] = [];

    // First, collect all actually matched pages
    for (let i = 0; i < groupPage.pages.length; i++) {
      const page = groupPage.pages[i];
      const isPageMatch = this.isMatchPageImpl(image, page, thres, debug);
      this.logImpl(debug, `checkMatchGroupPage: ${groupPage.name}, page[${i}]: ${page.name} match: ${isPageMatch}`);

      if (isPageMatch) {
        matchedPages.push(page);
      }
    }

    // Then decide what to return based on matchOP
    if (groupPage.matchOP === '||') {
      // OR: return all matched pages if any match
      return matchedPages.length > 0 ? matchedPages : [];
    } else if (groupPage.matchOP === '&&') {
      // AND: return all matched pages only if ALL pages match
      return matchedPages.length === groupPage.pages.length ? matchedPages : [];
    }

    return matchedPages;
  }

  private savePageReferenceImage(image: Image, matchedPages: Page[]): void {
    const { enable, folderPath, rgba } = this.rerouterConfig.savePageReference || {};
    if (!enable || !folderPath || matchedPages.length === 0) {
      return;
    }
    matchedPages.forEach(page => {
      Utils.savePointsMarkedImage({
        image,
        name: page.name,
        points: page.points,
        folderPath,
        rgba,
      });
    });
  }

  private log(...args: any[]): void {
    this.logImpl(this.debug, ...args);
  }
  private logImpl(debug: boolean, ...args: any[]): void {
    if (!debug || !this.debug) {
      return;
    }
    // only log when debug + this.debug is true
    console.log('[Rerouter][debug]', ...args);
  }

  private warning(...args: any[]): void {
    console.log('[Rerouter][warning]', ...args);
  }

  public updateGameStatus(status: GameStatus): boolean {
    this.localGameStatus = status; // Update local status first

    if (status === GameStatus.NEW_ACCOUNT) {
      sendEvent(EventName.RUNNING, '');
    }

    // If instanceId or deviceId is empty, skip updating cloud status
    if (!this.rerouterConfig.instanceId || !this.rerouterConfig.deviceId) {
      console.warn('Instance ID or Device ID is empty. Skipping cloud status update.');
      return true; // Local update is considered successful
    }

    if (this.cloudGameStatus === status) {
      return false; // No update is needed if the cloud status hasn't changed
    }

    if (this.rerouterConfig.deviceId === '' || this.rerouterConfig.instanceId === '') {
      console.log(`deviceId or instanceId is empty, cannot update game status`);
      return false;
    }

    const maxRetries = 3;
    let attempts = 0;

    while (true) {
      const result = xrUpdateGameStatus(this.rerouterConfig.deviceId, this.rerouterConfig.instanceId, status);

      if (result === true) {
        this.cloudGameStatus = status; // Update cloud status on success
        return true; // Operation successful, return true
      }

      attempts++;

      if (attempts >= maxRetries) {
        break; // Exit the loop after maxRetries attempts
      }

      Utils.sleep(3000); // Sleep between attempts
    }

    return false; // Return false after all attempts failed
  }

  public getGameStatus(): GameStatus | null {
    return this.localGameStatus;
  }

  public sendActivityLog(category: string, base64Image: string, msg: string): boolean {
    // If instanceId is empty, skip sending activity log
    if (!this.rerouterConfig.instanceId) {
      console.warn('Instance ID is empty. Skipping activity log sending.');
      return false;
    }

    try {
      xrSendActivityLog(this.rerouterConfig.instanceId, category, base64Image, msg);
      return true;
    } catch (error) {
      console.error('Failed to send activity log:', error);
      return false;
    }
  }

  public sendLog(channel: string, level: string, title: string, message: string): boolean {
    try {
      const userInfo = `deviceId: ${this.rerouterConfig.deviceId}\nlicenseId: ${this.rerouterConfig.instanceId || 'DEBUG'}\n`;
      message = userInfo + message;
      xrSendLog(channel, level, title, message);
      return true;
    } catch (error) {
      console.error('Failed to send log:', error);
      return false;
    }
  }

  public checkScreenFrozen(): void {
    const now = Date.now();
    if (now - this.lastCheckScreenFrozenTime < 60 * 1000) {
      return;
    }
    this.lastCheckScreenFrozenTime = now;

    if (this.lastScreenshotImage === null) {
      this.lastScreenshotImage = this.screen.getCvtDevScreenshot();
      return;
    }

    const currentImage = this.screen.getCvtDevScreenshot();
    const score = getIdentityScore(currentImage, this.lastScreenshotImage);
    console.log(`checkScreenFrozen: score: ${score}`);
    if (score > 0.999) {
      this.screenFrozenTimes++;
      console.log(`Screen is frozen, times ${this.screenFrozenTimes}`);
    } else {
      this.screenFrozenTimes = 0;
    }
    releaseImage(this.lastScreenshotImage);
    this.lastScreenshotImage = currentImage;

    if (this.screenFrozenTimes >= 10) {
      console.log(`Screen is frozen for more than 10 times (minutes), restarting app... ${this.screenFrozenTimes}`);
      releaseImage(this.lastScreenshotImage);
      this.sendLog('Rerouter', 'warning', 'ScreenFrozen', 'Screen is frozen for more than 10 times (minutes), restarting emulator...');
      this.stopEmulator();
    }
  }
}

// NOTE: this is an another way that resets Rerouter, just leaving here for memory
// const rerouterContainer = {
//   instance: new Rerouter(),
// };
// import 'proxy-polyfill';
// export const rerouter: Rerouter = new Proxy(rerouterContainer, {
//   get: (target, prop: keyof Rerouter) => {
//     return target.instance[prop];
//   },
//   set: (target, prop: keyof Rerouter, value: any) => {
//     target.instance[prop] = value;
//     return true;
//   },
// }) as any as Rerouter;
export const rerouter = Rerouter.getInstance();
