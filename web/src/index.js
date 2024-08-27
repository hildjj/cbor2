import './style.css';
// eslint-disable-next-line n/no-missing-import
import * as monaco from 'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/+esm';

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
import {parseEDN} from 'cbor-edn';

const proxy = URL.createObjectURL(new Blob([`
  self.MonacoEnvironment = {
    baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min'
  };
  importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs/base/worker/workerMain.js');
`], {type: 'text/javascript'}));
window.MonacoEnvironment = {
  getWorkerUrl: () => proxy,
};

const itxt = document.getElementById('input-text');
const otxt = document.getElementById('output-text');
const ofmt = document.getElementById('output-fmt');
const ifmt = document.getElementById('input-fmt');
const copy = document.getElementById('copy');
const sortKeysEncode = document.querySelector('#sortKeysEncode');
const sortKeysDecode = document.querySelector('#sortKeysDecode');
const stringNormalization = document.querySelector('#stringNormalization');
const diagnosticSizes = document.querySelector('#diagnosticSizes');
const rejectStringsNotNormalizedAs =
  document.querySelector('#rejectStringsNotNormalizedAs');
const fontSize = 16;
const theme = 'vs-dark';

const inEditor = monaco.editor.create(itxt, {
  detectIndentation: false,
  fontSize,
  language: 'js',
  minimap: {enabled: false},
  tabSize: 2,
  theme,
});
const inModel = inEditor.getModel();

const outEditor = monaco.editor.create(otxt, {
  detectIndentation: false,
  fontSize,
  minimap: {enabled: false},
  readOnly: true,
  theme,
});
const outModel = outEditor.getModel();

window.addEventListener('resize', () => {
  // See https://stackoverflow.com/a/70120566/8388
  inEditor.layout({width: 0, height: 0});
  outEditor.layout({width: 0, height: 0});
  window.requestAnimationFrame(() => {
    const iRect = itxt.getBoundingClientRect();
    inEditor.layout({width: iRect.width, height: iRect.height});
    const oRect = otxt.getBoundingClientRect();
    outEditor.layout({width: oRect.width, height: oRect.height});
  });
});

window._cbor2testing = {
  inModel,
  outModel,
};

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

export function error(e) {
  copy.disabled = true;
  outModel.setValue(e.toString());
}

function showEncodeOpts() {
  for (const inp of document.querySelectorAll('#encodeOpts input')) {
    inp.checked = state.encodeOpts[inp.id.replace(/Encode$/, '')];
  }
  sortKeysEncode.value = sortNames.get(state.encodeOpts.sortKeys);
  stringNormalization.value = state.encodeOpts.stringNormalization;
}

function showDecodeOpts() {
  for (const inp of document.querySelectorAll('#decodeOpts input')) {
    inp.checked = state.decodeOpts[inp.id];
  }
  diagnosticSizes.value = String(state.decodeOpts.diagnosticSizes);
  rejectStringsNotNormalizedAs.value =
    state.decodeOpts.rejectStringsNotNormalizedAs;
  sortKeysDecode.value = sortNames.get(state.decodeOpts.sortKeys);
}

// Convert any input to a buffer
function input() {
  const {inp, txt} = state;
  switch (inp) {
    case 'diagnostic':
      return parseEDN(txt);
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
function output(buf, _typ) {
  try {
    const outp = ofmt.value;
    switch (outp) {
      case 'hex':
        copy.disabled = false;
        outModel.setValue(u8toHex(buf));
        break;
      case 'base64':
        copy.disabled = false;
        outModel.setValue(bytesToBase64(buf));
        break;
      case 'base64url':
        copy.disabled = false;
        outModel.setValue(bytesToBase64url(buf));
        break;
      case 'commented':
        copy.disabled = false;
        outModel.setValue(comment(buf, state.decodeOpts));
        break;
      case 'diagnostic':
        copy.disabled = false;
        outModel.setValue(diagnose(buf, state.decodeOpts));
        break;
      case 'js':
        copy.disabled = false;
        outModel.setValue(inspect(decode(buf, state.decodeOpts), {
          depth: Infinity,
          compact: 1,
          maxArrayLength: Infinity,
          breakLength: 30,
        }));
        break;
      case 'JSON':
        copy.disabled = false;
        outModel.setValue(
          JSON.stringify(decode(buf, state.decodeOpts), null, 2)
        );
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

diagnosticSizes.onchange = () => {
  state.decodeOpts.diagnosticSizes = Number(diagnosticSizes.value);
  return convert();
};

rejectStringsNotNormalizedAs.onchange = () => {
  state.decodeOpts.rejectStringsNotNormalizedAs =
    rejectStringsNotNormalizedAs.value;
  return convert();
};
rejectStringsNotNormalizedAs.value = 'null';

sortKeysEncode.onchange = () => {
  state.encodeOpts.sortKeys = sortFuncs.get(sortKeysEncode.value);
  return convert();
};
sortKeysEncode.value = 'null';

stringNormalization.onChange = () => {
  state.encodeOpts.stringNormalization = stringNormalization.value;
  return convert();
};
stringNormalization.value = 'null';

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
  let txt = outModel.getValue();
  let sel = ofmt.value;

  if (sel === 'commented') {
    const m = txt.match(/^0x[0-9a-f]+/i);
    txt = m ? m[0] : '';
    sel = 'hex';
  }
  ifmt.value = sel;
  state.inp = sel;
  inModel.setValue(txt);
};

// Debounce
let timeout = null;
inModel.onDidChangeContent(() => {
  state.txt = inModel.getValue();
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    clearTimeout(timeout);
    timeout = null;
    return convert();
  }, 300);
});

const acc = document.getElementsByClassName('accordion');
for (let i = 0; i < acc.length; i++) {
  const a = acc[i];
  a.addEventListener('click', () => {
    a.classList.toggle('active');
    const panel = a.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = `${panel.scrollHeight}px`;
    }
  });
}

(async() => {
  const u = new URL(window.location.href);
  if (u.hash) {
    const jsonState = await decompressString(u.hash.replace(/^#/, ''));
    state = JSON.parse(jsonState);
    state.decodeOpts.sortKeys = sortFuncs.get(state.decodeOpts.sortKeys);
    state.encodeOpts.sortKeys = sortFuncs.get(state.encodeOpts.sortKeys);
  }
  ofmt.value = state.outp;
  ifmt.value = state.inp;
  inModel.setValue(state.txt);

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

