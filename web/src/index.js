import './style.css';
import {base64ToBytes, hexToU8, u8toHex} from 'cbor2/utils';
import {decode, diagnose, encode} from 'cbor2';
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

// Convert any input to a buffer
function input() {
  const inp = ifmt.selectedOptions[0].label;
  const txt = itxt.value;
  switch (inp) {
    case 'JSON':
      return encode(JSON.parse(txt));
    case 'hex':
      return hexToU8(txt);
    case 'base64':
      return base64ToBytes(txt);
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
        copy.disabled = true;
        otxt.value = 'not implemented yet';
        //
        // comment(buf).then(txt => {
        //   otxt.value = txt;
        // }, error);
        break;
      case 'diagnostic':
        copy.disabled = true;
        otxt.value = diagnose(buf);
        break;
      case 'js':
        copy.disabled = true;
        otxt.value = inspect(decode(buf), {
          depth: Infinity,
          compact: 1,
          maxArrayLength: Infinity,
          breakLength: otxt.cols - 1,
        });
        break;
      case 'JSON':
        copy.disabled = false;
        otxt.value = JSON.stringify(decode(buf), null, 2);
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

ofmt.oninput = convert;
ifmt.oninput = convert;
copy.onclick = () => {
  // Copy output to input, and guess the new input format
  itxt.value = otxt.value;
  const sel = ofmt.selectedOptions[0].label;
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
