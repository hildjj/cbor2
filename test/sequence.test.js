import '../lib/types.js';
import {SequenceEvents, decodeSequence} from '../lib/decoder.js';
import assert from 'node:assert/strict';
import {hexToU8} from '../lib/utils.js';
import test from 'node:test';

test('SequenceEvents read and peek', () => {
  // Simple SequenceEvents of two integers: 1, 2
  // 01 -- Unsigned: 1
  // 02 -- Unsigned: 2
  const seq = new SequenceEvents(hexToU8('0102'));

  // Peek first tuple
  const firstPeek = seq.peek();
  assert.ok(firstPeek, 'Peek should return a tuple');
  assert.equal(firstPeek[0], 0, 'Major type should be 0 (positive integer)');
  assert.equal(firstPeek[2], 1, 'Value should be 1');

  // Peek again should return the same tuple
  const secondPeek = seq.peek();
  assert.strictEqual(secondPeek, firstPeek, 'Multiple peeks should return same tuple');

  // Read should return the same tuple and advance
  const firstRead = seq.read();
  assert.strictEqual(firstRead, firstPeek, 'Read should return same tuple as peek');

  // Next read should get the second tuple
  const secondRead = seq.read();
  assert.ok(secondRead, 'Should read second tuple');
  assert.equal(secondRead[0], 0, 'Major type should be 0 (positive integer)');
  assert.equal(secondRead[2], 2, 'Value should be 2');

  // No more tuples
  assert.equal(seq.read(), undefined, 'Should return undefined when no more tuples');
});

test('SequenceEvents iteration with Uint8Array input', () => {
  // Sequence of three integers: 1, 2, 3
  // 01 -- Unsigned: 1
  // 02 -- Unsigned: 2
  // 03 -- Unsigned: 3
  const seq = new SequenceEvents(new Uint8Array([1, 2, 3]));

  const values = [];
  for (const tuple of seq) {
    values.push(tuple[2]);
  }

  assert.deepEqual(values, [1, 2, 3], 'Should iterate through all values');

  // SequenceEvents should be exhausted
  assert.equal(seq.peek(), undefined, 'Peek should return undefined after iteration');
});

test('SequenceEvents iteration with hex input', () => {
  // SequenceEvents of three integers: 1, 2, 3
  // 01 -- Unsigned: 1
  // 02 -- Unsigned: 2
  // 03 -- Unsigned: 3
  const seq = new SequenceEvents(hexToU8('010203'));

  const values = [];
  for (const tuple of seq) {
    values.push(tuple[2]);
  }

  assert.deepEqual(values, [1, 2, 3], 'Should iterate through all values');

  // SequenceEvents should be exhausted
  assert.equal(seq.peek(), undefined, 'Peek should return undefined after iteration');
});

test('SequenceEvents with complex CBOR', () => {
  // SequenceEvents containing: 1, "hello", [1, 2, 3], 3
  // 01       -- Unsigned: 1
  // 65       -- UTF8 (Length: 5): "hello"
  //   68656c6c6f
  // 83       -- Array (Length: 3 items)
  //   01     --   [0] Unsigned: 1
  //   02     --   [1] Unsigned: 2
  //   03     --   [2] Unsigned: 3
  // 03       -- Unsigned: 3
  const hex = '016568656c6c6f8301020303';
  const seq = new SequenceEvents(hex, {encoding: 'hex'});

  const tuples = Array.from(seq);

  // We should get 7 tuples in total
  assert.equal(tuples.length, 7, 'Should have 7 tuples for this SequenceEvents');

  // First tuple: 1
  assert.equal(tuples[0][0], 0, 'First tuple should be unsigned integer type (0)');
  assert.equal(tuples[0][2], 1, 'First value should be 1');

  // Second tuple: string "hello"
  assert.equal(tuples[1][0], 3, 'Second major type should be 3 (text string)');
  assert.equal(tuples[1][2], 'hello', 'String value should be "hello"');

  // Third tuple: array header with length 3
  assert.equal(tuples[2][0], 4, 'Third major type should be 4 (array)');
  assert.equal(tuples[2][2], 3, 'Array length should be 3');

  // Array elements
  assert.equal(tuples[3][2], 1, 'First array element should be 1');
  assert.equal(tuples[4][2], 2, 'Second array element should be 2');
  assert.equal(tuples[5][2], 3, 'Third array element should be 3');

  // Final value: 3
  assert.equal(tuples[6][2], 3, 'Last value should be 3');
});

test('SequenceEvents with break code', () => {
  // Integer 1 followed by BREAK code
  // 01 -- Unsigned: 1
  // FF -- BREAK
  const hex = '01FF';
  const seq = new SequenceEvents(hexToU8(hex));

  // First item should be readable
  const firstTuple = seq.read();
  assert.equal(firstTuple[2], 1, 'First item should be readable');

  // Break code should be readable as a tuple
  const breakTuple = seq.read();
  assert.ok(breakTuple, 'Break code should be readable');
  assert.equal(breakTuple[0], 7, 'Major type should be 7 for special values');
  assert.equal(breakTuple[1], 31, 'Additional info should be 31 for break code');

  // No more tuples
  assert.equal(seq.read(), undefined, 'No more tuples after break code');
});

