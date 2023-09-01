import {Simple} from '../lib/simple.js';
import {Tag} from '../lib/tag.js';
import {box} from '../lib/box.js';
import {hexToU8} from '../lib/utils.js';

export class TempClass {
  constructor(val) {
    // Render as the string tempClass with the tag 0xffff
    this.value = val || 'tempClass';
  }

  toCBOR() {
    return [0xfffe, this.value];
  }
}

export const goodNumbers = [
  [0, '0', `0x00
00 -- Unsigned: 0\n`],
  [1, '1', `0x01
01 -- Unsigned: 1\n`],
  [10, '10', `0x0a
0a -- Unsigned: 10\n`],
  [23, '23', `0x17
17 -- Unsigned: 23\n`],
  [24, '24_0', `0x1818
18 18 -- Unsigned: 24\n`],
  [25, '25_0', `0x1819
18 19 -- Unsigned: 25\n`],
  [100, '100_0', `0x1864
18 64 -- Unsigned: 100\n`],
  [1000, '1000_1', `0x1903e8
19 03e8 -- Unsigned: 1000\n`],
  [1000000, '1000000_2', `0x1a000f4240
1a 000f4240 -- Unsigned: 1000000\n`],
  [1000000000000, '1000000000000_3', `0x1b000000e8d4a51000
1b 000000e8d4a51000 -- Unsigned: 1000000000000\n`],

  // JS rounding: 18446744073709552000
  // [18446744073709551615, '0x1bffffffffffffffff'],
  [Number.MAX_SAFE_INTEGER, '9007199254740991_3', `0x1b001fffffffffffff
1b 001fffffffffffff -- Unsigned: 9007199254740991\n`],
  [Number.MAX_VALUE, '1.7976931348623157e+308_3', `0xfb7fefffffffffffff
fb 7fefffffffffffff -- Float: 1.7976931348623157e+308\n`],
  [Number.MIN_SAFE_INTEGER, '-9007199254740991_3', `0x3b001ffffffffffffe
3b 001ffffffffffffe -- Negative: -9007199254740991\n`],
  [Number.MIN_SAFE_INTEGER - 1, '-9007199254740992_2', `0xfada000000
fa da000000 -- Float: -9007199254740992\n`],
  [Number.MIN_SAFE_INTEGER - 2, '-9007199254740992_2', `0xfada000000
fa da000000 -- Float: -9007199254740992\n`],
  [Number.MIN_VALUE, '5e-324_3', `0xfb0000000000000001
fb 0000000000000001 -- Float: 5e-324\n`],
];

