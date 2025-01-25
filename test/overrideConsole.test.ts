import { overrideConsole } from '../src/overrides';

// FIXME: should use a test framework
function testErrorLevel() {
  overrideConsole.setLogLevel('ERROR');

  overrideConsole.error('error');
  // no output below
  overrideConsole.warn('warn');
  overrideConsole.info('info');
  overrideConsole.debug('debug');
  overrideConsole.trace('trace');
  overrideConsole.log('log');
}

function testInfoLevel() {
  overrideConsole.setLogLevel('INFO');

  overrideConsole.error('error');
  overrideConsole.warn('warn');
  overrideConsole.info('info');

  // no output below
  overrideConsole.debug('debug');
  overrideConsole.trace('trace');
  overrideConsole.log('log');
}

function testAllLevel() {
  overrideConsole.setLogLevel('ALL');

  // all output below
  overrideConsole.error('error');
  overrideConsole.warn('warn');
  overrideConsole.info('info');
  overrideConsole.debug('debug');
  overrideConsole.trace('trace');
  overrideConsole.log('log');
}

function testOverrideConsole() {
  overrideConsole.setLogLevel('ALL');
  overrideConsole.doOverrideGlobalConsole(false);
  console.error('error');
  overrideConsole.doOverrideGlobalConsole(true);
  console.error('error');
  console.table({ a: 1, b: 2 });
  overrideConsole.doOverrideGlobalConsole(false);
  console.error('error');
  console.table({ a: 1, b: 2 });
}

// testErrorLevel();
// testInfoLevel();
// testAllLevel();
// testOverrideConsole();
