import {Simple} from '../lib/simple.js';
import {Tag} from '../lib/tag.js';
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

// [Decoded, Diagnostic, Commented]
export const good = [
  [0, '0', `
  00                -- 0
0x00`],
  [1, '1', `
  01                -- 1
0x01`],
  [10, '10', `
  0a                -- 10
0x0a`],
  [23, '23', `
  17                -- 23
0x17`],
  [24, '24_0', `
  18                -- Positive number, next 1 byte
    18              -- 24
0x1818`],
  [25, '25_0', `
  18                -- Positive number, next 1 byte
    19              -- 25
0x1819`],
  [100, '100_0', `
  18                -- Positive number, next 1 byte
    64              -- 100
0x1864`],
  [1000, '1000_1', `
  19                -- Positive number, next 2 bytes
    03e8            -- 1000
0x1903e8`],
  [1000000, '1000000_2', `
  1a                -- Positive number, next 4 bytes
    000f4240        -- 1000000
0x1a000f4240`],
  [1000000000000, '1000000000000_3', `
  1b                -- Positive number, next 8 bytes
    000000e8d4a51000 -- 1000000000000
0x1b000000e8d4a51000`],

  // JS rounding: 18446744073709552000
  // [18446744073709551615, '0x1bffffffffffffffff'],
  [Number.MAX_SAFE_INTEGER, '9007199254740991_3', `
  1b                -- Positive number, next 8 bytes
    001fffffffffffff -- 9007199254740991
0x1b001fffffffffffff`],
  [Number.MAX_VALUE, '1.7976931348623157e+308_3', `
  fb                -- Float, next 8 bytes
    7fefffffffffffff -- 1.7976931348623157e+308
0xfb7fefffffffffffff`],
  [Number.MIN_SAFE_INTEGER, '-9007199254740991_3', `
  3b                -- Negative number, next 8 bytes
    001ffffffffffffe -- -9007199254740991
0x3b001ffffffffffffe`],
  [Number.MIN_SAFE_INTEGER - 1, '-9007199254740992_2', `
  fa                -- Float, next 4 bytes
    da000000        -- -9007199254740992
0xfada000000`],
  [Number.MIN_SAFE_INTEGER - 2, '-9007199254740992_2', `
  fa                -- Float, next 4 bytes
    da000000        -- -9007199254740992
0xfada000000`],
  [Number.MIN_VALUE, '5e-324_3', `
  fb                -- Float, next 8 bytes
    0000000000000001 -- 5e-324
0xfb0000000000000001`],
  [-0x1c0000000000000001n, '3(h\'1c0000000000000000\')', `
  c3                -- Tag #3
    49              -- Bytes, length: 9
      1c0000000000000000 -- 1c0000000000000000
0xc3491c0000000000000000`],
  [18446744073709551616n, '2(h\'010000000000000000\')', `
  c2                -- Tag #2
    49              -- Bytes, length: 9
      010000000000000000 -- 010000000000000000
0xc249010000000000000000`],
  [-18446744073709551617n, '3(h\'010000000000000000\')', `
  c3                -- Tag #3
    49              -- Bytes, length: 9
      010000000000000000 -- 010000000000000000
0xc349010000000000000000`],
  [-1, '-1', `
  20                -- -1
0x20`],
  [-10, '-10', `
  29                -- -10
0x29`],
  [-100, '-100_0', `
  38                -- Negative number, next 1 byte
    63              -- -100
0x3863`],
  [-1000, '-1000_1', `
  39                -- Negative number, next 2 bytes
    03e7            -- -1000
0x3903e7`],
  [1.1, '1.1_3', `
  fb                -- Float, next 8 bytes
    3ff199999999999a -- 1.1
0xfb3ff199999999999a`],

  // Node-cbor doesn't do short floats without canonical, so this says
  // fa3fc00000
  [1.5, '1.5_1', `
  f9                -- Float, next 2 bytes
    3e00            -- 1.5
0xf93e00`],
  [3.4028234663852886e+38, '3.4028234663852886e+38_2', `
  fa                -- Float, next 4 bytes
    7f7fffff        -- 3.4028234663852886e+38
0xfa7f7fffff`],
  [1e+300, '1e+300_3', `
  fb                -- Float, next 8 bytes
    7e37e43c8800759c -- 1e+300
0xfb7e37e43c8800759c`],

  // Short now, so not fa33800000
  [5.960464477539063e-8, '5.960464477539063e-8_1', `
  f9                -- Float, next 2 bytes
    0001            -- 5.960464477539063e-8
0xf90001`],

  // Short now, so not fa38800000
  [0.00006103515625, '0.00006103515625_1', `
  f9                -- Float, next 2 bytes
    0400            -- 0.00006103515625
0xf90400`],
  [-4.1, '-4.1_3', `
  fb                -- Float, next 8 bytes
    c010666666666666 -- -4.1
0xfbc010666666666666`],

  [2.5, '2.5_1', '0xf94100'],
  [-0, '-0_1', `
  f9                -- Float, next 2 bytes
    8000            -- -0
0xf98000`],
  [0.00006103515625, '0.00006103515625_1', '0xf90400'],
  [1.1920928955078125e-7, '1.1920928955078125e-7_1', '0xf90002'], // De-norm
  [1.1478035721284577e-41, '1.1478035721284577e-41_2', '0xfa00001fff'], // Exp too small
  [3.4011621342146535e+38, '3.4011621342146535e+38_2', '0xfa7f7fe000'], // Exp too big
  [1.1944212019443512e-7, '1.1944212019443512e-7_2', '0xfa34004000'], // De-norm prec loss

  [Infinity, 'Infinity_1', `
  f9                -- Float, next 2 bytes
    7c00            -- Infinity
0xf97c00`],
  [NaN, 'NaN_1', `
  f9                -- Float, next 2 bytes
    7e00            -- NaN
0xf97e00`],
  [-Infinity, '-Infinity_1', `
  f9                -- Float, next 2 bytes
    fc00            -- -Infinity
0xf9fc00`],
  [false, 'false', `
  f4                -- false
0xf4`],
  [true, 'true', `
  f5                -- true
0xf5`],
  [null, 'null', `
  f6                -- null
0xf6`],
  [undefined, 'undefined', `
  f7                -- undefined
0xf7`],

  [new Simple(16), 'simple(16)', `
  f0                -- simple(16)
0xf0`],
  [new Simple(32), 'simple(32)_0', `
  f8                -- Simple value, next 1 byte
    20              -- simple(32)
0xf820`],
  [new Simple(255), 'simple(255)_0', `
  f8                -- Simple value, next 1 byte
    ff              -- simple(255)
0xf8ff`],
  [new Date(1363896240000), '1(1363896240_2)', `
  c1                -- Tag #1
    1a              -- Positive number, next 4 bytes
      514b67b0      -- 1363896240
0xc11a514b67b0`],

  [new URL('http://www.example.com'), '32("http://www.example.com/")', `
  d8                --  next 1 byte
    20              -- Tag #32
      77            -- String, length: 23
        687474703a2f2f7777772e6578616d706c652e636f6d2f -- "http://www.example.com/"
0xd82077687474703a2f2f7777772e6578616d706c652e636f6d2f`],
  [new Uint8Array([]), 'h\'\'', `
  40                -- Bytes, length: 0
0x40`],
  [hexToU8('01020304'), 'h\'01020304\'', `
  44                -- Bytes, length: 4
    01020304        -- 01020304
0x4401020304`],
  [hexToU8('000102030405060708090a0b0c0d0e0f101112131415161718'), 'h\'000102030405060708090a0b0c0d0e0f101112131415161718\'', `
  58                -- Bytes, length next 1 byte
    19              -- Bytes, length: 25
      000102030405060708090a0b0c0d0e0f101112131415161718 -- 000102030405060708090a0b0c0d0e0f101112131415161718
0x5819000102030405060708090a0b0c0d0e0f101112131415161718`],

  ['', '""', `
  60                -- String, length: 0
0x60`],
  ['a', '"a"', `
  61                -- String, length: 1
    61              -- "a"
0x6161`],
  ['IETF', '"IETF"', `
  64                -- String, length: 4
    49455446        -- "IETF"
0x6449455446`],
  ['\ufeffBOM', '"\ufeffBOM"', `
  66                -- String, length: 6
    efbbbf424f4d    -- "\ufeffBOM"
0x66efbbbf424f4d`],
  ['"\\', '"\\"\\\\"', `
  62                -- String, length: 2
    225c            -- "\\"\\\\"
0x62225c`],
  ['\u00fc', '"\u00fc"', `
  62                -- String, length: 2
    c3bc            -- "ü"
0x62c3bc`],
  ['\u6c34', '"\u6c34"', `
  63                -- String, length: 3
    e6b0b4          -- "水"
0x63e6b0b4`],
  ['\ud800\udd51', '"\ud800\udd51"', `
  64                -- String, length: 4
    f0908591        -- "𐅑"
0x64f0908591`],
  [[], '[]', `
  80                -- []
0x80`],
  [[1, 2, 3], '[1, 2, 3]', `
  83                -- Array, 3 items
    01              -- [0], 1
    02              -- [1], 2
    03              -- [2], 3
0x83010203`],
  [[1, [2, 3], [4, 5]], '[1, [2, 3], [4, 5]]', `
  83                -- Array, 3 items
    01              -- [0], 1
    82              -- [1], Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
    82              -- [2], Array, 2 items
      04            -- [0], 4
      05            -- [1], 5
0x8301820203820405`],

  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24_0, 25_0]', `
  98                -- Array, length next 1 byte
    19              -- Array, 25 items
      01            -- [0], 1
      02            -- [1], 2
      03            -- [2], 3
      04            -- [3], 4
      05            -- [4], 5
      06            -- [5], 6
      07            -- [6], 7
      08            -- [7], 8
      09            -- [8], 9
      0a            -- [9], 10
      0b            -- [10], 11
      0c            -- [11], 12
      0d            -- [12], 13
      0e            -- [13], 14
      0f            -- [14], 15
      10            -- [15], 16
      11            -- [16], 17
      12            -- [17], 18
      13            -- [18], 19
      14            -- [19], 20
      15            -- [20], 21
      16            -- [21], 22
      17            -- [22], 23
      18            -- Positive number, next 1 byte
        18          -- [23], 24
      18            -- Positive number, next 1 byte
        19          -- [24], 25
