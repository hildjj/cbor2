/* eslint-disable no-console */

import '../lib/types.js';
import {base64ToBytes, hexToU8, u8toHex} from '../lib/utils.js';
import {decode, diagnose, encode} from '../lib/index.js';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let vecStr = null;
const vectorDir = path.resolve(
  __dirname, '..', 'test-vectors'
);
const appendix_a = path.join(vectorDir, 'appendix_a.json');
try {
  vecStr = await readFile(appendix_a, {encoding: 'utf8'});
} catch (ignored) {
  throw new Error(`"${appendix_a}" not found.
use command \`git submodule update --init\` to load test-vectors`);
}

// HACK: don't lose data when JSON parsing
vecStr = vecStr.replace(
  /"decoded":\s*(?<num>-?\d+(?:\.\d+)?(?:e[+-]\d+)?)\r?\n/g,
  `"decoded": {
    "___TYPE___": "number",
    "___VALUE___": "$<num>"
  }`
);
const vectors = JSON.parse(vecStr, (key, value) => {
  if (!value) {
    return value;
  }
  if (value.___TYPE___ === 'number') {
    const v = value.___VALUE___;
    const f = Number.parseFloat(v);
    try {
      const bi = BigInt(v);
      if ((bi > Number.MAX_SAFE_INTEGER) || (bi < Number.MIN_SAFE_INTEGER)) {
        return bi;
      }
    } catch (_) {
      // Ingore
    }
    return f;
  }
  return value;
});

let failStr = null;
const fail = path.join(vectorDir, 'fail.json');
try {
  failStr = await readFile(fail, {encoding: 'utf8'});
} catch (ignored) {
  throw new Error(`"${fail}" not found.
use command \`git submodule update --init\` to load test-vectors`);
}
const failures = JSON.parse(failStr);

// Fixed with boxed decoding.
const failRoundtrip = new Set([
  'f90000',
  'f93c00',
  'f97bff',
  'fa47c35000',
  'f9c400',
]);

// Criss-cross.
function applesauce(v, opts) {
  const res = {};
  res.buffer = hexToU8(v.hex);
  assert.deepEqual(base64ToBytes(v.cbor), res.buffer, 'mismatch');

  try {
    res.decoded = decode(res.buffer, opts);
    res.diagnosed = diagnose(res.buffer, opts);
    res.encoded = encode(res.decoded, opts);
    res.roundtrip = decode(res.encoded, opts);
  } catch (e) {
    e.message = `With "${v.hex}\n${e.message}"`;
    throw e;
  }
  return res;
}

test('vectors', () => {
  assert(Array.isArray(vectors));
  for (const v of vectors) {
    const info = applesauce(v);

    assert.deepEqual(info.decoded, info.roundtrip, v.hex);

    if ('diagnostic' in v) {
      // Take off the _0 markings
      const boring = info.diagnosed.replace(/_\d+/g, '');
      assert.deepEqual(boring, v.diagnostic, v.hex);
    }

    if ('decoded' in v) {
      assert.deepEqual(info.decoded, v.decoded, v.hex);

      if (v.roundtrip) {
        if (failRoundtrip.has(v.hex)) {
          // Start over
          const boxedInfo = applesauce(v, {boxed: true});
          assert.deepEqual(u8toHex(boxedInfo.encoded), v.hex);
        } else {
          assert.deepEqual(u8toHex(info.encoded), v.hex);
        }
      }
    }
  }
});

test('errors', () => {
  let count = 0;
  for (const f of failures) {
    assert.throws(() => {
      const s = decode(f.hex, {encoding: 'hex'});
      console.log('SHOULD THROW', f.hex, [...s]);
    });

    count++;
  }
  assert.equal(count, failures.length);
});
