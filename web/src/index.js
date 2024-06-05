import './style.css';
import {
  Simple,
  Tag,
  cdeDecodeOptions,
  cdeEncodeOptions,
  comment,
  dcborDecodeOptions,
  dcborEncodeOptions,
  decode,
  defaultDecodeOptions,
  defaultEncodeOptions,
  diagnose,
  encode,
  encodedNumber,
} from 'cbor2';
import {base64ToBytes, base64UrlToBytes, hexToU8, u8toHex} from 'cbor2/utils';
import {
  bytesToBase64,
  bytesToBase64url,
  compressString,
  decompressString,
} from './encode.js';
import {sortCoreDeterministic, sortLengthFirstDeterministic} from 'cbor2/sorts';
import {inspect} from 'node-inspect-extracted';

const ofmt = document.getElementById('output-fmt');
const otxt = document.getElementById('output-text');
const itxt = document.getElementById('input-text');
const ifmt = document.getElementById('input-fmt');
const copy = document.getElementById('copy');
const sortKeysEncode = document.querySelector('#sortKeysEncode');
const sortKeysDecode = document.querySelector('#sortKeysDecode');

let state = {
  inp: 'JSON',
  outp: 'commented',
  encodeOpts: {...defaultEncodeOptions},
  decodeOpts: {...defaultDecodeOptions},
  txt: `\
{
  "type": "here"
}`,
};
delete state.decodeOpts.ParentType;

const sortNames = new Map([
  [sortCoreDeterministic, 'coreDeterministic'],
  [sortLengthFirstDeterministic, 'lengthFirstDeterministic'],
  [null, 'null'],
  [undefined, 'null'],
]);
const sortFuncs = new Map([
  ['sortCoreDeterministic', sortCoreDeterministic],
  ['sortLengthFirstDeterministic', sortLengthFirstDeterministic],
  ['coreDeterministic', sortCoreDeterministic],
  ['lengthFirstDeterministic', sortLengthFirstDeterministic],
  ['null', null],
  [null, null],
  [undefined, null],
]);

const notCdeEncodeOptions = Object.fromEntries(
  Object.entries(cdeEncodeOptions).map(([k, v]) => [k, !v])
);

const notDcborEncodeOptions = Object.fromEntries(
  Object.entries(dcborEncodeOptions).map(([k, v]) => [k, !v])
);

const notCdeDecodeOptions = Object.fromEntries(
  Object.entries(cdeDecodeOptions).map(([k, v]) => [k, !v])
);

const notDcborDecodeOptions = Object.fromEntries(
  Object.entries(dcborDecodeOptions).map(([k, v]) => [k, !v])
);

function error(e) {
  copy.disabled = true;
  otxt.value = e.toString();
}

function showEncodeOpts() {
  for (const inp of document.querySelectorAll('#encodeOpts input')) {
    inp.checked = state.encodeOpts[inp.id.replace(/Encode$/, '')];
  }
  sortKeysEncode.value = sortNames.get(state.encodeOpts.sortKeys);
}

function showDecodeOpts() {
  for (const inp of document.querySelectorAll('#decodeOpts input')) {
    inp.checked = state.decodeOpts[inp.id];
  }
  sortKeysDecode.value = sortNames.get(state.decodeOpts.sortKeys);
}

// Convert any input to a buffer
function input() {
  const {inp, txt} = state;
  switch (inp) {
    case 'JSON':
      return encode(JSON.parse(txt), state.encodeOpts);
    case 'hex': {
      let hex = txt.replace(/^0x/i, '');
      hex = hex.replace(/\s+/g, '');
      return hexToU8(hex);
    }
    case 'base64':
      return base64ToBytes(txt);
    case 'base64url':
      return base64UrlToBytes(txt);
    case 'js': {
      if (txt.trim().length > 0) {
        // eslint-disable-next-line no-new-func
        const fun = new Function(
          'Simple',
          'Tag',
          'encodedNumber',
          `"use strict";return ${txt}`
        );
        return encode(fun(Simple, Tag, encodedNumber), state.encodeOpts);
      }
      return new Uint8Array(0);
    }
    default:
      throw new Error(`Unknown input: "${inp}"`);
  }
}

// Convert a buffer to the desired output format
function output(buf, typ) {
  try {
    const outp = ofmt.selectedOptions[0].label;
    switch (outp) {
      case 'hex':
        copy.disabled = false;
        otxt.value = u8toHex(buf);
        break;
      case 'base64':
        copy.disabled = false;
        otxt.value = bytesToBase64(buf);
        break;
      case 'base64url':
        copy.disabled = false;
        otxt.value = bytesToBase64url(buf);
        break;
      case 'commented':
        copy.disabled = false;
        otxt.value = comment(buf, state.decodeOpts);
        break;
      case 'diagnostic':
        copy.disabled = true;
        otxt.value = diagnose(buf, state.decodeOpts);
        break;
      case 'js':
        copy.disabled = false;
        otxt.value = inspect(decode(buf, state.decodeOpts), {
          depth: Infinity,
          compact: 1,
          maxArrayLength: Infinity,
          breakLength: otxt.cols - 1,
        });
        break;
      case 'JSON':
        copy.disabled = false;
        otxt.value = JSON.stringify(decode(buf, state.decodeOpts), null, 2);
        break;
      default:
        throw new Error(`Unknown output: "${outp}"`);
    }
  } catch (e) {
    error(e);
  }
}