0x98190102030405060708090a0b0c0d0e0f101112131415161718181819`],
  [{}, '{}', `
  a0                -- {}
0xa0`],
  [{1: 2, 3: 4}, '{"1": 2, "3": 4}', `
  a2                -- Map, 2 pairs
    61              -- String, length: 1
      31            -- {Key:0}, "1"
    02              -- {Val:0}, 2
    61              -- String, length: 1
      33            -- {Key:1}, "3"
    04              -- {Val:1}, 4
0xa2613102613304`],
  [{a: 1, b: [2, 3]}, '{"a": 1, "b": [2, 3]}', `
  a2                -- Map, 2 pairs
    61              -- String, length: 1
      61            -- {Key:0}, "a"
    01              -- {Val:0}, 1
    61              -- String, length: 1
      62            -- {Key:1}, "b"
    82              -- {Val:1}, Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
0xa26161016162820203`],
  [['a', {b: 'c'}], '["a", {"b": "c"}]', `
  82                -- Array, 2 items
    61              -- String, length: 1
      61            -- [0], "a"
    a1              -- [1], Map, 1 pair
      61            -- String, length: 1
        62          -- {Key:0}, "b"
      61            -- String, length: 1
        63          -- {Val:0}, "c"
0x826161a161626163`],
  [{a: 'A', b: 'B', c: 'C', d: 'D', e: 'E'}, '{"a": "A", "b": "B", "c": "C", "d": "D", "e": "E"}', `
  a5                -- Map, 5 pairs
    61              -- String, length: 1
      61            -- {Key:0}, "a"
    61              -- String, length: 1
      41            -- {Val:0}, "A"
    61              -- String, length: 1
      62            -- {Key:1}, "b"
    61              -- String, length: 1
      42            -- {Val:1}, "B"
    61              -- String, length: 1
      63            -- {Key:2}, "c"
    61              -- String, length: 1
      43            -- {Val:2}, "C"
    61              -- String, length: 1
      64            -- {Key:3}, "d"
    61              -- String, length: 1
      44            -- {Val:3}, "D"
    61              -- String, length: 1
      65            -- {Key:4}, "e"
    61              -- String, length: 1
      45            -- {Val:4}, "E"
