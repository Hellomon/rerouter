// FIXME: should use a test framework. Run: npx ts-node --transpile-only test/eventLog.test.ts
let failed = 0;
function check(name: string, ok: boolean, detail: string = '') {
  process.stdout.write((ok ? 'ok   ' : 'FAIL ') + name + ' ' + detail + '\n');
  if (!ok) {
    failed++;
  }
}

// the console.log before the override is taken when the module is loaded: put the recorder there first
const printed: string[] = [];
const realLog = console.log;
console.log = (...args: any[]) => {
  printed.push(args.join(' '));
};
const { formatEvent, logEvent, setEventTaskProvider, EVENT_MAX_CHARS } = require('../src/eventLog');
const { overrideConsole } = require('../src/overrides');
const defaults = require('../src/defaults');

function parse(line: string) {
  return JSON.parse(line.substring('@ev '.length));
}

// the shape
setEventTaskProvider(undefined);
let line = formatEvent('outcome', { name: 'battle.finished', res: 'ok' });
check('line begins with the mark', line.indexOf('@ev ') === 0, line);
let body = parse(line);
check('version, name, task - when none', body.v === 1 && body.e === 'outcome' && body.task === '-', line);
check('fields are kept', body.name === 'battle.finished' && body.res === 'ok');

setEventTaskProvider(() => 'pvp');
check('task from the provider', parse(formatEvent('x')).task === 'pvp');
check('task of the caller wins', parse(formatEvent('x', { task: 'train' })).task === 'train');
check('undefined fields are left out', Object.keys(parse(formatEvent('x', { a: undefined, b: 0, c: false, d: null }))).join(',') === 'v,e,task,b,c,d');
check('v and e cannot be overwritten', (function () { const b = parse(formatEvent('x', { v: 9, e: 'y' })); return b.v === 1 && b.e === 'x'; })());

// the length
const long = new Array(2000).join('x');
line = formatEvent('say', { text: long, n: 3 });
body = parse(line);
check('a long value is shortened, the line stays valid', line.length <= EVENT_MAX_CHARS && body.n === 3 && body.text.length < 100 && body.trunc === true, 'len=' + line.length);

const many: any = {};
for (let i = 0; i < 100; i++) { many['key' + i] = 'value-number-' + i; }
line = formatEvent('many', many);
body = parse(line);
check('too many fields: the last are dropped, trunc says so', line.length <= EVENT_MAX_CHARS && body.trunc === true && body.key0 === 'value-number-0' && body.key99 === undefined, 'len=' + line.length);

line = formatEvent('n'.repeat(3000));
body = parse(line);
check('a name that is too long alone still gives valid JSON', line.length <= EVENT_MAX_CHARS && body.trunc === true && body.e.length === 60);

line = formatEvent('short', { a: 1 });
check('a short line has no trunc', parse(line).trunc === undefined);
check('the limit can be given', formatEvent('x', { text: long }, undefined, 5000).indexOf('trunc') < 0);

// what is printed: no time header, no level, no cut at 1000, with the console overridden too
overrideConsole.doOverrideGlobalConsole(true);
printed.length = 0;
logEvent('outcome', { name: 'a.b', res: 'ok' });
check('printed once, begins with the mark', printed.length === 1 && printed[0].indexOf('@ev ') === 0, printed[0]);
printed.length = 0;
console.log('plain');
check('console.log of the script still has its header', printed.length === 1 && /^\[.*\]\[ALL\] plain/.test(printed[0]), printed[0]);
overrideConsole.doOverrideGlobalConsole(false);

// Rerouter itself writes nothing unless it is asked
check('eventLog is off by default', defaults.DEFAULT_REROUTER_CONFIG.eventLog === false);

console.log = realLog;
process.stdout.write(failed ? failed + ' failed\n' : 'all passed\n');
process.exit(failed ? 1 : 0);
