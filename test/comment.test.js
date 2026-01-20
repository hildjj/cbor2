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

test('wtf8 comment', () => {
  testAll([
    ['\ud800', '', `0xd9011143eda080
d9 0111 -- Tag #273: (WTF8 string): "\\ud800"
  43    --   Bytes (Length: 3)
    eda080
`],
  ], {wtf8: true});
});

test('local tags comment', () => {
  function foo() {
    return 'foo';
  }
  foo.comment = t => `foo (${t.contents})`;

  assert.equal(
    comment('daffffffff00', {
      // Override the "never valid" tag to return "foo"
      tags: new Map([[4294967295, foo]]),
    }),
    `\
0xdaffffffff00
da ffffffff -- Tag #4294967295: foo (0)
  00        --   Unsigned: 0
`
  );
});

test('ignoreGlobalTags', () => {
  testAll([
    [/foo/, '', `0xd9524a8263666f6f60
d9 524a -- Tag #21066
  82    --   Array (Length: 2 items)
    63  --     [0] UTF8 (Length: 3): "foo"
      666f6f
    60  --     [1] UTF8 (Length: 0): ""
`],
  ], {ignoreGlobalTags: true});
});