0xa56161614161626142616361436164614461656145`],
  [hexToU8('0102030405'), 'h\'0102030405\'', `
  45                -- Bytes, length: 5
    0102030405      -- 0102030405
0x450102030405`],
  ['streaming', '"streaming"', `
  69                -- String, length: 9
    73747265616d696e67 -- "streaming"
0x6973747265616d696e67`],
  [[1, [2, 3], [4, 5]], '[1, [2, 3], [4, 5]]', `
  83                -- Array, 3 items
    01              -- [0], 1
    82              -- [1], Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
    82              -- [2], Array, 2 items
      04            -- [0], 4
      05            -- [1], 5
0x8301820203820405`],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24_0, 25_0]', `
  98                -- Array, length next 1 byte
    19              -- Array, 25 items
      01            -- [0], 1
      02            -- [1], 2
      03            -- [2], 3
      04            -- [3], 4
      05            -- [4], 5
      06            -- [5], 6
      07            -- [6], 7
      08            -- [7], 8
      09            -- [8], 9
      0a            -- [9], 10
      0b            -- [10], 11
      0c            -- [11], 12
      0d            -- [12], 13
      0e            -- [13], 14
      0f            -- [14], 15
      10            -- [15], 16
      11            -- [16], 17
      12            -- [17], 18
      13            -- [18], 19
      14            -- [19], 20
      15            -- [20], 21
      16            -- [21], 22
      17            -- [22], 23
      18            -- Positive number, next 1 byte
        18          -- [23], 24
      18            -- Positive number, next 1 byte
        19          -- [24], 25
