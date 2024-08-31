/**
 * Diagnostic notation from CBOR-encoded data.
 *
 * @module
 * @example
 *
 * ```js
 * import {diagnose} from 'cbor2/diagnostic';
 * console.log(diagnose('7fff')); // ""_
 * ```
 */

import {type DecodeOptions, DiagnosticSizes} from './options.js';
import {MT, NUMBYTES, SYMS} from './constants.js';
import {CBORcontainer} from './container.js';
import {DecodeStream} from './decodeStream.js';
import {Simple} from './simple.js';
import {halfToUint} from './float.js';
import {u8toHex} from './utils.js';

const INDENT = '  ';
const TE = new TextEncoder();

/**
 * Doesn't actually "contain" the child elements; there is no reason to hold
 * on to them in diagnostic mode.
 */
class DiagContainer extends CBORcontainer {
  public close = '';
  public quote = '"';

  /**
   * Is this a streaming UTF8 string or byte string, which has no items in the
   * stream?
   *
   * @readonly
   * @returns {boolean} True if cleanup needed.
   */
  public get isEmptyStream(): boolean {
    return (this.mt === MT.UTF8_STRING || this.mt === MT.BYTE_STRING) &&
      (this.count === 0);
  }
}

/**
 * Append a "_0" (e.g.) to numeric types to show their AI size.  Also handles
 * -0 correctly.  Only insert encoding indicators only where the binary form
 * differs from preferred encoding.
 *
 * @param mt Major Type.
 * @param ai Additional info.
 * @param value Numeric value to annotate.
 * @returns String version, marked up as needed.
 */
function sized(
  mt: number,
  ai: number,
  value: number | bigint,
  opts: Required<DecodeOptions>
): string {
  let str = '';

  // Only insert encoding indicators only where the binary form differs from
  // preferred encoding.
  if (ai === NUMBYTES.INDEFINITE) {
    str += '_'; // Always needed
  } else if (opts.diagnosticSizes === DiagnosticSizes.NEVER) {
    return '';
  } else {
    let output_size = (opts.diagnosticSizes === DiagnosticSizes.ALWAYS);

    // When ai <= 23 is always in preferred encoding.
    if (!output_size) {
      let correct_ai = NUMBYTES.ZERO;
      if (Object.is(value, -0)) {
        correct_ai = NUMBYTES.TWO;
      } else if (mt === MT.POS_INT || mt === MT.NEG_INT) {
        const neg = (value < 0);
        const one = (typeof value === 'bigint') ? 1n : 1;
        // @ts-expect-error It's ok, ts.
        const pos = neg ? -value - one : value;
        if (pos <= 23) {
          correct_ai = Number(pos);
        } else if (pos <= 0xff) {
          correct_ai = NUMBYTES.ONE;
        } else if (pos <= 0xffff) {
          correct_ai = NUMBYTES.TWO;
        } else if (pos <= 0xffffffff) {
          correct_ai = NUMBYTES.FOUR;
        } else {
          correct_ai = NUMBYTES.EIGHT;
        }
      } else if (isFinite(value as number)) {
        if (Math.fround(value as number) === value) {
          // It's at least as small as f32.
          if (halfToUint(value) == null) {
            correct_ai = NUMBYTES.FOUR;
          } else {
            correct_ai = NUMBYTES.TWO;
          }
        } else {
          correct_ai = NUMBYTES.EIGHT;
        }
      } else {
        correct_ai = NUMBYTES.TWO;
      }

      output_size = (correct_ai !== ai);
    }
    if (output_size) {
      str += '_';
      if (ai < NUMBYTES.ONE) {
        str += 'i';
      } else {
        str += String(ai - 24);
      }
    }
  }
  return str;
}

/**
 * Decode CBOR bytes a diagnostic string.
 *
 * @param src CBOR bytes to decode.
 * @param options Options for decoding.
 * @returns JS value decoded from cbor.
 * @throws {Error} No value found, decoding errors.
 */
