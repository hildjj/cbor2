import '../lib/types.js';
import * as cases from './cases.js';
import {TAG} from '../lib/constants.js';
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

test('DATE_EPOCH_DAYS', () => {
  testAll([
    [new Date(1363824000000), '', `0xd864193da9
d8 64     -- Tag #100: (Epoch Date) 2013-03-21T00:00:00.000Z
  19 3da9 --   Unsigned: 15785
`],
    [new Date('1940-10-09'), '', `0xd8643929b3
d8 64     -- Tag #100: (Epoch Date) 1940-10-09T00:00:00.000Z
  39 29b3 --   Negative: -10676
`],
    [new Date('1980-12-08'), '', `0xd864190f9a
d8 64     -- Tag #100: (Epoch Date) 1980-12-08T00:00:00.000Z
  19 0f9a --   Unsigned: 3994
`],
  ], {dateTag: TAG.DATE_EPOCH_DAYS});
});

test('DATE_FULL', () => {
  testAll([
    [new Date(1363824000000), '', `0xd903ec6a323031332d30332d3231
d9 03ec -- Tag #1004: (String Full Date) 2013-03-21T00:00:00.000Z
  6a    --   UTF8 (Length: 10): "2013-03-21"
    323031332d30332d
    3231
`],
    [new Date('1940-10-09'), '', `0xd903ec6a313934302d31302d3039
d9 03ec -- Tag #1004: (String Full Date) 1940-10-09T00:00:00.000Z
  6a    --   UTF8 (Length: 10): "1940-10-09"
    313934302d31302d
    3039
`],
    [new Date('1980-12-08'), '', `0xd903ec6a313938302d31322d3038
d9 03ec -- Tag #1004: (String Full Date) 1980-12-08T00:00:00.000Z
  6a    --   UTF8 (Length: 10): "1980-12-08"
    313938302d31322d
    3038
`],
  ], {dateTag: TAG.DATE_FULL});
});