0x98190102030405060708090a0b0c0d0e0f101112131415161718181819`],
  [{a: 1, b: [2, 3]}, '{"a": 1, "b": [2, 3]}', `
  a2                -- Map, 2 pairs
    61              -- String, length: 1
      61            -- {Key:0}, "a"
    01              -- {Val:0}, 1
    61              -- String, length: 1
      62            -- {Key:1}, "b"
    82              -- {Val:1}, Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
0xa26161016162820203`],
  [['a', {b: 'c'}], '["a", {"b": "c"}]', `
  82                -- Array, 2 items
    61              -- String, length: 1
      61            -- [0], "a"
    a1              -- [1], Map, 1 pair
      61            -- String, length: 1
        62          -- {Key:0}, "b"
      61            -- String, length: 1
        63          -- {Val:0}, "c"
0x826161a161626163`],

  [NaN, 'NaN_1', `
  f9                -- Float, next 2 bytes
    7e00            -- NaN
0xf97e00`],

  // Ints
  [0xff, '255_0', `
  18                -- Positive number, next 1 byte
    ff              -- 255
0x18ff`],
  [256, '256_1', `
  19                -- Positive number, next 2 bytes
    0100            -- 256
0x190100`],
  [65535, '65535_1', `
  19                -- Positive number, next 2 bytes
    ffff            -- 65535
0x19ffff`],
  [65536, '65536_2', `
  1a                -- Positive number, next 4 bytes
    00010000        -- 65536
0x1a00010000`],
  [4294967295, '4294967295_2', `
  1a                -- Positive number, next 4 bytes
    ffffffff        -- 4294967295
0x1affffffff`],
  [8589934591, '8589934591_3', `
  1b                -- Positive number, next 8 bytes
    00000001ffffffff -- 8589934591
0x1b00000001ffffffff`],
  [9007199254740991, '9007199254740991_3', `
  1b                -- Positive number, next 8 bytes
    001fffffffffffff -- 9007199254740991
0x1b001fffffffffffff`],
  [9007199254740992, '9007199254740992_2', `
  fa                -- Float, next 4 bytes
    5a000000        -- 9007199254740992
0xfa5a000000`],
  [-9223372036854776000, '-9223372036854776000_2', `
  fa                -- Float, next 4 bytes
    df000000        -- -9223372036854776000
0xfadf000000`],
  [-2147483648, '-2147483648_2', `
  3a                -- Negative number, next 4 bytes
    7fffffff        -- -2147483648