export function diagnose(
  src: Uint8Array | string,
  options?: DecodeOptions
): string {
  const opts: Required<DecodeOptions> = {
    ...CBORcontainer.defaultDecodeOptions,
    ...options,
    ParentType: DiagContainer,
  };

  const stream = new DecodeStream(src, opts);
  let parent: DiagContainer | undefined = undefined;
  let ret: any = undefined;
  let str = '';

  for (const mav of stream) {
    const [mt, ai, val] = mav;
    if (parent) {
      if ((parent.count > 0) && (val !== SYMS.BREAK)) {
        if ((parent.mt === MT.MAP) && (parent.count % 2)) {
          str += ': ';
        } else {
          str += ',';
          if (!opts.pretty) {
            str += ' ';
          }
        }
      }
      if (opts.pretty) {
        if ((parent.mt !== MT.MAP) || (parent.count % 2 === 0)) {
          str += `\n${INDENT.repeat(parent.depth + 1)}`;
        }
      }
    }
    ret = CBORcontainer.create(mav, parent, opts, stream);
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT:
        str += String(val);
        str += sized(mt, ai, val as number, opts);
        break;
      case MT.SIMPLE_FLOAT:
        if (val !== SYMS.BREAK) {
          if (typeof val === 'number') {
            const num = Object.is(val, -0) ? '-0.0' : String(val);
            str += num;
            if (isFinite(val) && !/[.e]/.test(num)) {
              str += '.0';
            }
            str += sized(mt, ai, val, opts);
          } else if (val instanceof Simple) {
            str += 'simple(';
            str += String(val.value);
            str += sized(MT.POS_INT, ai, val.value, opts);
            str += ')';
          } else {
            str += String(val);
          }
        }
        break;
      case MT.BYTE_STRING:
        if (val === Infinity) {
          str += '(_ ';
          ret.close = ')';
          ret.quote = "'";
        } else {
          str += "h'";
          str += u8toHex(val as Uint8Array);
          str += "'";
          str += sized(MT.POS_INT, ai, (val as Uint8Array).length, opts);
        }
        break;
      case MT.UTF8_STRING:
        if (val === Infinity) {
          str += '(_ ';
          ret.close = ')';
        } else {
          str += JSON.stringify(val); // Surrounds w/quotes and escapes
          str += sized(MT.POS_INT, ai, TE.encode((val as string)).length, opts);
        }
        break;
      case MT.ARRAY: {
        str += '[';
        const s = sized(MT.POS_INT, ai, val as number, opts);
        str += s;
        if (s) {
          str += ' ';
        }
        if (opts.pretty && val) {
          ret.close = `\n${INDENT.repeat(ret.depth)}]`;
        } else {
          ret.close = ']';
        }
        break;
      }
      case MT.MAP: {
        str += '{';
        const s = sized(MT.POS_INT, ai, val as number, opts);
        str += s;
        if (s) {
          str += ' ';
        }
        if (opts.pretty && val) {
          ret.close = `\n${INDENT.repeat(ret.depth)}}`;
        } else {
          ret.close = '}';
        }
        break;
      }
      case MT.TAG:
        str += String(val);
        str += sized(MT.POS_INT, ai, val as number, opts);
        str += '(';
        ret.close = ')';
        break;
    }
    if (ret === SYMS.BREAK) {
      if (parent?.isStreaming) {
        parent.left = 0;
      } else {
        throw new Error('Unexpected BREAK');
      }
    } else if (parent) {
      parent.count++;
      parent.left--;
    }

    if (ret instanceof DiagContainer) {
      parent = ret;
    }
    while (parent?.done) {
      if (parent.isEmptyStream) {
        str = str.slice(0, -3);
        str += `${parent.quote}${parent.quote}_`;
      } else if ((parent.mt === MT.MAP) && ((parent.count % 2) !== 0)) {
        throw new Error(`Odd streaming map size: ${parent.count}`);
      } else {
        str += parent.close;
      }

      parent = parent.parent as DiagContainer | undefined;
    }
  }

  return str;
}
