import '../lib/types.js';
import {Tag} from '../lib/tag.js';
import assert from 'node:assert/strict';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';
import util from 'node:util';

function epoch(_tag) {
  return new Date();
}

test('Tag', () => {
  const t = new Tag(0, '2023-07-21T22:16:20-0600');
  assert(t);
  assert.equal(util.inspect(t, {colors: false}), "0('2023-07-21T22:16:20-0600')");

  const old = Tag.registerDecoder(0, epoch);
  assert(old);
  assert(old.comment);
  Tag.registerDecoder(0, old); // Resists .comment being overwritten from epoch

  const t0 = Tag.clearDecoder(0);
  assert(t0);
  assert.equal(t.decode(), t);
  assert.equal(Tag.registerDecoder(0, t0), undefined);
  assert.notEqual(t.decode(), t);

  assert.deepEqual([...t], ['2023-07-21T22:16:20-0600']);
});

test('Tag Register and verify decoders', () => {
  function myDecoder(_tag) {
    return 'myDecoder';
  }

  // Register a decoder with a tag
  Tag.registerDecoder(9999, myDecoder);

  // Verify the we added decoder to the registry
  assert.equal(Tag.getDecoder(9999), myDecoder);

  // Verify execution is the same as the decoder
  assert.equal(Tag.getDecoder(9999)(), myDecoder());

  // Verify decoder is in all decoder list
  const allDecoders = Tag.getAllDecoders();
  assert.equal(allDecoders[9999], myDecoder);

  // Remove the decoder from the registry
  Tag.clearDecoder(9999);

  // Verify the decoder is removed
  assert.equal(Tag.getDecoder(9999), undefined);

  // Verify the decoder is removed from all decoder list
  assert.equal(Tag.getAllDecoders()[9999], undefined);
});