0x3a7fffffff`],

  [new Date(0), '1(0)', `
  c1                -- Tag #1
    00              -- 0
0xc100`],
  [new Uint8Array(0), 'h\'\'', `
  40                -- Bytes, length: 0
0x40`],
  [new Uint8Array([0, 1, 2, 3, 4]), 'h\'0001020304\'', `
  45                -- Bytes, length: 5
    0001020304      -- 0001020304
0x450001020304`],
  [new Simple(0xff), 'simple(255)_0', `
  f8                -- Simple value, next 1 byte
    ff              -- simple(255)
0xf8ff`],
  [/a/, '279(["a", ""])', `
  d9                --  next 2 bytes
    0117            -- Tag #279
      82            -- Array, 2 items
        61          -- String, length: 1
          61        -- [0], "a"
        60          -- String, length: 0
0xd9011782616160`],
  [/a/gu, '279(["a", "gu"])', '0xd90117826161626775'],
  [new Map([[1, 2]]), '{1: 2}', `
  a1                -- Map, 1 pair
    01              -- {Key:0}, 1
    02              -- {Val:0}, 2
0xa10102`],
  [new Map([[{b: 1}, {b: 1}]]), '{{"b": 1}: {"b": 1}}', `
  a1                -- Map, 1 pair
    a1              -- {Key:0}, Map, 1 pair
      61            -- String, length: 1
        62          -- {Key:0}, "b"
      01            -- {Val:0}, 1
    a1              -- {Val:0}, Map, 1 pair
      61            -- String, length: 1
        62          -- {Key:0}, "b"
      01            -- {Val:0}, 1
0xa1a1616201a1616201`],
  [new Map([[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10'], [11, '11'], [12, '12'], [13, '13'], [14, '14'], [15, '15'], [16, '16'], [17, '17'], [18, '18'], [19, '19'], [20, '20'], [21, '21'], [22, '22'], [23, '23'], [24, '24']]), '{0: "0", 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "11", 12: "12", 13: "13", 14: "14", 15: "15", 16: "16", 17: "17", 18: "18", 19: "19", 20: "20", 21: "21", 22: "22", 23: "23", 24_0: "24"}', `
  b8                -- Map, count next 1 byte
    19              -- Map, 25 pairs
      00            -- {Key:0}, 0
      61            -- String, length: 1
        30          -- {Val:0}, "0"
      01            -- {Key:1}, 1
      61            -- String, length: 1
        31          -- {Val:1}, "1"
      02            -- {Key:2}, 2
      61            -- String, length: 1
        32          -- {Val:2}, "2"
      03            -- {Key:3}, 3
      61            -- String, length: 1
        33          -- {Val:3}, "3"
      04            -- {Key:4}, 4
      61            -- String, length: 1
        34          -- {Val:4}, "4"
      05            -- {Key:5}, 5
      61            -- String, length: 1
        35          -- {Val:5}, "5"
      06            -- {Key:6}, 6
      61            -- String, length: 1
        36          -- {Val:6}, "6"
      07            -- {Key:7}, 7
      61            -- String, length: 1
        37          -- {Val:7}, "7"
      08            -- {Key:8}, 8
      61            -- String, length: 1
        38          -- {Val:8}, "8"
      09            -- {Key:9}, 9
      61            -- String, length: 1
        39          -- {Val:9}, "9"
      0a            -- {Key:10}, 10
      62            -- String, length: 2
        3130        -- {Val:10}, "10"
      0b            -- {Key:11}, 11
      62            -- String, length: 2
        3131        -- {Val:11}, "11"
      0c            -- {Key:12}, 12
      62            -- String, length: 2
        3132        -- {Val:12}, "12"
      0d            -- {Key:13}, 13
      62            -- String, length: 2
        3133        -- {Val:13}, "13"
      0e            -- {Key:14}, 14
      62            -- String, length: 2
        3134        -- {Val:14}, "14"
      0f            -- {Key:15}, 15
      62            -- String, length: 2
        3135        -- {Val:15}, "15"
      10            -- {Key:16}, 16
      62            -- String, length: 2
        3136        -- {Val:16}, "16"
      11            -- {Key:17}, 17
      62            -- String, length: 2
        3137        -- {Val:17}, "17"
      12            -- {Key:18}, 18
      62            -- String, length: 2
        3138        -- {Val:18}, "18"
      13            -- {Key:19}, 19
      62            -- String, length: 2
        3139        -- {Val:19}, "19"
      14            -- {Key:20}, 20
      62            -- String, length: 2
        3230        -- {Val:20}, "20"
      15            -- {Key:21}, 21
      62            -- String, length: 2
        3231        -- {Val:21}, "21"
      16            -- {Key:22}, 22
      62            -- String, length: 2
        3232        -- {Val:22}, "22"
      17            -- {Key:23}, 23
      62            -- String, length: 2
        3233        -- {Val:23}, "23"
      18            -- Positive number, next 1 byte
        18          -- {Key:24}, 24
      62            -- String, length: 2
        3234        -- {Val:24}, "24"
