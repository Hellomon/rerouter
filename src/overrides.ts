const originConsole = (console as any)._override
  ? {
      error: (console as any)._error,
      warn: (console as any)._warn,
      info: (console as any)._info,
      debug: (console as any)._debug,
      trace: (console as any)._trace,
      log: (console as any)._log,
    }
  : {
      error: createShadowMethod(console, console.error),
      warn: createShadowMethod(console, console.warn),
      info: createShadowMethod(console, console.info),
      debug: createShadowMethod(console, console.debug),
      trace: createShadowMethod(console, console.trace),
      log: createShadowMethod(console, console.log),
    };

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'ALL';
const logLevels: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
  ALL: 5,
};

const levelToMethod: Record<LogLevel, typeof console.log> = {
  ERROR: originConsole.error,
  WARN: originConsole.warn,
  INFO: originConsole.info,
  DEBUG: originConsole.debug,
  TRACE: originConsole.trace,
  ALL: originConsole.log,
};

/**
 * @description a console with custom log level, print human-readable time with specific timezone offset
 */
export const overrideConsole: typeof originConsole & {
  timezoneOffsetHour: number | undefined;
  logLevel: LogLevel;

  /**
   * @description for print human-readable time, set timezone offset in hour
   * @param timezoneOffsetHour timezone offset in hour, default is undefined (system's timezone)
   */
  setTimezoneOffsetHour: (timezoneOffsetHour: number | undefined) => void;

  /**
   * @description set log level
   * @param level log level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'ALL'
   */
  setLogLevel: (level: LogLevel) => void;

  /**
   * @description override global console among all modules
   * @param isOverride true to override, false to restore
   */
  doOverrideGlobalConsole: (isOverride: boolean) => void;
} = {
  timezoneOffsetHour: 8, // taipei timezone
  logLevel: 'ALL',

  doOverrideGlobalConsole: (isOverride: boolean) => {
    const c = console as any;
    const isOverrideBefore = !!c._override;
    if (isOverride === true && !isOverrideBefore) {
      c._override = true;
      c._error = console.error;
      c._warn = console.warn;
      c._info = console.info;
      c._debug = console.debug;
      c._trace = console.trace;
      c._log = console.log;

      c.error = overrideConsole.error;
      c.warn = overrideConsole.warn;
      c.info = overrideConsole.info;
      c.debug = overrideConsole.debug;
      c.trace = overrideConsole.trace;
      c.log = overrideConsole.log;

      console.warn('console is overridden !!!');
    } else if (isOverride === false && isOverrideBefore) {
      c._override = false;
      c.error = c._error;
      c.warn = c._warn;
      c.info = c._info;
      c.debug = c._debug;
      c.trace = c._trace;
      c.log = c._log;

      c._error = undefined;
      c._warn = undefined;
      c._info = undefined;
      c._debug = undefined;
      c._trace = undefined;
      c._log = undefined;

      console.warn('console is undo overridden !!!');
    }
  },

  setTimezoneOffsetHour: (timezoneOffsetHour: number | undefined) => {
    overrideConsole.timezoneOffsetHour = timezoneOffsetHour;
  },
  setLogLevel: (level: LogLevel) => {
    overrideConsole.logLevel = level;
  },

  // override log related method
  error: logFactory('ERROR', 'red'),
  warn: logFactory('WARN', 'magenta'),
  info: logFactory('INFO', 'yellow'),
  debug: logFactory('DEBUG', 'cyan'),
  trace: logFactory('TRACE', 'white'),
  log: logFactory('ALL', 'grey'),
};

function createShadowMethod(self: Console, method: Function) {
  return (...args: Parameters<typeof console.log>) => {
    method.apply(self, args);
  };
}

function logFactory(level: LogLevel, color: keyof typeof colors) {
  return (message?: any, ...optionalParams: any[]) => {
    if (!isEnable(level)) return;
    const header = getHeader(level, color);

    const msg = header + trimMessage(message);
    levelToMethod[level](msg, ...optionalParams);
  };
}

function isEnable(level: LogLevel) {
  return logLevels[overrideConsole.logLevel] >= logLevels[level];
}

function getHeader(level: LogLevel, color: keyof typeof colors) {
  const header = `[${timeLabel(overrideConsole.timezoneOffsetHour)}][${level}] `;
  return `${header}`;
  // cannot use color in `output` panel, this only works in terminal
  // return colorize(header, color);
}

function trimMessage(message: string) {
  return `${message || ''}`.substring(0, 1000);
}

function timeLabel(timezoneOffsetHours: number | undefined = undefined) {
  const date = new Date();
  
  // If timezone offset is specified, adjust the date
  if (timezoneOffsetHours !== undefined) {
    const systemOffset = -date.getTimezoneOffset() / 60;
    const hoursDiff = timezoneOffsetHours - systemOffset;
    date.setTime(date.getTime() + hoursDiff * 3600000);
  }

  // Format the date components (will use local time display)
  const YYYY = date.getFullYear();
  const MM = ('0' + (date.getMonth() + 1)).slice(-2); // Months are 0-based
  const DD = ('0' + date.getDate()).slice(-2);
  const HH = ('0' + date.getHours()).slice(-2);
  const mm = ('0' + date.getMinutes()).slice(-2);
  const ss = ('0' + date.getSeconds()).slice(-2);

  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
}

// cannot use color in `output` panel, this only works in terminal
function colorize(str: string, color: keyof typeof colors) {
  const colorItem = colors[color];
  return `\u001b[${colorItem[0]}m${str}\u001b[${colorItem[1]}m`;
}

// ref: https://github.com/nodejs/node/blob/b1c8f15c5f169e021f7c46eb7b219de95fe97603/lib/util.js#L201-L230
const colors = {
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  white: [37, 39],
  grey: [90, 39],
  black: [30, 39],
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39],
};