function replaceFuncsWithNames(obj) {
  switch (typeof obj) {
    case 'number':
    case 'boolean':
    case 'string':
    case 'bigint':
    case 'undefined':
    case 'symbol':
      return obj;
    case 'function':
      return sortNames.get(obj);
    case 'object': {
      let dup = null;
      if (obj) {
        if (Array.isArray(obj)) {
          dup = [];
          for (const v of obj) {
            dup.push(replaceFuncsWithNames(v));
          }
        } else {
          dup = {};
          for (const [k, v] of Object.entries(obj)) {
            dup[k] = replaceFuncsWithNames(v);
          }
        }
      }
      return dup;
    }
    default:
      throw new Error(`Unknown type: ${typeof obj}`);
  }
}

async function convert() {
  try {
    output(input());
  } catch (e) {
    error(e);
    throw e;
  }

  const sanitizedState = replaceFuncsWithNames(state);
  const u = new URL(window.location.href);
  const hash = await compressString(JSON.stringify(sanitizedState));
  u.hash = hash;
  window.history.replaceState(hash, '', u);
}

function changeEncodeOption({target}) {
  const opt = target.id.replace(/Encode$/, '');
  state.encodeOpts[opt] = target.checked;
  let modified = false;
  if (opt === 'dcbor') {
    Object.assign(state.encodeOpts, target.checked ?
      dcborEncodeOptions :
      notDcborEncodeOptions);
    modified = true;
  } else if (opt === 'cde') {
    Object.assign(state.encodeOpts, target.checked ?
      cdeEncodeOptions :
      notCdeEncodeOptions);
    modified = true;
  }
  if (modified) {
    showEncodeOpts();
  }
  return convert();
}

const forceEndian = document.querySelector('#forceEndian');
forceEndian.onchange = () => {
  state.encodeOpts.forceEndian = {
    null: null,
    true: true,
    false: false,
  }[forceEndian.value];
  return convert();
};
forceEndian.value = 'null';

sortKeysEncode.onchange = () => {
  state.encodeOpts.sortKeys = sortFuncs.get(sortKeysEncode.value);
  return convert();
};
sortKeysEncode.value = 'null';

function changeDecodeOption({target}) {
  state.decodeOpts[target.id] = target.checked;
  let modified = false;
  if (target.id === 'dcbor') {
    modified = true;
    Object.assign(state.decodeOpts, target.checked ?
      dcborDecodeOptions :
      notDcborDecodeOptions);
  } else if (target.id === 'cde') {
    modified = true;
    Object.assign(state.decodeOpts, target.checked ?
      cdeDecodeOptions :
      notCdeDecodeOptions);
  }
  if (modified) {
    showDecodeOpts();
  }

  return convert();
}

sortKeysDecode.onchange = () => {
  state.decodeOpts.sortKeys = sortFuncs.get(sortKeysDecode.value);
  return convert();
};
sortKeysDecode.value = 'null';

ofmt.oninput = () => {
  state.outp = ofmt.value;
  return convert();
};
ifmt.oninput = () => {
  state.inp = ifmt.value;
  return convert();
};
copy.onclick = () => {
  // Copy output to input, and guess the new input format
  let txt = otxt.value;
  let sel = ofmt.selectedOptions[0].label;

  if (ofmt.selectedOptions[0].label === 'commented') {
    const m = txt.match(/^0x[0-9a-f]+/i);
    txt = m ? m[0] : '';
    sel = 'hex';
  }

  itxt.value = txt;
  for (const o of ifmt.options) {
    if (o.label === sel) {
      ifmt.selectedIndex = o.index;
      break;
    }
  }
};

// Debounce
let timeout = null;
itxt.oninput = () => {
  state.txt = itxt.value;
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    timeout = null;
    return convert();
  }, 300);
};

(async() => {
  const u = new URL(window.location.href);
  if (u.hash) {
    const jsonState = await decompressString(u.hash.replace(/^#/, ''));
    state = JSON.parse(jsonState);
    state.decodeOpts.sortKeys = sortFuncs.get(state.decodeOpts.sortKeys);
    state.encodeOpts.sortKeys = sortFuncs.get(state.encodeOpts.sortKeys);
  }
  itxt.value = state.txt;
  ofmt.value = state.outp;
  ifmt.value = state.inp;

  showEncodeOpts();
  for (const inp of document.querySelectorAll('#encodeOpts input')) {
    inp.onchange = changeEncodeOption;
  }

  showDecodeOpts();
  for (const inp of document.querySelectorAll('#decodeOpts input')) {
    inp.onchange = changeDecodeOption;
  }

  // Make sure that initial output is set
  await convert();
})();

