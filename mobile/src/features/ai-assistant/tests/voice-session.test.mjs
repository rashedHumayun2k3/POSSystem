import assert from 'node:assert/strict';
import { createVoiceSession } from '../services/voiceSession.ts';

function setup(timeout = 1000) {
  const listeners = new Map();
  const output = { phases: [], texts: [], errors: [], stops: 0, aborts: 0 };
  const emit = (name, event) => [...(listeners.get(name) ?? [])].forEach(fn => fn(event));
  const recognition = {
    addListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return { remove: () => listeners.get(name).delete(fn) };
    },
    start() {},
    stop() { output.stops++; },
    abort() { output.aborts++; emit('error', { error: 'aborted' }); },
  };
  const session = createVoiceSession(recognition, { lang: 'bn-BD', continuous: true }, {
    onPhase: p => output.phases.push(p),
    onText: t => output.texts.push(t),
    onError: e => output.errors.push(e),
  }, timeout);
  const result = (text, isFinal = false) => emit('result', { isFinal, results: [{ transcript: text }] });
  return { session, output, emit, result };
}

// Explicit finish must await the final result instead of aborting/discarding it.
{
  const t = setup();
  assert.deepEqual(t.output.phases, ['starting']);
  t.emit('audiostart', {});
  t.result('আজকের');
  assert.deepEqual(t.output.texts, []);
  t.session.finish();
  assert.equal(t.output.stops, 1);
  assert.equal(t.output.aborts, 0);
  t.result('আজকের সেল কত টাকা', true);
  assert.deepEqual(t.output.texts, []);
  t.emit('end');
  assert.deepEqual(t.output.texts, ['আজকের সেল কত টাকা']);
  t.session.finish();
  assert.equal(t.output.stops, 1);
}
// Continuous Android segments must accumulate, with only the latest interim text.
{
  const t = setup();
  t.emit('audiostart', {});
  t.result('আজকের', true);
  t.result('সেল');
  t.result('সেল কত টাকা', true);
  t.emit('end');
  assert.equal(t.output.phases.at(-1), 'ready');
  assert.deepEqual(t.output.texts, []);
  t.session.finish();
  assert.deepEqual(t.output.texts, ['আজকের সেল কত টাকা']);
}
// Cancelling or navigating away must not publish delayed results.
{
  const t = setup();
  t.result('discard');
  t.session.cancel();
  t.result('late result', true);
  t.emit('end');
  assert.equal(t.output.aborts, 1);
  assert.deepEqual(t.output.texts, []);
  assert.deepEqual(t.output.errors, []);
}
// Permission/service failures and silence must be visible.
for (const code of ['not-allowed', 'language-not-supported', 'network', 'audio-capture']) {
  const t = setup();
  t.emit('error', { error: code });
  assert.equal(t.output.errors.length, 1);
  assert.deepEqual(t.output.texts, []);
}
{
  const t = setup();
  t.emit('end');
  assert.equal(t.output.errors.length, 1);
}
// Android can report a client error when stopping a segmented session.
{
  const t = setup();
  t.result('আজকের সেল কত টাকা');
  t.session.finish();
  t.emit('error', { error: 'client' });
  assert.deepEqual(t.output.texts, ['আজকের সেল কত টাকা']);
  assert.deepEqual(t.output.errors, []);
}
// Neither startup nor finalization can leave a spinner running indefinitely.
for (const finish of [false, true]) {
  const t = setup(10);
  if (finish) { t.emit('audiostart', {}); t.session.finish(); }
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(t.output.errors.length, 1);
  assert.equal(t.output.aborts, 1);
}
console.log('Passed: finalization, segmented speech, cancellation, errors, silence, and timeouts.');
