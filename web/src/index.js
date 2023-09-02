import './style.css';
import {Simple, Tag, comment, decode, diagnose, encode} from 'cbor2';
import {base64ToBytes, hexToU8, u8toHex} from 'cbor2/utils';
import {sortCoreDeterministic, sortLengthFirstDeterministic} from 'cbor2/sorts';
import {inspect} from 'node-inspect-extracted';

const ofmt = document.getElementById('output-fmt');
const otxt = document.getElementById('output-text');
const itxt = document.getElementById('input-text');
const ifmt = document.getElementById('input-fmt');
const copy = document.getElementById('copy');

/**
 * Encode Uint8Array to base64.
 *
 * @param bytes Buffer.
 * @returns Base64.
 */
export function bytesToBase64(bytes) {
  const binString = Array.from(bytes, x => String.fromCodePoint(x))
    .join('');
  return btoa(binString);
}

function error(e) {
  copy.disabled = true;
  otxt.value = e.toString();
}

const encodeOpts = {
  avoidInts: false,
  collapseBigInts: true,
  float64: false,
  forceEndian: null,
  ignoreOriginalEncoding: false,
  largeNegativeAsBigInt: false,
  rejectBigInts: false,
  rejectCustomSimples: false,
  rejectDuplicateKeys: false,
  rejectFloats: false,
  rejectUndefined: false,
  simplifyNegativeZero: false,
  sortKeys: null,
};

const decodeOpts = {
  boxed: false,
  rejectLargeNegatives: false,
  rejectBigInts: false,
  rejectDuplicateKeys: false,
  rejectFloats: false,
  rejectInts: false,
  rejectLongLoundNaN: false,
  rejectLongNumbers: false,
  rejectNegativeZero: false,
  rejectSimple: false,
  rejectStreaming: false,
  rejectUndefined: false,
  saveOriginal: false,
  sortKeys: null,
};

// Convert any input to a buffer
function input() {
  const inp = ifmt.selectedOptions[0].label;
  const txt = itxt.value;
  switch (inp) {
    case 'JSON':
      return encode(JSON.parse(txt), encodeOpts);
    case 'hex': {
      let hex = txt.replace(/^0x/i, '');
      hex = hex.replace(/\s+/g, '');
      return hexToU8(hex);
    }
    case 'base64':
      return base64ToBytes(txt);
    case 'js': {
      if (txt.trim().length > 0) {
        // eslint-disable-next-line no-new-func
        const fun = new Function('Simple', 'Tag', `"use strict";return ${txt}`);
        return encode(fun(Simple, Tag), encodeOpts);
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
      case 'commented':
        copy.disabled = false;
        otxt.value = comment(buf);
        break;
      case 'diagnostic':
        copy.disabled = true;
        otxt.value = diagnose(buf);
        break;
      case 'js':
        copy.disabled = false;
        otxt.value = inspect(decode(buf, decodeOpts), {
          depth: Infinity,
          compact: 1,
          maxArrayLength: Infinity,
          breakLength: otxt.cols - 1,
        });
        break;
      case 'JSON':
        copy.disabled = false;
        otxt.value = JSON.stringify(decode(buf, decodeOpts), null, 2);
        break;
      default:
        throw new Error(`Unknown output: "${outp}"`);
    }
  } catch (e) {
    error(e);
  }
}

function convert() {
  try {
    output(input());
  } catch (e) {
    error(e);
    throw e;
  }
}

function changeEncodeOption({target}) {
  const opt = target.id.replace(/Encode$/, '');
  encodeOpts[opt] = target.checked;
  convert();
}

for (const inp of document.querySelectorAll('#encodingOpts input')) {
  inp.onchange = changeEncodeOption;
  inp.checked = encodeOpts[inp.id.replace(/Encode$/, '')];
}

const forceEndian = document.querySelector('#forceEndian');
forceEndian.onchange = () => {
  encodeOpts.forceEndian = {
    null: null,
    true: true,
    false: false,
  }[forceEndian.value];
  convert();
};
forceEndian.value = 'null';

const sortKeysEncode = document.querySelector('#sortKeysEncode');
sortKeysEncode.onchange = () => {
  encodeOpts.sortKeys = {
    null: null,
    coreDeterministic: sortCoreDeterministic,
    lengthFirstDeterministic: sortLengthFirstDeterministic,
  }[sortKeysEncode.value];
  convert();
};
sortKeysEncode.value = 'null';

function changeDecodeOption({target}) {
  decodeOpts[target.id] = target.checked;
  convert();
}

for (const inp of document.querySelectorAll('#decodingOpts input')) {
  inp.onchange = changeDecodeOption;
  inp.checked = decodeOpts[inp.id];
}

const sortKeysDecode = document.querySelector('#sortKeysDecode');
sortKeysDecode.onchange = () => {
  encodeOpts.sortKeys = {
    null: null,
    coreDeterministic: sortCoreDeterministic,
    lengthFirstDeterministic: sortLengthFirstDeterministic,
  }[sortKeysDecode.value];
  convert();
};
sortKeysDecode.value = 'null';

ofmt.oninput = convert;
ifmt.oninput = convert;
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
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    timeout = null;
    convert();
  }, 300);
};

// Make sure that initial output is set
convert();
