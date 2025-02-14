import '../lib/types.js';
import * as cases from './cases.js';
import assert from 'node:assert/strict';
import {comment} from '../lib/comment.js';
import {parseEDN} from 'cbor-edn';
import test from 'node:test';

function testAll(list, opts) {
  let count = 0;
  for (const [_orig, _diag, commented] of list) {
    if (commented) {
      const c = comment(cases.toBuffer(commented), opts);
      assert.equal(c, commented);
      count++;
    }
  }
  assert.equal(count, list.length);
}

function failAll(list, opts) {
  for (const c of list) {
    assert.throws(() => comment(cases.toBuffer(c), opts), c);
  }
}

test('comment good', () => {
  testAll(cases.good);
  testAll(cases.decodeGood);
});

test('comment bad', () => {
  failAll([
    '0xff',
  ]);
});

test('EDN ranges', () => {
  // This is why the pnpm override is needed in package.json for cbor2.
  const bytes = parseEDN("<< 'abc' >>");
  assert.equal(comment(bytes), `\
0x4443616263
44 -- Bytes (Length: 4)
   --  << h'616263' >>
  43 -- Bytes (Length: 3)
     --    'abc'
    616263
`);
});
