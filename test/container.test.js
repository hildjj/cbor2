import {CBORcontainer} from '../lib/container.js';
import {MT} from '../lib/constants.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('create container', () => {
  const c = CBORcontainer.create(MT.POS_INT, 0, 0, undefined);
  assert(!(c instanceof CBORcontainer));
  assert.throws(() => CBORcontainer.create(-1, 0, 0, undefined));

  const d = CBORcontainer.create(MT.ARRAY, 0, 0, undefined);
  d.mt = -1;
  assert.throws(() => d.convert());
});
