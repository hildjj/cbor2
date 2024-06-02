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
import {base64ToBytes, hexToU8, u8toHex} from 'cbor2/utils';
import {sortCoreDeterministic, sortLengthFirstDeterministic} from 'cbor2/sorts';
import {inspect} from 'node-inspect-extracted';

const ofmt = document.getElementById('output-fmt');
const otxt = document.getElementById('output-text');
const itxt = document.getElementById('input-text');
const ifmt = document.getElementById('input-fmt');
const copy = document.getElementById('copy');
const sortKeysEncode = document.querySelector('#sortKeysEncode');
const sortKeysDecode = document.querySelector('#sortKeysDecode');

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

/**
 * Encode Uint8Array to base64.
 *
 * @param {Uint8Array} bytes Buffer.
 * @returns {string} Base64.
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

const encodeOpts = defaultEncodeOptions;
const decodeOpts = defaultDecodeOptions;

function showEncodeOpts() {
  for (const inp of document.querySelectorAll('#encodeOpts input')) {
    inp.checked = encodeOpts[inp.id.replace(/Encode$/, '')];
  }
  if (encodeOpts.sortKeys === sortCoreDeterministic) {
    sortKeysEncode.value = 'coreDeterministic';
  } else if (encodeOpts.sortKeys === sortLengthFirstDeterministic) {
    sortKeysEncode.value = 'lengthFirstDeterministic';
  } else {
    sortKeysEncode.value = 'null';
  }
}

function showDecodeOpts() {
  for (const inp of document.querySelectorAll('#decodeOpts input')) {
    inp.checked = decodeOpts[inp.id];
  }
  if (decodeOpts.sortKeys === sortCoreDeterministic) {
    sortKeysDecode.value = 'coreDeterministic';
  } else if (decodeOpts.sortKeys === sortLengthFirstDeterministic) {
    sortKeysDecode.value = 'lengthFirstDeterministic';
  } else {
    sortKeysDecode.value = 'null';
  }
}

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
        const fun = new Function('Simple', 'Tag', 'encodedNumber', `"use strict";return ${txt}`);
        return encode(fun(Simple, Tag, encodedNumber), encodeOpts);
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
        otxt.value = comment(buf, decodeOpts);
        break;
      case 'diagnostic':
        copy.disabled = true;
        otxt.value = diagnose(buf, decodeOpts);
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
  let modified = false;
  if (opt === 'dcbor') {
    Object.assign(encodeOpts, target.checked ?
      dcborEncodeOptions :
      notDcborEncodeOptions);
    modified = true;
  } else if (opt === 'cde') {
    Object.assign(encodeOpts, target.checked ?
      cdeEncodeOptions :
      notCdeEncodeOptions);
    modified = true;
  }
  if (modified) {
    showEncodeOpts();
  }
  convert();
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
  let modified = false;
  if (target.id === 'dcbor') {
    modified = true;
    Object.assign(decodeOpts, target.checked ?
      dcborDecodeOptions :
      notDcborDecodeOptions);
  } else if (target.id === 'cde') {
    modified = true;
    Object.assign(decodeOpts, target.checked ?
      cdeDecodeOptions :
      notCdeDecodeOptions);
  }
  if (modified) {
    showDecodeOpts();
  }

  convert();
}

showEncodeOpts();
for (const inp of document.querySelectorAll('#encodeOpts input')) {
  inp.onchange = changeEncodeOption;
}

showDecodeOpts();
for (const inp of document.querySelectorAll('#decodeOpts input')) {
  inp.onchange = changeDecodeOption;
}

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