0xb8190061300161310261320361330461340561350661360761370861380961390a6231300b6231310c6231320d6231330e6231340f62313510623136116231371262313813623139146232301562323116623232176232331818623234`],
  [{['__proto__']: 0}, '{"__proto__": 0}', `
  a1                -- Map, 1 pair
    69              -- String, length: 9
      5f5f70726f746f5f5f -- {Key:0}, "__proto__"
    00              -- {Val:0}, 0
0xa1695f5f70726f746f5f5f00`],
  [new Tag(256, 1), '256(1)', `
  d9                --  next 2 bytes
    0100            -- Tag #256
      01            -- 1
0xd9010001`],
  [new Uint8Array([1, 2, 3]), 'h\'010203\'', `
  43            -- Bytes, length: 3
    010203      -- 010203
0x43010203`],
  [new Uint8ClampedArray([1, 2, 3]), '68(h\'010203\')', `
  d8                --  next 1 byte
    44              -- Tag #68
      43            -- Bytes, length: 3
        010203      -- 010203
0xd84443010203`],
  [new Set([1, 2]), '258([1, 2])', `
d9                --  next 2 bytes
  0102            -- Tag #258
    82            -- Array, 2 items
      01          -- [0], 1
      02          -- [1], 2
0xd90102820102`],
  [new Int8Array([-1, 0, 1, -128, 127]),
    '72(h\'ff0001807f\')',
    '0xd84845ff0001807f'],
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

export const decodeGood = [
  [1.5, '1.5_1', `
  f9                -- Float, next 2 bytes
    3e00            -- 1.5
0xf93e00`],
  [65504, '65504_1', `
  f9                -- Float, next 2 bytes
    7bff            -- 65504
0xf97bff`],
  [new Tag(23, hexToU8('01020304')).decode(), '23(h\'01020304\')', `
  d7                -- Tag #23
    44              -- Bytes, length: 4
      01020304      -- 01020304
0xd74401020304`],
  [new Tag(24, hexToU8('6449455446')).decode(), '24(h\'6449455446\')', `
  d8                --  next 1 byte
    18              -- Tag #24 Encoded CBOR data item
      45            -- Bytes, length: 5
        6449455446  -- 6449455446
        64          -- String, length: 4
          49455446  -- "IETF"
0xd818456449455446`],
  [0, '0_1', `
  f9                -- Float, next 2 bytes
    0000            -- 0
0xf90000`],
  [-0, '-0_1', `
  f9                -- Float, next 2 bytes
    8000            -- -0
0xf98000`],
  [1, '1_1', `
  f9                -- Float, next 2 bytes
    3c00            -- 1
0xf93c00`],
  [100000, '100000_2', `
  fa                -- Float, next 4 bytes
    47c35000        -- 100000
0xfa47c35000`],
  [5.960464477539063e-8, '5.960464477539063e-8_1', `
  f9                -- Float, next 2 bytes
    0001            -- 5.960464477539063e-8
0xf90001`],
  [9223372036854775807n, '9223372036854775807_3', `
  1b                -- Positive number, next 8 bytes
    7fffffffffffffff -- 9223372036854775807
0x1b7fffffffffffffff`],
  [-9223372036854775808n, '-9223372036854775808_3', `
  3b                -- Negative number, next 8 bytes
    7fffffffffffffff -- -9223372036854775808