// [Decoded, Diagnostic, Commented]
export const good = [
  ...goodNumbers,

  [-0x1c0000000000000001n, '3(h\'1c0000000000000000\')', `0xc3491c0000000000000000
c3   -- Tag #3
  49 --   Bytes (Length: 9)
    1c00000000000000
    00\n`],
  [18446744073709551616n, '2(h\'010000000000000000\')', `0xc249010000000000000000
c2   -- Tag #2
  49 --   Bytes (Length: 9)
    0100000000000000
    00\n`],
  [-18446744073709551617n, '3(h\'010000000000000000\')', `0xc349010000000000000000
c3   -- Tag #3
  49 --   Bytes (Length: 9)
    0100000000000000
    00\n`],
  [-1, '-1', `0x20
20 -- Negative: -1\n`],
  [-10, '-10', `0x29
29 -- Negative: -10\n`],
  [-100, '-100_0', `0x3863
38 63 -- Negative: -100\n`],
  [-1000, '-1000_1', `0x3903e7
39 03e7 -- Negative: -1000\n`],
  [1.1, '1.1_3', `0xfb3ff199999999999a
fb 3ff199999999999a -- Float: 1.1\n`],

  // Node-cbor doesn't do short floats without canonical, so this says
  // fa3fc00000
  [1.5, '1.5_1', `0xf93e00
f9 3e00 -- Float: 1.5\n`],
  [3.4028234663852886e+38, '3.4028234663852886e+38_2', `0xfa7f7fffff
fa 7f7fffff -- Float: 3.4028234663852886e+38\n`],
  [1e+300, '1e+300_3', `0xfb7e37e43c8800759c
fb 7e37e43c8800759c -- Float: 1e+300\n`],

  // Short now, so not fa33800000
  [5.960464477539063e-8, '5.960464477539063e-8_1', `0xf90001
f9 0001 -- Float: 5.960464477539063e-8\n`],

  // Short now, so not fa38800000
  [0.00006103515625, '0.00006103515625_1', `0xf90400
f9 0400 -- Float: 0.00006103515625\n`],
  [-4.1, '-4.1_3', `0xfbc010666666666666
fb c010666666666666 -- Float: -4.1\n`],

  [2.5, '2.5_1', `0xf94100
f9 4100 -- Float: 2.5\n`],
  [-0, '-0_1', `0xf98000
f9 8000 -- Float: -0\n`],
  [0.00006103515625, '0.00006103515625_1', `0xf90400
f9 0400 -- Float: 0.00006103515625\n`],
  [1.1920928955078125e-7, '1.1920928955078125e-7_1', `0xf90002
f9 0002 -- Float: 1.1920928955078125e-7\n`], // De-norm
  [1.1478035721284577e-41, '1.1478035721284577e-41_2', `0xfa00001fff
fa 00001fff -- Float: 1.1478035721284577e-41\n`], // Exp too small
  [3.4011621342146535e+38, '3.4011621342146535e+38_2', `0xfa7f7fe000
fa 7f7fe000 -- Float: 3.4011621342146535e+38\n`], // Exp too big
  [1.1944212019443512e-7, '1.1944212019443512e-7_2', `0xfa34004000
fa 34004000 -- Float: 1.1944212019443512e-7\n`], // De-norm prec loss

  [Infinity, 'Infinity_1', `0xf97c00
f9 7c00 -- Float: Infinity\n`],
  [NaN, 'NaN_1', `0xf97e00
f9 7e00 -- Float: NaN\n`],
  [-Infinity, '-Infinity_1', `0xf9fc00
f9 fc00 -- Float: -Infinity\n`],
  [false, 'false', `0xf4
f4 -- Simple: false\n`],
  [true, 'true', `0xf5
f5 -- Simple: true\n`],
  [null, 'null', `0xf6
f6 -- Simple: null\n`],
  [undefined, 'undefined', `0xf7
f7 -- Simple: undefined\n`],

  [new Simple(16), 'simple(16)', `0xf0
f0 -- Simple: 16\n`],
  [new Simple(32), 'simple(32)_0', `0xf820
f8 20 -- Simple: 32\n`],
  [new Simple(255), 'simple(255)_0', `0xf8ff
f8 ff -- Simple: 255\n`],
  [new Date(1363896240000), '1(1363896240_2)', `0xc11a514b67b0
c1            -- Tag #1
  1a 514b67b0 --   Unsigned: 1363896240\n`],

  [new URL('http://www.example.com'), '32_0("http://www.example.com/")', `0xd82077687474703a2f2f7777772e6578616d706c652e636f6d2f
d8 20 -- Tag #32
  77  --   UTF8 (Length: 23): "http://www.example.com/"
    687474703a2f2f77
    77772e6578616d70
    6c652e636f6d2f\n`],
  [new Uint8Array([]), 'h\'\'', `0x40
40 -- Bytes (Length: 0)\n`],
  [hexToU8('01020304'), 'h\'01020304\'', `0x4401020304
44 -- Bytes (Length: 4)
  01020304\n`],
  [hexToU8('000102030405060708090a0b0c0d0e0f101112131415161718'), 'h\'000102030405060708090a0b0c0d0e0f101112131415161718\'', `0x5819000102030405060708090a0b0c0d0e0f101112131415161718
58 19 -- Bytes (Length: 25)
  0001020304050607
  08090a0b0c0d0e0f
  1011121314151617
  18\n`],

  ['', '""', `0x60
60 -- UTF8 (Length: 0): ""\n`],
  ['a', '"a"', `0x6161
61 -- UTF8 (Length: 1): "a"
  61\n`],
  ['IETF', '"IETF"', `0x6449455446
64 -- UTF8 (Length: 4): "IETF"
  49455446\n`],
  // Ideally, the commented version would have the BOM escaped, I think, but at
  // least this tests that it gets parsed correctly.
  ['\ufeffBOM', '"\ufeffBOM"', `0x66efbbbf424f4d
66 -- UTF8 (Length: 6): "\ufeffBOM"
  efbbbf424f4d\n`],
  ['"\\', '"\\"\\\\"', `0x62225c
62 -- UTF8 (Length: 2): "\\"\\\\"
  225c\n`],
  ['\u00fc', '"\u00fc"', `0x62c3bc
62 -- UTF8 (Length: 2): "ü"
  c3bc\n`],
  ['\u6c34', '"\u6c34"', `0x63e6b0b4
63 -- UTF8 (Length: 3): "水"
  e6b0b4\n`],
  ['\ud800\udd51', '"\ud800\udd51"', `0x64f0908591
64 -- UTF8 (Length: 4): "𐅑"
  f0908591\n`],
  [[], '[]', `0x80
80 -- Array (Length: 0 items)\n`],
  [[1, 2, 3], '[1, 2, 3]', `0x83010203
83   -- Array (Length: 3 items)
  01 --   [0] Unsigned: 1
  02 --   [1] Unsigned: 2
  03 --   [2] Unsigned: 3\n`],
  [[1, [2, 3], [4, 5]], '[1, [2, 3], [4, 5]]', `0x8301820203820405
83     -- Array (Length: 3 items)
  01   --   [0] Unsigned: 1
  82   --   [1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
  82   --   [2] Array (Length: 2 items)
    04 --     [0] Unsigned: 4
    05 --     [1] Unsigned: 5\n`],

  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24_0, 25_0]', `0x98190102030405060708090a0b0c0d0e0f101112131415161718181819
98 19   -- Array (Length: 25 items)
  01    --   [0] Unsigned: 1
  02    --   [1] Unsigned: 2
  03    --   [2] Unsigned: 3
  04    --   [3] Unsigned: 4
  05    --   [4] Unsigned: 5
  06    --   [5] Unsigned: 6
  07    --   [6] Unsigned: 7
  08    --   [7] Unsigned: 8
  09    --   [8] Unsigned: 9
  0a    --   [9] Unsigned: 10
  0b    --   [10] Unsigned: 11
  0c    --   [11] Unsigned: 12
  0d    --   [12] Unsigned: 13
  0e    --   [13] Unsigned: 14
  0f    --   [14] Unsigned: 15
  10    --   [15] Unsigned: 16
  11    --   [16] Unsigned: 17
  12    --   [17] Unsigned: 18
  13    --   [18] Unsigned: 19
  14    --   [19] Unsigned: 20
  15    --   [20] Unsigned: 21
  16    --   [21] Unsigned: 22
  17    --   [22] Unsigned: 23
  18 18 --   [23] Unsigned: 24
  18 19 --   [24] Unsigned: 25\n`],
  [{}, '{}', `0xa0
a0 -- Map (Length: 0 pairs)\n`],
  [{1: 2, 3: 4}, '{"1": 2, "3": 4}', `0xa2613102613304
a2   -- Map (Length: 2 pairs)
  61 --   [key 0] UTF8 (Length: 1): "1"
    31
  02 --   [val 0] Unsigned: 2
  61 --   [key 1] UTF8 (Length: 1): "3"
    33
  04 --   [val 1] Unsigned: 4\n`],
  [{a: 1, b: [2, 3]}, '{"a": 1, "b": [2, 3]}', `0xa26161016162820203
