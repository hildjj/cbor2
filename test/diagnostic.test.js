import '../lib/types.js';
import {decodeBad, decodeGood, good, goodBoxed, toBuffer} from './cases.js';
import {DiagnosticSizes} from '../lib/options.js';
import assert from 'node:assert/strict';
import {diagnose} from '../lib/diagnostic.js';
import test from 'node:test';

function testAll(list, opts) {
  let count = 0;
  for (const [_orig, diag, commented] of list) {
    const d = diagnose(toBuffer(commented), opts);
    assert.equal(d, diag, commented);
    count++;
  }
  assert.equal(count, list.length);
}

function failAll(list) {
  let count = 0;
  for (const hex of list) {
    assert.throws(() => diagnose(toBuffer(hex)), hex);
    count++;
  }
  assert.equal(count, list.length);
}

test('good diagnose', () => {
  testAll(good, {diagnosticSizes: DiagnosticSizes.ALWAYS});
});

test('good boxed diagnose', () => {
  testAll(goodBoxed, {boxed: true, diagnosticSizes: DiagnosticSizes.ALWAYS});
});

test('diagnose decodeGood ', () => {
  testAll(decodeGood);
});

test('diagnose decodeBad', () => {
  failAll(decodeBad);
});

test('diagnose encodings', () => {
  assert.equal(diagnose('AA==', {encoding: 'base64'}), '0');
});

test('never use lengths', () => {
  assert.equal(
    diagnose('1b0000000000000002', {diagnosticSizes: DiagnosticSizes.NEVER}),
    '2'
  );
});

test('pretty', () => {
  assert.equal(
    diagnose('a26474797065f563666f6fa4f40203820204048005a0', {pretty: true}),
    `\
{
  "type": true,
  "foo": {
    false: 2,
    3: [
      2,
      4
    ],
    4: [],
    5: {}
  }
}`
  );
});