test('Incomplete array in SequenceEvents', () => {
  // Array claiming length 2 but followed by a separate item
  // 82    -- Array (Length: 2 items)
  //   01  --   [0] Unsigned: 1
  // 02    -- Unsigned: 2 (appears outside array)
  const hex = '820102';
  const seq = new SequenceEvents(hexToU8(hex));

  // First tuple should be the array header
  const arrayHeader = seq.read();
  assert.equal(arrayHeader[0], 4, 'First tuple should be array type');
  assert.equal(arrayHeader[2], 2, 'Array length should be 2');

  // Second tuple should be the first array item
  const firstItem = seq.read();
  assert.equal(firstItem[2], 1, 'First array item should be 1');

  // Next tuple should be what looks like a second array item
  // but is actually a separate SequenceEvents item
  const nextItem = seq.read();
  assert.equal(nextItem[2], 2, 'Next item should be 2');

  // No more items
  assert.equal(seq.read(), undefined, 'No more items after reading all bytes');
});

test('Empty SequenceEvents', () => {
  // Empty byte SequenceEvents
  const seq = new SequenceEvents(hexToU8(''));
  assert.equal(seq.peek(), undefined, 'Peek should return undefined for empty SequenceEvents');
  assert.equal(seq.read(), undefined, 'Read should return undefined for empty SequenceEvents');
  const tuples = Array.from(seq);
  assert.equal(tuples.length, 0, 'Should have no tuples for empty SequenceEvents');
});

test('Indefinite length items in SequenceEvents', () => {
  // Indefinite length array with 2 items followed by break
  // 9F    -- Array (Length: Indefinite)
  //   01  --   [0] Unsigned: 1
  //   02  --   [1] Unsigned: 2
  //   FF  --   [2] BREAK
  const hex = '9f0102ff';
  const seq = new SequenceEvents(hexToU8(hex));

  const tuples = Array.from(seq);
  assert.equal(tuples.length, 4, 'Should have 4 tuples for indef array SequenceEvents');

  assert.equal(tuples[0][0], 4, 'First tuple should be array type');
  assert.equal(tuples[0][1], 31, 'Additional info should be 31 for indef length');

  assert.equal(tuples[1][2], 1, 'First array item should be 1');
  assert.equal(tuples[2][2], 2, 'Second array item should be 2');

  assert.equal(tuples[3][0], 7, 'Fourth tuple should be special type');
  assert.equal(tuples[3][1], 31, 'Additional info should be 31 for break');
});

test('Nested structures in SequenceEvents', () => {
  // Nested array [[[1]]] followed by 2, 3
  // 81      -- Array (Length: 1)
  //   81    --   [0] Array (Length: 1)
  //     81  --     [0] Array (Length: 1)
  //       01 --       [0] Unsigned: 1
  // 02      -- Unsigned: 2
  // 03      -- Unsigned: 3
  const hex = '818181010203';
  const seq = new SequenceEvents(hexToU8(hex));

  const tuples = Array.from(seq);
  assert.equal(tuples.length, 6, 'Should have 6 tuples including nested structures');

  // Check the nesting structure
  assert.equal(tuples[0][0], 4, 'First tuple should be array type');
  assert.equal(tuples[0][2], 1, 'Outer array length should be 1');

  assert.equal(tuples[1][0], 4, 'Second tuple should be array type');
  assert.equal(tuples[1][2], 1, 'Middle array length should be 1');

  assert.equal(tuples[2][0], 4, 'Third tuple should be array type');
  assert.equal(tuples[2][2], 1, 'Inner array length should be 1');

  assert.equal(tuples[3][2], 1, 'Inner value should be 1');

  // Then come the individual integers from the SequenceEvents
  assert.equal(tuples[4][2], 2, 'Next SequenceEvents item should be 2');
  assert.equal(tuples[5][2], 3, 'Last SequenceEvents item should be 3');
});

test('Tagged values in SequenceEvents', () => {
  // Tag 0 (date/time string) with "2023-01-01", followed by 2, 3
  // C0          -- Tag #0: (String Date)
  //   6A        --   UTF8 (Length: 10): "2023-01-01"
  //     323032332d30312d3031
  // 02          -- Unsigned: 2
  // 03          -- Unsigned: 3
  const hex = 'c06a323032332d30312d30310203';
  const seq = new SequenceEvents(hexToU8(hex));

  const tuples = Array.from(seq);

  // First tuple should be tag 0
  assert.equal(tuples[0][0], 6, 'First tuple should be tag type');
  assert.equal(tuples[0][2], 0, 'Tag value should be 0 (date/time)');

  // Second tuple should be the string
  assert.equal(tuples[1][0], 3, 'Second tuple should be string type');
  assert.equal(tuples[1][2], '2023-01-01', 'String value should be "2023-01-01"');

  // The remaining SequenceEvents items
  assert.equal(tuples[2][2], 2, 'Third item should be 2');
  assert.equal(tuples[3][2], 3, 'Fourth item should be 3');
});