0x3b7fffffffffffffff`],
  [0.00006103515625, '0.00006103515625_1', `
  f9                -- Float, next 2 bytes
    0400            -- 0.00006103515625
0xf90400`],
  [-4, '-4_1', `
  f9                -- Float, next 2 bytes
    c400            -- -4
0xf9c400`],
  [Infinity, 'Infinity_2', `
  fa                -- Float, next 4 bytes
    7f800000        -- Infinity
0xfa7f800000`],
  [-Infinity, '-Infinity_2', `
  fa                -- Float, next 4 bytes
    ff800000        -- -Infinity
0xfaff800000`],
  [Infinity, 'Infinity_3', `
  fb                -- Float, next 8 bytes
    7ff0000000000000 -- Infinity
0xfb7ff0000000000000`],
  [-Infinity, '-Infinity_3', `
  fb                -- Float, next 8 bytes
    fff0000000000000 -- -Infinity
0xfbfff0000000000000`],
  [NaN, 'NaN_2', `
  fa                -- Float, next 4 bytes
    7fc00000        -- NaN
0xfa7fc00000`],
  [NaN, 'NaN_3', `
  fb                -- Float, next 8 bytes
    7ff8000000000000 -- NaN
0xfb7ff8000000000000`],
  [-9007199254740992, '-9007199254740992_3', `
  3b                -- Negative number, next 8 bytes
    001fffffffffffff -- -9007199254740992
0x3b001fffffffffffff`],
  [new Date('2013-03-21T20:04:00Z'), '0("2013-03-21T20:04:00Z")', `
  c0                -- Tag #0
    74              -- String, length: 20
      323031332d30332d32315432303a30343a30305a -- "2013-03-21T20:04:00Z"
0xc074323031332d30332d32315432303a30343a30305a`],
  [new Date(1363896240500), '1(1363896240.5_3)', `
  c1                -- Tag #1
    fb              -- Float, next 8 bytes
      41d452d9ec200000 -- 1363896240.5
0xc1fb41d452d9ec200000`],
  [hexToU8('0102030405'), '(_ h\'0102\', h\'030405\')', `
  5f                -- Bytes (streaming)
    42              -- Bytes, length: 2
      0102          -- 0102
    43              -- Bytes, length: 3
      030405        -- 030405
    ff              -- BREAK
0x5f42010243030405ff`],
  ['streaming', '(_ "strea", "ming")', `
  7f                -- String (streaming)
    65              -- String, length: 5
      7374726561    -- "strea"
    64              -- String, length: 4
      6d696e67      -- "ming"
    ff              -- BREAK
0x7f657374726561646d696e67ff`],
  [[], '[_ ]', `
  9f                -- Array (streaming)
    ff              -- BREAK
0x9fff`],
  [[1, [2, 3], [4, 5]], '[_ 1, [2, 3], [_ 4, 5]]', `
  9f                -- Array (streaming)
    01              -- [0], 1
    82              -- [1], Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
    9f              -- [2], Array (streaming)
      04            -- [0], 4
      05            -- [1], 5
      ff            -- BREAK
    ff              -- BREAK
0x9f018202039f0405ffff`],
  [[1, [2, 3], [4, 5]], '[_ 1, [2, 3], [4, 5]]', `
  9f                -- Array (streaming)
    01              -- [0], 1
    82              -- [1], Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
    82              -- [2], Array, 2 items
      04            -- [0], 4
      05            -- [1], 5
    ff              -- BREAK
0x9f01820203820405ff`],
  [[1, [2, 3], [4, 5]], '[1, [2, 3], [_ 4, 5]]', `
  83                -- Array, 3 items
    01              -- [0], 1
    82              -- [1], Array, 2 items
      02            -- [0], 2
      03            -- [1], 3
    9f              -- [2], Array (streaming)
      04            -- [0], 4
      05            -- [1], 5
      ff            -- BREAK
0x83018202039f0405ff`],
  [[1, [2, 3], [4, 5]], '[1, [_ 2, 3], [4, 5]]', `
  83                -- Array, 3 items
    01              -- [0], 1
    9f              -- [1], Array (streaming)
      02            -- [0], 2
      03            -- [1], 3
      ff            -- BREAK
    82              -- [2], Array, 2 items
      04            -- [0], 4
      05            -- [1], 5
