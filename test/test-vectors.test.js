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

// TODO: Don't know how to make these round-trip.  See:
// https://github.com/cbor/test-vectors/issues/3
const failRoundtrip = new Set([
  'f90000',
  'f93c00',
  'f97bff',
  'fa47c35000',
  'f9c400',
]);

test('vectors', () => {
  assert(Array.isArray(vectors));
  for (const v of vectors) {
    const buffer = hexToU8(v.hex);

    let decoded = null;
    try {
      decoded = decode(buffer);
    } catch (e) {
      console.log('DECODE ERROR', v.hex);
      throw e;
    }

    const encoded = encode(decoded);
    const redecoded = decode(encoded);

    assert.deepEqual(base64ToBytes(v.cbor), buffer, 'mismatch');

    assert.deepEqual(
      decoded,
      redecoded,
      `round trip error: ${v.hex} -> ${u8toHex(encoded)}`
    );

    if (Object.prototype.hasOwnProperty.call(v, 'diagnostic')) {
      const d = diagnose(buffer);
      assert.deepEqual(d.replace(/_\d+/g, ''), v.diagnostic);
    }

    if (Object.prototype.hasOwnProperty.call(v, 'decoded')) {
      assert.deepEqual(decoded, v.decoded, `Hex: "${v.hex}"`);

      if (v.roundtrip) {
        if (failRoundtrip.has(v.hex)) {
          assert.notDeepEqual(encoded, buffer);
        } else {
          assert.deepEqual(u8toHex(encoded), v.hex);
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