a2     -- Map (Length: 2 pairs)
  61   --   [key 0] UTF8 (Length: 1): "a"
    61
  01   --   [val 0] Unsigned: 1
  61   --   [key 1] UTF8 (Length: 1): "b"
    62
  82   --   [val 1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3\n`],
  [['a', {b: 'c'}], '["a", {"b": "c"}]', `0x826161a161626163
82     -- Array (Length: 2 items)
  61   --   [0] UTF8 (Length: 1): "a"
    61
  a1   --   [1] Map (Length: 1 pair)
    61 --     [key 0] UTF8 (Length: 1): "b"
      62
    61 --     [val 0] UTF8 (Length: 1): "c"
      63\n`],
  [{a: 'A', b: 'B', c: 'C', d: 'D', e: 'E'}, '{"a": "A", "b": "B", "c": "C", "d": "D", "e": "E"}', `0xa56161614161626142616361436164614461656145
a5   -- Map (Length: 5 pairs)
  61 --   [key 0] UTF8 (Length: 1): "a"
    61
  61 --   [val 0] UTF8 (Length: 1): "A"
    41
  61 --   [key 1] UTF8 (Length: 1): "b"
    62
  61 --   [val 1] UTF8 (Length: 1): "B"
    42
  61 --   [key 2] UTF8 (Length: 1): "c"
    63
  61 --   [val 2] UTF8 (Length: 1): "C"
    43
  61 --   [key 3] UTF8 (Length: 1): "d"
    64
  61 --   [val 3] UTF8 (Length: 1): "D"
    44
  61 --   [key 4] UTF8 (Length: 1): "e"
    65
  61 --   [val 4] UTF8 (Length: 1): "E"
    45\n`],
  [hexToU8('0102030405'), 'h\'0102030405\'', `0x450102030405
45 -- Bytes (Length: 5)
  0102030405\n`],
  ['streaming', '"streaming"', `0x6973747265616d696e67
69 -- UTF8 (Length: 9): "streaming"
  73747265616d696e
  67\n`],
  [[1, [2, 3], [4, 5]], '[1, [2, 3], [4, 5]]', `0x8301820203820405
83     -- Array (Length: 3 items)
  01   --   [0] Unsigned: 1
  82   --   [1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
  82   --   [2] Array (Length: 2 items)
    04 --     [0] Unsigned: 4
    05 --     [1] Unsigned: 5\n`],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24_0, 25_0]', `0x98190102030405060708090a0b0c0d0e0f101112131415161718181819
98 19   -- Array (Length: 25 items)
  01    --   [0] Unsigned: 1
  02    --   [1] Unsigned: 2
  03    --   [2] Unsigned: 3
  04    --   [3] Unsigned: 4
  05    --   [4] Unsigned: 5
  06    --   [5] Unsigned: 6
  07    --   [6] Unsigned: 7
  08    --   [7] Unsigned: 8
  09    --   [8] Unsigned: 9
  0a    --   [9] Unsigned: 10
  0b    --   [10] Unsigned: 11
  0c    --   [11] Unsigned: 12
  0d    --   [12] Unsigned: 13
  0e    --   [13] Unsigned: 14
  0f    --   [14] Unsigned: 15
  10    --   [15] Unsigned: 16
  11    --   [16] Unsigned: 17
  12    --   [17] Unsigned: 18
  13    --   [18] Unsigned: 19
  14    --   [19] Unsigned: 20
  15    --   [20] Unsigned: 21
  16    --   [21] Unsigned: 22
  17    --   [22] Unsigned: 23
  18 18 --   [23] Unsigned: 24
  18 19 --   [24] Unsigned: 25\n`],
  [{a: 1, b: [2, 3]}, '{"a": 1, "b": [2, 3]}', `0xa26161016162820203
a2     -- Map (Length: 2 pairs)
  61   --   [key 0] UTF8 (Length: 1): "a"
    61
  01   --   [val 0] Unsigned: 1
  61   --   [key 1] UTF8 (Length: 1): "b"
    62
  82   --   [val 1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3\n`],
  [['a', {b: 'c'}], '["a", {"b": "c"}]', `0x826161a161626163
82     -- Array (Length: 2 items)
  61   --   [0] UTF8 (Length: 1): "a"
    61
  a1   --   [1] Map (Length: 1 pair)
    61 --     [key 0] UTF8 (Length: 1): "b"
      62
    61 --     [val 0] UTF8 (Length: 1): "c"
      63\n`],

  [NaN, 'NaN_1', `0xf97e00
f9 7e00 -- Float: NaN\n`],

  // Ints
  [0xff, '255_0', `0x18ff
18 ff -- Unsigned: 255\n`],
  [256, '256_1', `0x190100
19 0100 -- Unsigned: 256\n`],
  [65535, '65535_1', `0x19ffff
19 ffff -- Unsigned: 65535\n`],
  [65536, '65536_2', `0x1a00010000
1a 00010000 -- Unsigned: 65536\n`],
  [4294967295, '4294967295_2', `0x1affffffff
1a ffffffff -- Unsigned: 4294967295\n`],
  [8589934591, '8589934591_3', `0x1b00000001ffffffff
1b 00000001ffffffff -- Unsigned: 8589934591\n`],
  [9007199254740991, '9007199254740991_3', `0x1b001fffffffffffff
1b 001fffffffffffff -- Unsigned: 9007199254740991\n`],
  [9007199254740992, '9007199254740992_2', `0xfa5a000000
fa 5a000000 -- Float: 9007199254740992\n`],
  [-9223372036854776000, '-9223372036854776000_2', `0xfadf000000
fa df000000 -- Float: -9223372036854776000\n`],
  [-2147483648, '-2147483648_2', `0x3a7fffffff
3a 7fffffff -- Negative: -2147483648\n`],

  [new Date(0), '1(0)', `0xc100
c1   -- Tag #1
  00 --   Unsigned: 0\n`],
  [new Uint8Array(0), 'h\'\'', `0x40
40 -- Bytes (Length: 0)\n`],
  [new Uint8Array([0, 1, 2, 3, 4]), 'h\'0001020304\'', `0x450001020304
45 -- Bytes (Length: 5)
  0001020304\n`],
  [new Simple(0xff), 'simple(255)_0', `0xf8ff
f8 ff -- Simple: 255\n`],
  [/a/, '21066_1(["a", ""])', `0xd9524a82616160
d9 524a -- Tag #21066
  82    --   Array (Length: 2 items)
    61  --     [0] UTF8 (Length: 1): "a"
      61
    60  --     [1] UTF8 (Length: 0): ""\n`],
  [/a/gu, '21066_1(["a", "gu"])', `0xd9524a826161626775
d9 524a -- Tag #21066
  82    --   Array (Length: 2 items)
    61  --     [0] UTF8 (Length: 1): "a"
      61
    62  --     [1] UTF8 (Length: 2): "gu"
      6775\n`],
  [new Map([[1, 2]]), '{1: 2}', `0xa10102
a1   -- Map (Length: 1 pair)
  01 --   [key 0] Unsigned: 1
  02 --   [val 0] Unsigned: 2\n`],
  [new Map([[{b: 1}, {b: 1}]]), '{{"b": 1}: {"b": 1}}', `0xa1a1616201a1616201
a1     -- Map (Length: 1 pair)
  a1   --   [key 0] Map (Length: 1 pair)
    61 --     [key 0] UTF8 (Length: 1): "b"
      62
    01 --     [val 0] Unsigned: 1
  a1   --   [val 0] Map (Length: 1 pair)
    61 --     [key 0] UTF8 (Length: 1): "b"
      62
    01 --     [val 0] Unsigned: 1\n`],
  [new Map([[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10'], [11, '11'], [12, '12'], [13, '13'], [14, '14'], [15, '15'], [16, '16'], [17, '17'], [18, '18'], [19, '19'], [20, '20'], [21, '21'], [22, '22'], [23, '23'], [24, '24']]), '{0: "0", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12", 13: "13", 14: "14", 15: "15", 16: "16", 17: "17", 18: "18", 19: "19", 20: "20", 21: "21", 22: "22", 23: "23", 24_0: "24"}', `0xb8190061300161310261320361330461340561350661360761370861380961390a6231300b6231310c6231320d6231330e6231340f62313510623136116231371262313813623139146232301562323116623232176232331818623234
b8 19   -- Map (Length: 25 pairs)
  00    --   [key 0] Unsigned: 0
  61    --   [val 0] UTF8 (Length: 1): "0"
    30
  01    --   [key 1] Unsigned: 1
  61    --   [val 1] UTF8 (Length: 1): "1"
    31
  02    --   [key 2] Unsigned: 2
  61    --   [val 2] UTF8 (Length: 1): "2"
    32
  03    --   [key 3] Unsigned: 3
  61    --   [val 3] UTF8 (Length: 1): "3"
    33
  04    --   [key 4] Unsigned: 4
  61    --   [val 4] UTF8 (Length: 1): "4"
    34
  05    --   [key 5] Unsigned: 5
  61    --   [val 5] UTF8 (Length: 1): "5"
    35
  06    --   [key 6] Unsigned: 6
  61    --   [val 6] UTF8 (Length: 1): "6"
    36
  07    --   [key 7] Unsigned: 7
  61    --   [val 7] UTF8 (Length: 1): "7"
    37
  08    --   [key 8] Unsigned: 8
  61    --   [val 8] UTF8 (Length: 1): "8"
    38
  09    --   [key 9] Unsigned: 9
  61    --   [val 9] UTF8 (Length: 1): "9"
    39
  0a    --   [key 10] Unsigned: 10
  62    --   [val 10] UTF8 (Length: 2): "10"
    3130
  0b    --   [key 11] Unsigned: 11
  62    --   [val 11] UTF8 (Length: 2): "11"
    3131
  0c    --   [key 12] Unsigned: 12
  62    --   [val 12] UTF8 (Length: 2): "12"
    3132
  0d    --   [key 13] Unsigned: 13
  62    --   [val 13] UTF8 (Length: 2): "13"
    3133
  0e    --   [key 14] Unsigned: 14
  62    --   [val 14] UTF8 (Length: 2): "14"
    3134
  0f    --   [key 15] Unsigned: 15
  62    --   [val 15] UTF8 (Length: 2): "15"
    3135
  10    --   [key 16] Unsigned: 16
  62    --   [val 16] UTF8 (Length: 2): "16"
    3136
  11    --   [key 17] Unsigned: 17
  62    --   [val 17] UTF8 (Length: 2): "17"
    3137
  12    --   [key 18] Unsigned: 18
  62    --   [val 18] UTF8 (Length: 2): "18"
    3138
  13    --   [key 19] Unsigned: 19
  62    --   [val 19] UTF8 (Length: 2): "19"
    3139
  14    --   [key 20] Unsigned: 20
  62    --   [val 20] UTF8 (Length: 2): "20"
    3230
  15    --   [key 21] Unsigned: 21
  62    --   [val 21] UTF8 (Length: 2): "21"
    3231
  16    --   [key 22] Unsigned: 22
  62    --   [val 22] UTF8 (Length: 2): "22"
    3232
  17    --   [key 23] Unsigned: 23
  62    --   [val 23] UTF8 (Length: 2): "23"
    3233
  18 18 --   [key 24] Unsigned: 24
  62    --   [val 24] UTF8 (Length: 2): "24"
    3234\n`],
  [{['__proto__']: 0}, '{"__proto__": 0}', `0xa1695f5f70726f746f5f5f00
a1   -- Map (Length: 1 pair)
  69 --   [key 0] UTF8 (Length: 9): "__proto__"
    5f5f70726f746f5f
    5f
  00 --   [val 0] Unsigned: 0\n`],
  [new Tag(256, 1), '256_1(1)', `0xd9010001
d9 0100 -- Tag #256
  01    --   Unsigned: 1\n`],
  [new Uint8Array([1, 2, 3]), 'h\'010203\'', `0x43010203
43 -- Bytes (Length: 3)
  010203\n`],
  [new Uint8ClampedArray([1, 2, 3]), '68_0(h\'010203\')', `0xd84443010203
d8 44 -- Tag #68
  43  --   Bytes (Length: 3)
    010203\n`],
  [new Set([1, 2]), '258_1([1, 2])', `0xd90102820102
d9 0102 -- Tag #258
  82    --   Array (Length: 2 items)
    01  --     [0] Unsigned: 1
    02  --     [1] Unsigned: 2\n`],
  [new Int8Array([-1, 0, 1, -128, 127]), '72_0(h\'ff0001807f\')', `0xd84845ff0001807f
d8 48 -- Tag #72
  45  --   Bytes (Length: 5)
    ff0001807f\n`],
  [new Map([[[], []], [[0], []]]), '{[]: [], [0]: []}', `0xa28080810080
a2     -- Map (Length: 2 pairs)
  80   --   [key 0] Array (Length: 0 items)
  80   --   [val 0] Array (Length: 0 items)
  81   --   [key 1] Array (Length: 1 item)
    00 --     [0] Unsigned: 0
  80   --   [val 1] Array (Length: 0 items)\n`],
];

export const goodEndian = [
  // Obj, little, big
  [new Uint16Array([1, 2, 3]),
    '0xd84546010002000300',
    '0xd84146000100020003'],
  [new Uint32Array([1, 2, 3]),
    '0xd8464c010000000200000003000000',
    '0xd8424c000000010000000200000003'],
  [new BigUint64Array([1n, 2n, 3n]),
    '0xd8475818010000000000000002000000000000000300000000000000',
    '0xd8435818000000000000000100000000000000020000000000000003'],
  [new Int16Array([1, 2, 3]),
    '0xd84d46010002000300',
    '0xd84946000100020003'],
  [new Int32Array([1, 2, 3]),
    '0xd84e4c010000000200000003000000',
    '0xd84a4c000000010000000200000003'],
  [new BigInt64Array([1n, 2n, 3n]),
    '0xd84f5818010000000000000002000000000000000300000000000000',
    '0xd84b5818000000000000000100000000000000020000000000000003'],

  [new Float32Array([1.1, 1.2, 1.3]),
    '0xd8554ccdcc8c3f9a99993f6666a63f',
    '0xd8514c3f8ccccd3f99999a3fa66666'],
  [new Float64Array([1.1, 1.2, 1.3]),
    '0xd85658189a9999999999f13f333333333333f33fcdccccccccccf43f',
    '0xd85258183ff199999999999a3ff33333333333333ff4cccccccccccd'],
];

export const goodBoxed = [
  [box(12, hexToU8('f94a00')),
    '12_1',
    '0xf94a00'],
  [box(12, hexToU8('fa41400000')),
    '12_2',
    '0xfa41400000'],
  [box(12, hexToU8('fb4028000000000000')),
    '12_3',
    '0xfb4028000000000000'],
  [box(-12, hexToU8('2b')),
    '-12',
    '0x2b'],
  [box(-12, hexToU8('380b')),
    '-12_0',
    '0x380b'],
  [box(-12, hexToU8('39000b')),
    '-12_1',
    '0x39000b'],
  [box(-12, hexToU8('3a0000000b')),
    '-12_2',
    '0x3a0000000b'],
  [box(-12, hexToU8('3b000000000000000b')),
    '-12_3',
    '0x3b000000000000000b'],
  [box(2n, hexToU8('c243000002')), "2(h'000002')", '0xc243000002'],
  [box(-2n, hexToU8('c343000001')), "3(h'000001')", '0xc343000001'],
  [box(2n, hexToU8('c24400000002')), "2(h'00000002')", '0xc24400000002'],
  [box(-2n, hexToU8('c34400000001')), "3(h'00000001')", '0xc34400000001'],
  [box(16n, hexToU8('c24400000010')), "2(h'00000010')", '0xc24400000010'],
  [box(-17n, hexToU8('c34400000010')), "3(h'00000010')", '0xc34400000010'],
  [[box('streaming', hexToU8('7f657374726561646d696e67ff'))], '[(_ "strea", "ming")]', '0x817f657374726561646d696e67ff'],
];

export const badBoxed = [
];

export const decodeGood = [
  [1.5, '1.5_1', `0xf93e00
f9 3e00 -- Float: 1.5\n`],
  [65504, '65504_1', `0xf97bff
f9 7bff -- Float: 65504\n`],
  [new Tag(23, hexToU8('01020304')).decode(), '23(h\'01020304\')', `0xd74401020304
d7   -- Tag #23
  44 --   Bytes (Length: 4)
    01020304\n`],
  [new Tag(24, hexToU8('6449455446')).decode(), '24_0(h\'6449455446\')', `0xd818456449455446
d8 18 -- Tag #24
  45  --   Bytes (Length: 5)
    6449455446\n`], // TODO: unfurl tag 24
  [0, '0_1', `0xf90000
f9 0000 -- Float: 0\n`],
  [-0, '-0_1', `0xf98000
f9 8000 -- Float: -0\n`],
  [1, '1_1', `0xf93c00
f9 3c00 -- Float: 1\n`],
  [100000, '100000_2', `0xfa47c35000
fa 47c35000 -- Float: 100000\n`],
  [5.960464477539063e-8, '5.960464477539063e-8_1', `0xf90001
f9 0001 -- Float: 5.960464477539063e-8\n`],
  [9223372036854775807n, '9223372036854775807_3', `0x1b7fffffffffffffff
1b 7fffffffffffffff -- Unsigned: 9223372036854775807n\n`],
  [-9223372036854775808n, '-9223372036854775808_3', `0x3b7fffffffffffffff
3b 7fffffffffffffff -- Negative: -9223372036854775808n\n`],
  [0.00006103515625, '0.00006103515625_1', `0xf90400
f9 0400 -- Float: 0.00006103515625\n`],
  [-4, '-4_1', `0xf9c400
f9 c400 -- Float: -4\n`],
  [Infinity, 'Infinity_2', `0xfa7f800000
fa 7f800000 -- Float: Infinity\n`],
  [-Infinity, '-Infinity_2', `0xfaff800000
fa ff800000 -- Float: -Infinity\n`],
  [Infinity, 'Infinity_3', `0xfb7ff0000000000000
fb 7ff0000000000000 -- Float: Infinity\n`],
  [-Infinity, '-Infinity_3', `0xfbfff0000000000000
fb fff0000000000000 -- Float: -Infinity\n`],
  [NaN, 'NaN_2', `0xfa7fc00000
fa 7fc00000 -- Float: NaN\n`],
  [NaN, 'NaN_3', `0xfb7ff8000000000000
fb 7ff8000000000000 -- Float: NaN\n`],
  [NaN, 'NaN_3', `0xfb7ff0000000000001
fb 7ff0000000000001 -- Float: NaN\n`],
  [-9007199254740992, '-9007199254740992_3', `0x3b001fffffffffffff
3b 001fffffffffffff -- Negative: -9007199254740992\n`],
  [new Date('2013-03-21T20:04:00Z'), '0("2013-03-21T20:04:00Z")', `0xc074323031332d30332d32315432303a30343a30305a
c0   -- Tag #0
  74 --   UTF8 (Length: 20): "2013-03-21T20:04:00Z"
    323031332d30332d
    32315432303a3034
    3a30305a\n`],
  [new Date(1363896240500), '1(1363896240.5_3)', `0xc1fb41d452d9ec200000
c1                    -- Tag #1
  fb 41d452d9ec200000 --   Float: 1363896240.5\n`],
  [hexToU8(''), "_''", `0x5fff
5f   -- Bytes (Length: Indefinite)
  ff --   [0] BREAK\n`],
  [hexToU8(''), "(_ h'')", `0x5f40ff
5f   -- Bytes (Length: Indefinite)
  40 --   [0] Bytes (Length: 0)
  ff --   [1] BREAK\n`],
  ['', '_""', `0x7fff
7f   -- UTF8 (Length: Indefinite)
  ff --   [0] BREAK\n`],
  ['', '(_ "")', `0x7f60ff
7f   -- UTF8 (Length: Indefinite)
  60 --   [0] UTF8 (Length: 0): ""
  ff --   [1] BREAK\n`],
  [hexToU8('0102030405'), '(_ h\'0102\', h\'030405\')', `0x5f42010243030405ff
5f   -- Bytes (Length: Indefinite)
  42 --   [0] Bytes (Length: 2)
    0102
  43 --   [1] Bytes (Length: 3)
    030405
  ff --   [2] BREAK\n`],
  ['streaming', '(_ "strea", "ming")', `0x7f657374726561646d696e67ff
7f   -- UTF8 (Length: Indefinite)
  65 --   [0] UTF8 (Length: 5): "strea"
    7374726561
  64 --   [1] UTF8 (Length: 4): "ming"
    6d696e67
  ff --   [2] BREAK\n`],
  [[], '[_ ]', `0x9fff
9f   -- Array (Length: Indefinite)
  ff --   [0] BREAK\n`],
  [[1, [2, 3], [4, 5]], '[_ 1, [2, 3], [_ 4, 5]]', `0x9f018202039f0405ffff
9f     -- Array (Length: Indefinite)
  01   --   [0] Unsigned: 1
  82   --   [1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
  9f   --   [2] Array (Length: Indefinite)
    04 --     [0] Unsigned: 4
    05 --     [1] Unsigned: 5
    ff --     [2] BREAK
  ff   --   [3] BREAK\n`],
  [[1, [2, 3], [4, 5]], '[_ 1, [2, 3], [4, 5]]', `0x9f01820203820405ff
9f     -- Array (Length: Indefinite)
  01   --   [0] Unsigned: 1
  82   --   [1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
  82   --   [2] Array (Length: 2 items)
    04 --     [0] Unsigned: 4
    05 --     [1] Unsigned: 5
  ff   --   [3] BREAK\n`],
  [[1, [2, 3], [4, 5]], '[1, [2, 3], [_ 4, 5]]', `0x83018202039f0405ff
83     -- Array (Length: 3 items)
  01   --   [0] Unsigned: 1
  82   --   [1] Array (Length: 2 items)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
  9f   --   [2] Array (Length: Indefinite)
    04 --     [0] Unsigned: 4
    05 --     [1] Unsigned: 5
    ff --     [2] BREAK\n`],
  [[1, [2, 3], [4, 5]], '[1, [_ 2, 3], [4, 5]]', `0x83019f0203ff820405
83     -- Array (Length: 3 items)
  01   --   [0] Unsigned: 1
  9f   --   [1] Array (Length: Indefinite)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
    ff --     [2] BREAK
  82   --   [2] Array (Length: 2 items)
    04 --     [0] Unsigned: 4
    05 --     [1] Unsigned: 5\n`],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], '[_ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24_0, 25_0]', `0x9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff
9f      -- Array (Length: Indefinite)
  01    --   [0] Unsigned: 1
  02    --   [1] Unsigned: 2
  03    --   [2] Unsigned: 3
  04    --   [3] Unsigned: 4
  05    --   [4] Unsigned: 5
  06    --   [5] Unsigned: 6
  07    --   [6] Unsigned: 7
  08    --   [7] Unsigned: 8
  09    --   [8] Unsigned: 9
  0a    --   [9] Unsigned: 10
  0b    --   [10] Unsigned: 11
  0c    --   [11] Unsigned: 12
  0d    --   [12] Unsigned: 13
  0e    --   [13] Unsigned: 14
  0f    --   [14] Unsigned: 15
  10    --   [15] Unsigned: 16
  11    --   [16] Unsigned: 17
  12    --   [17] Unsigned: 18
  13    --   [18] Unsigned: 19
  14    --   [19] Unsigned: 20
  15    --   [20] Unsigned: 21
  16    --   [21] Unsigned: 22
  17    --   [22] Unsigned: 23
  18 18 --   [23] Unsigned: 24
  18 19 --   [24] Unsigned: 25
  ff    --   [25] BREAK\n`],
  [{a: 1, b: [2, 3]}, '{_ "a": 1, "b": [_ 2, 3]}', `0xbf61610161629f0203ffff
bf     -- Map (Length: Indefinite)
  61   --   [key 0] UTF8 (Length: 1): "a"
    61
  01   --   [val 0] Unsigned: 1
  61   --   [key 1] UTF8 (Length: 1): "b"
    62
  9f   --   [val 1] Array (Length: Indefinite)
    02 --     [0] Unsigned: 2
    03 --     [1] Unsigned: 3
    ff --     [2] BREAK
  ff   --   [key 2] BREAK\n`],
  [['a', {b: 'c'}], '["a", {_ "b": "c"}]', `0x826161bf61626163ff
82     -- Array (Length: 2 items)
  61   --   [0] UTF8 (Length: 1): "a"
    61
  bf   --   [1] Map (Length: Indefinite)
    61 --     [key 0] UTF8 (Length: 1): "b"
      62
    61 --     [val 0] UTF8 (Length: 1): "c"
      63
    ff --     [key 1] BREAK\n`],
  [new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x99]), '64_0((_ h\'aabbccdd\', h\'eeff99\'))', `0xd8405f44aabbccdd43eeff99ff
d8 40  -- Tag #64
  5f   --   Bytes (Length: Indefinite)
    44 --     [0] Bytes (Length: 4)
      aabbccdd
    43 --     [1] Bytes (Length: 3)
      eeff99
    ff --     [2] BREAK\n`],
  [/a/, '35_0("a")', `0xd8236161
d8 23 -- Tag #35
  61  --   UTF8 (Length: 1): "a"
    61\n`],
  [/^(?:[^\n\r])$/u, '21065_1(".")', `0xd95249612e
d9 5249 -- Tag #21065
  61    --   UTF8 (Length: 1): "."
    2e\n`],
  [/^(?:[.])$/u, '21065_1("[.]")', `0xd95249635b2e5d
d9 5249 -- Tag #21065
  63    --   UTF8 (Length: 3): "[.]"
    5b2e5d\n`],
  [/^(?:\.)$/u, '21065_1("\\\\.")', `0xd95249625c2e
d9 5249 -- Tag #21065
  62    --   UTF8 (Length: 2): "\\\\."
    5c2e\n`],
  [/^(?:[asd.])$/u, '21065_1("[asd.]")', `0xd95249665b6173642e5d
d9 5249 -- Tag #21065
  66    --   UTF8 (Length: 6): "[asd.]"
    5b6173642e5d\n`],
  [/^(?:[asd.f][^\n\r])$/u, '21065_1("[asd.f].")', `0xd95249685b6173642e665d2e
d9 5249 -- Tag #21065
  68    --   UTF8 (Length: 8): "[asd.f]."
    5b6173642e665d2e\n`],
  [/^(?:[as\].])$/u, '21065_1("[as\\\\].]")', `0xd95249675b61735c5d2e5d
d9 5249 -- Tag #21065
  67    --   UTF8 (Length: 7): "[as\\\\].]"
    5b61735c5d2e5d\n`],
  [/^(?:\[asdf)$/u, '21065_1("\\\\[asdf")', `0xd95249665c5b61736466
d9 5249 -- Tag #21065
  66    --   UTF8 (Length: 6): "\\\\[asdf"
    5c5b61736466\n`],
];

export const encodeGood = [
  [new Map([[[], []], [[], []]]), '{[]: [], []: []}', '0xa280808080'],

  /* eslint-disable no-new-wrappers */
  [new String('foo'), 'boxed', '0x63666f6f'],
  [new Boolean(true), 'boxed', '0xf5'],
  [new Number(12), 'boxed', '0x0c'],
  /* eslint-enable no-new-wrappers */
];

export const encodeBadDCBOR = [
  new Map([[[], 0], [[], 1]]),
  new Simple(0),
  undefined,
];

export const collapseBigIntegers = [
  [0n, '0xc24100', '0x00'],
  [1n, '0xc24101', '0x01'],
  [-1n, '0xc34100', '0x20'],
  [24n, '0xc24118', '0x1818'],
  [-25n, '0xc34118', '0x3818'],
  [0x01ffn, '0xc24201ff', '0x1901ff'],
  [-0x01ffn, '0xc34201fe', '0x3901fe'],
  [0x1ffffn, '0xc24301ffff', '0x1a0001ffff'],
  [-0x1ffffn, '0xc34301fffe', '0x3a0001fffe'],
  [0x1ffffffffn, '0xc24501ffffffff', '0x1b00000001ffffffff'],
  [-0x1ffffffffn, '0xc34501fffffffe', '0x3b00000001fffffffe'],
  [0xffffffffffffffffn, '0xc248ffffffffffffffff', '0x1bffffffffffffffff'],
  [-0x10000000000000000n, '0xc348ffffffffffffffff', '0x3bffffffffffffffff'],
];

export const decodeBad = [
  '0x18', // Missing the next byte for AI
  '0x1c', // Invalid AI
  '0x1d', // Invalid AI
  '0x1e', // Invalid AI
  '0x44010203', // Only 3 bytes, not 4, bytestring
  '0x5f', // Indeterminate bytestring with nothing
  '0x5f01ff', // Indeterminite bytestring includes a non-string chunk
  '0x64494554', // Only 3 bytes, not 4, utf8
  '0x7432303133', // String length 20 only has 4 bytes
  '0x7f01ff', // Indeterminite string includes a non-string chunk
  '0x7f657374726561646d696e', // No BREAK
  '0x81', // No items in array, expected 1
  '0x8181818181', // Nested arrays with no end
  '0x81FE', // Array containaing invalid
  '0x8201', // 1 item in array, expected 2
  '0x9f', // Indeterminate array without end
  '0x9f01', // Indeterminate array without end
  '0x9fFEff', // Streamed array containing invalid
  '0xa16161', // Map without value
  '0xa1FE01', // Map containing invalid
  '0xa20102', // Only 1 pair, not 2, map
  '0xa3', // No pairs
  '0xbf', // Indeterminate map without end
  '0xbf000103ff', // Streaming map with odd number of items
  '0xbf6161', // Indeterminate map without end
  '0xbf616101', // Indeterminate map without end
  '0xbfFE01ff', // Streamed map containing invalid
  '0xfc', // Reserved AI
  '0xfd', // Reserved AI
  '0xfe', // Reserved AI
  '0x62c0ae', // Invalid utf8
  '0xff', // Unexpected BREAK
  '0x81ff', // Unexpected BREAK
];

export const decodeBadTags = [
  '0xd9524a83616162677500', // RegExp array too long
  '0xd9524a80', // RegExp array too short
  '0xd9524a820000', // RegExp invalid flags
  '0xd9524900', // I-regex not string
  '0xc1a1616100', // Time with bad obj
];

export const decodeBadDcbor = [
  '0xa2616101616102', // {a: 1, a: 2}
  '0xa200010002',
  '0xa2f5f4f5f6',
  '0xa280008001',
  '0xa20a000a001',
  '0xa2810000810001',
  '0xa2616200616101', // {b: 1, a: 2}
  '0xf98000', // -0
  '0xfa7f800000', // Long infinities
  '0xfaff800000',
  '0xfb7ff0000000000000',
  '0xfbfff0000000000000',
  '0xfa7fc00000', // Long NaNs
  '0xfb7ff8000000000000',
  '0xf97e01', // Signalling NaN
  '0xfb7ff8000000000001',
  '0x3b8000000000000000', // 65bit neg
  // Should be smaller
  '0x1817',
  '0x190017',
  '0x1a00000017',
  '0x1b0000000000000017',
  '0xfa3fa00000', // 1.25_2
  '0xfb3ff4000000000000', // 1.25_3
  '0xfb402400000000000000', // 10
  '0xc2420002',
  '0xc24102',
  // Should be int
  '0xf94900',
  '0xfa50000000',
  // No streaming
  '0x5fff',
  '0x7fff',
  '0x9fff',
  '0xbfff',
  // Simple
  '0xe0',
  // Undefined
  '0xf7',
];

const HEX = /^0x(?<hex>[0-9a-f]+)/im;

/**
 * Hex decode a string, or the third element of an array of strings.
 *
 * @param {string|string[]} c Don't remember why.
 * @returns {Buffer} Converted to buffer.
 * @private
 */
export function toBuffer(c) {
  if (Array.isArray(c)) {
    // eslint-disable-next-line prefer-destructuring
    c = c[2];
  }
  const match = c.match(HEX);
  return hexToU8(match.groups.hex);
}

/**
 * Strip off the leading 0x from a string, or the third element of an array of
 * strings.
 *
 * @param {string|string[]} [c] Don't remember why.
 * @returns {string} Stripped string.
 */
export function toString(c) {
  if (Array.isArray(c)) {
    // eslint-disable-next-line prefer-destructuring
    c = c[2];
  }
  if (c == null) {
    return c;
  }
  const match = c.match(HEX);
  return match.groups.hex;
}

// Here to avoid ava's odd injection of Map into the namespace of the tests
export const goodMap = new Map([
  ['0', 'foo'],
  [0, 'bar'],
  [{}, 'empty obj'],
  [[], 'empty array'],
  [null, 'null'],
  [[1], 'array'],
  [{1: 2}, 'obj'],
  ['a', 1],
  ['aaa', 3],
  ['aa', 2],
  ['bb', 2],
  ['b', 1],
  ['bbb', 3],
]);

export const canonNums = [
  [-1.25, 'f9bd00'],
  [1.5, 'f93e00'],
  [10.1, 'fb4024333333333333'],
  [5.960464477539063e-8, 'f90001'],
  [3.4028234663852886e+38, 'fa7f7fffff'],
  [0.00006103515625, 'f90400'],
  [0.2498779296875, 'f933ff'],
  [0.0000000298023223876953125, 'fa33000000'],
  [4.1727979294137185e-8, 'fa33333866'],
  [0.000007636845111846924, 'fa37002000'],

  [Infinity, 'f97c00'],
  [-Infinity, 'f9fc00'],
  [NaN, 'f97e00'],
  [0, '00'],
  [-0, 'f98000'],
];