0x83019f0203ff820405`],
  [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25], '[_ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24_0, 25_0]', `
  9f                -- Array (streaming)
    01              -- [0], 1
    02              -- [1], 2
    03              -- [2], 3
    04              -- [3], 4
    05              -- [4], 5
    06              -- [5], 6
    07              -- [6], 7
    08              -- [7], 8
    09              -- [8], 9
    0a              -- [9], 10
    0b              -- [10], 11
    0c              -- [11], 12
    0d              -- [12], 13
    0e              -- [13], 14
    0f              -- [14], 15
    10              -- [15], 16
    11              -- [16], 17
    12              -- [17], 18
    13              -- [18], 19
    14              -- [19], 20
    15              -- [20], 21
    16              -- [21], 22
    17              -- [22], 23
    18              -- Positive number, next 1 byte
      18            -- [23], 24
    18              -- Positive number, next 1 byte
      19            -- [24], 25
    ff              -- BREAK
0x9f0102030405060708090a0b0c0d0e0f101112131415161718181819ff`],
  [{a: 1, b: [2, 3]}, '{_ "a": 1, "b": [_ 2, 3]}', `
  bf                -- Map (streaming)
    61              -- String, length: 1
      61            -- {Key:0}, "a"
    01              -- {Val:0}, 1
    61              -- String, length: 1
      62            -- {Key:1}, "b"
    9f              -- {Val:1}, Array (streaming)
      02            -- [0], 2
      03            -- [1], 3
      ff            -- BREAK
    ff              -- BREAK
0xbf61610161629f0203ffff`],
  [['a', {b: 'c'}], '["a", {_ "b": "c"}]', `
  82                -- Array, 2 items
    61              -- String, length: 1
      61            -- [0], "a"
    bf              -- [1], Map (streaming)
      61            -- String, length: 1
        62          -- {Key:0}, "b"
      61            -- String, length: 1
        63          -- {Val:0}, "c"
      ff            -- BREAK
0x826161bf61626163ff`],
  [new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x99]), '64((_ h\'aabbccdd\', h\'eeff99\'))', `
  d8                --  next 1 byte
    40              -- Tag #64
      5f            -- Bytes (streaming)
        44          -- Bytes, length: 4
          aabbccdd  -- aabbccdd
        43          -- Bytes, length: 3
          eeff99    -- eeff99
        ff          -- BREAK
0xd8405f44aabbccdd43eeff99ff`],
  [/a/, '35("a")', `
d8                --  next 1 byte
  23              -- Tag #35
    61            -- String, length: 1
      61          -- "a"
0xd8236161`],
];

export const encodeGood = [
  /* eslint-disable no-new-wrappers */
  [new String('foo'), 'boxed', '0x63666f6f'],
  [new Boolean(true), 'boxed', '0xf5'],
  [new Number(12), 'boxed', '0x0c'],
  /* eslint-enable no-new-wrappers */
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
  '0xd9011783616162677500', // RegExp array too long
  '0xd9011780', // RegExp array too short
  '0xd90117820000', // RegExp invalid flags
];

const HEX = /0x(?<hex>[0-9a-f]+)$/i;

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

//
// export class EncodeFailer extends cbor.Encoder {
//   constructor(count) {
//     super();
//     if (count == null) {
//       count = Number.MAX_SAFE_INTEGER;
//     }
//     this.count = count;
//     this.start = count;
//   }

//   push(fresh, encoding) {
//     if (this.count-- <= 0) {
//       super.push(null);
//       return false;
//     }
//     return super.push(fresh, encoding);
//   }

//   get used() {
//     return this.start - this.count;
//   }

//   static tryAll(t, f, canonical) {
//     let enc = new EncodeFailer();
//     enc.canonical = canonical;
//     t.truthy(enc.pushAny(f));
//     const {used} = enc;
//     for (let i = 0; i < used; i++) {
//       enc = new EncodeFailer(i);
//       enc.canonical = canonical;
//       t.falsy(enc.pushAny(f));
//     }
//     enc = new EncodeFailer(used);
//     enc.canonical = canonical;
//     t.truthy(enc.pushAny(f));
//   }
// }

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