test('Incomplete fixed length array', () => {
  // Array claiming length 3 but only 2 elements provided
  // 83       -- Array (Length: 3 items)
  //   01     --   [0] Unsigned: 1
  //   02     --   [1] Unsigned: 2
  //   (missing third element)
  const hex = '830102';
  const seq = new SequenceEvents(hexToU8(hex));

  // Should throw when reading array with insufficient elements
  assert.throws(() => [...seq], {
    name: 'RangeError',
  }, 'Should throw when reading incomplete array');
});

test('Incomplete fixed length map', () => {
  // Map claiming 2 pairs but only 1.5 pairs provided
  // A2       -- Map (Length: 2 pairs)
  //   01     --   [0] Key: 1
  //   02     --   [0] Value: 2
  //   03     --   [1] Key: 3
  //   (missing second value)
  const hex = 'a2010203';
  const seq = new SequenceEvents(hexToU8(hex));

  // Should throw when reading map with insufficient key-value pairs
  assert.throws(() => [...seq], {
    name: 'RangeError',
  }, 'Should throw when reading incomplete map');
});

test('Incomplete tagged value', () => {
  // Tag 0 without its content
  // C0       -- Tag #0
  //   (missing tagged content)
  const hex = 'c0';
  const seq = new SequenceEvents(hexToU8(hex));

  // Should throw when attempting to read tag without content
  assert.throws(() => [...seq], {
    name: 'RangeError',
  }, 'Should throw when reading tag without content');
});

test('Incomplete byte string', () => {
  // Byte string claiming length 10 but only 3 bytes provided
  // 4A          -- Byte String (Length: 10)
  //   010203    -- Only 3 bytes provided
  const hex = '4a010203';
  const seq = new SequenceEvents(hexToU8(hex));

  // Should throw when trying to read byte string with insufficient data
  assert.throws(() => [...seq], {
    message: /Unexpected end of stream/,
  }, 'Should throw when reading incomplete byte string');
});

test('Incomplete text string', () => {
  // Text string claiming length 10 but only 3 bytes provided
  // 6A          -- Text String (Length: 10)
  //   616263    -- Only 3 bytes provided ("abc")
  const hex = '6a616263';
  const seq = new SequenceEvents(hexToU8(hex));

  // Should throw when trying to read text string with insufficient data
  assert.throws(() => [...seq], {
    message: /Unexpected end of stream/,
  }, 'Should throw when reading incomplete text string');
});

test('Incomplete indefinite length array', () => {
  // Indefinite length array without break code
  // 9F          -- Array (Length: Indefinite)
  //   01        --   [0] Unsigned: 1
  //   02        --   [1] Unsigned: 2
  //   (missing break code)
  const hex = '9f0102';
  const seq = new SequenceEvents(hexToU8(hex));

  // Partially reading should work
  const firstTuple = seq.read();
  assert.equal(firstTuple[0], 4, 'First tuple should be array type');
  assert.equal(firstTuple[1], 31, 'Additional info should be 31 for indef length');

  const secondTuple = seq.read();
  assert.equal(secondTuple[2], 1, 'Second tuple should be 1');

  const thirdTuple = seq.read();
  assert.equal(thirdTuple[2], 2, 'Third tuple should be 2');

  // But when trying to read past available bytes, it should throw
  assert.throws(() => seq.read(), {
    name: 'RangeError',
  }, 'Should throw when reading indefinite array without break code');
});

test('Incomplete nested structure', () => {
  // Nested array with incomplete inner array
  // 81          -- Array (Length: 1)
  //   83        --   [0] Array (Length: 3)
  //     01      --     [0] Unsigned: 1
  //     02      --     [1] Unsigned: 2
  //     (missing third element)
  const hex = '81830102';
  const seq = new SequenceEvents(hexToU8(hex));

  // Should throw when trying to read the incomplete nested structure
  assert.throws(() => [...seq], {
    name: 'RangeError',
  }, 'Should throw when reading incomplete nested structure');
});

test('decodeSequence', () => {
  for (const [bytes, expected] of [
    ['', []],
    ['7f657374726561646d696e67ff00', ['streaming', 0]],
    ['02a2616183f98000f97e00f97c006162a16163f40001', [
      2,
      {
        a: [-0, NaN, Infinity],
        b: {
          c: false,
        },
      },
      0,
      1,
    ]],
  ]) {
    assert.deepEqual([...decodeSequence(bytes)], expected, bytes);
  }

  for (const bytes of [
    '8201',
    'a2010203',
    'c0',
    '6a616263',
    '9f0102',
    '81830102',
  ]) {
    assert.throws(() => [...decodeSequence(bytes)], bytes);
  }
});
