import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../../src/utils/ui.js';

let logOutput: string[];
let errorOutput: string[];
let origLog: typeof console.log;
let origError: typeof console.error;

function capture(): void {
  logOutput = [];
  errorOutput = [];
  origLog = console.log;
  origError = console.error;
  console.log = (...args: unknown[]) => { logOutput.push(args.map(String).join(' ')); };
  console.error = (...args: unknown[]) => { errorOutput.push(args.map(String).join(' ')); };
}

function restore(): void {
  console.log = origLog;
  console.error = origError;
}

function line(output: string[], index: number): string {
  const val = output[index];
  assert.ok(val !== undefined, `Expected output at index ${String(index)}`);
  return val;
}

describe('ui module', () => {
  beforeEach(() => {
    capture();
    process.env['NO_COLOR'] = '1';
    process.env['FORCE_COLOR'] = '0';
  });

  afterEach(() => {
    restore();
  });

  it('success() outputs icon and message with 2-space indent', () => {
    ui.success('done');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('\u2714'));
    assert.ok(out.includes('done'));
    assert.ok(out.startsWith('  '));
  });

  it('error() outputs icon and message to stderr', () => {
    ui.error('failed');
    assert.equal(errorOutput.length, 1);
    const out = line(errorOutput, 0);
    assert.ok(out.includes('\u2717'));
    assert.ok(out.includes('failed'));
  });

  it('error() with hint outputs two lines to stderr', () => {
    ui.error('failed', 'try again');
    assert.equal(errorOutput.length, 2);
    const msg = line(errorOutput, 0);
    const hint = line(errorOutput, 1);
    assert.ok(msg.includes('failed'));
    assert.ok(hint.includes('try again'));
    assert.ok(hint.startsWith('    '));
  });

  it('warn() outputs warn icon and message', () => {
    ui.warn('careful');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('\u25B2'));
    assert.ok(out.includes('careful'));
  });

  it('info() outputs dimmed text with 2-space indent', () => {
    ui.info('details');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('details'));
    assert.ok(out.startsWith('  '));
  });

  it('log() outputs plain text without prefix', () => {
    ui.log('plain');
    assert.equal(logOutput.length, 1);
    assert.equal(line(logOutput, 0), 'plain');
  });

  it('header() outputs bold text with 2-space indent', () => {
    ui.header('Title');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('Title'));
    assert.ok(out.startsWith('  '));
  });

  it('keyValue() outputs label and value with 4-space indent', () => {
    ui.keyValue('Key:', 'val');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('Key:'));
    assert.ok(out.includes('val'));
    assert.ok(out.startsWith('    '));
  });

  it('divider() outputs a dim line', () => {
    ui.divider();
    assert.equal(logOutput.length, 1);
    assert.ok(line(logOutput, 0).includes('\u2500'));
  });

  it('newline() outputs empty line', () => {
    ui.newline();
    assert.equal(logOutput.length, 1);
    assert.equal(line(logOutput, 0), '');
  });

  it('summary() shows passed count', () => {
    ui.summary({ passed: 5, failed: 0, skipped: 1 });
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('5 passed'));
    assert.ok(out.includes('1 skipped'));
  });

  it('summary() shows failed count', () => {
    ui.summary({ passed: 3, failed: 2 });
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('3 passed'));
    assert.ok(out.includes('2 failed'));
  });

  it('summary() shows all three when all zero', () => {
    ui.summary({});
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('0 passed'));
    assert.ok(out.includes('0 failed'));
  });

  it('timing() returns formatted string', () => {
    const result = ui.timing(45.6);
    assert.ok(result.includes('46ms') || result.includes('45ms'));
    assert.ok(result.includes('('));
    assert.ok(result.includes(')'));
  });

  it('list() outputs items with bullet prefix', () => {
    ui.list(['a', 'b']);
    assert.equal(logOutput.length, 2);
    const first = line(logOutput, 0);
    const second = line(logOutput, 1);
    assert.ok(first.includes('\u203A'));
    assert.ok(first.includes('a'));
    assert.ok(second.includes('b'));
    assert.ok(first.startsWith('    '));
  });

  it('check() shows pass icon when passed', () => {
    ui.check(true, 'ok');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('\u2714'));
    assert.ok(out.includes('ok'));
  });

  it('check() shows fail icon when failed', () => {
    ui.check(false, 'bad');
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('\u2717'));
    assert.ok(out.includes('bad'));
  });

  it('check() shows skip icon when skipped', () => {
    ui.check(true, 'skip', true);
    assert.equal(logOutput.length, 1);
    const out = line(logOutput, 0);
    assert.ok(out.includes('\u2013'));
    assert.ok(out.includes('skip'));
  });
});
