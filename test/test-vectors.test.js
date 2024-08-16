/* eslint-disable no-console */

import '../lib/types.js';
import {base64ToBytes, hexToU8, u8toHex} from '../lib/utils.js';
import {decode, diagnose, encode} from '../lib/index.js';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadVectors(...paths) {
  const fileName = path.resolve(__dirname, ...paths);
  let str = null;
  try {
    str = await readFile(fileName, {encoding: 'utf8'});
  } catch (ignored) {
    throw new Error(`"${fileName}" not found.
  use command \`git submodule update --init\` to load test-vectors`);
  }

  // HACK: don't lose data when JSON parsing
  str = str.replace(
    /"decoded":\s*(?<num>-?\d+(?:\.\d+)?(?:e[+-]\d+)?)\r?\n/g,
    `"decoded": {
      "___TYPE___": "number",
      "___VALUE___": "$<num>"
    }`
  );

  const ret = JSON.parse(str, (_key, value) => {
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
  assert(Array.isArray(ret));
  return ret;
}

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
    if ('decoded' in v) {
      res.originalEncoded = encode(v.decoded, opts);
    }
  } catch (e) {
    e.message = `With "${v.hex}\n${e.message}"`;
    throw e;
  }
  return res;
}

test('vectors', async() => {
  const vectors = await loadVectors('..', 'test-vectors', 'appendix_a.json');

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
          const boxedInfo = applesauce(v, {boxed: true, saveOriginal: true});
          assert.deepEqual(u8toHex(boxedInfo.encoded), v.hex);
        } else {
          assert.deepEqual(u8toHex(info.encoded), v.hex);
        }
      }
    }
  }
});

test('errors', async() => {
  const failures = await loadVectors('..', 'test-vectors', 'fail.json');

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

test('dcbor valid', async() => {
  const tests = await loadVectors('..', 'dcbor-test-vectors', 'valid.json');

  for (const v of tests) {
    const info = applesauce(v, {dcbor: true});

    if (!v.skipDecode) {
      assert.deepEqual(info.decoded, info.roundtrip, v.hex);
    }

    if ('diagnostic' in v) {
      assert.deepEqual(info.diagnosed, v.diagnostic, v.hex);
    }

    if ('decoded' in v) {
      if (!v.skipDecode) {
        assert.deepEqual(info.decoded, v.decoded, v.hex);
      }

      if (v.roundtrip) {
        assert.deepEqual(u8toHex(info.encoded), v.hex);
      }
    }
  }
});

test('dcbor invalid', async() => {
  const failures = await loadVectors('..', 'dcbor-test-vectors', 'invalid.json');

  let count = 0;
  for (const f of failures) {
    assert.equal(diagnose(f.hex), f.diagnostic);
    assert.throws(() => {
      const s = decode(f.hex, {encoding: 'hex', dcbor: true});
      console.log('SHOULD THROW', f.hex, [...s]);
    });

    if (f.roundtrip) {
      assert.throws(() => {
        const original = decode(f.hex, {encoding: 'hex'});
        const encoded = encode(original, {dcbor: true});
        console.log('SHOULD THROW ENCODE', f.hex, u8toHex(encoded));
      });
    }
    count++;
  }
  assert.equal(count, failures.length);
});
