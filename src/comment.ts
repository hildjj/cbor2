import type {
  CommentOptions,
  MtAiValue, Parent,
  RequiredCommentOptions,
  RequiredDecodeOptions,
} from './options.js';
import {MT, NUMBYTES, SYMS} from './constants.js';
import {type OriginalEncoding, getEncoded, saveEncoded} from './box.js';
import {getRanges, subarrayRanges, u8toHex} from './utils.js';
import {CBORcontainer} from './container.js';
import {DecodeStream} from './decodeStream.js';
import {Simple} from './simple.js';
import {Tag} from './tag.js';
import {diagnose} from './diagnostic.js';

const TD = new TextDecoder();

class CommentContainer extends CBORcontainer implements OriginalEncoding {
  public depth = 0;
  public leaf = false;
  public value: unknown;
  public length: bigint | number;
  public [SYMS.ENCODED]?: Uint8Array;

  public constructor(
    mav: MtAiValue,
    left: number,
    parent: Parent | undefined,
    opts: RequiredDecodeOptions
  ) {
    super(mav, left, parent, opts);
    if (this.parent) {
      this.depth = (this.parent as CommentContainer).depth + 1;
    } else {
      this.depth = (opts as RequiredCommentOptions).initialDepth;
    }
    [, , this.value, , this.length] = mav;
  }

  public numBytes(): number {
    switch (this.ai) {
      case NUMBYTES.ONE: return 1;
      case NUMBYTES.TWO: return 2;
      case NUMBYTES.FOUR: return 4;
      case NUMBYTES.EIGHT: return 8;
    }
    return 0;
  }
}

function isCommentContainer(o: any): o is CommentContainer {
  return (o instanceof CommentContainer);
}

function pl(num: bigint | number, unit?: string): string {
  if (num === Infinity) {
    return 'Indefinite';
  }
  if (unit) {
    return `${num} ${unit}${((num !== 1) && (num !== 1n)) ? 's' : ''}`;
  }
  return String(num);
}

function spaces(num: number): string {
  return ''.padStart(num, ' ');
}

function output(
  container: CommentContainer,
  options: RequiredCommentOptions,
  index?: string
): string {
  let ret = '';
  ret += spaces(container.depth * 2);
  const enc = getEncoded(container) as Uint8Array;
  ret += u8toHex(enc.subarray(0, 1));
  const numLen = container.numBytes();
  if (numLen) {
    ret += ' ';
    ret += u8toHex(enc.subarray(1, numLen + 1));
  }
  ret = ret.padEnd(options.minCol + 1, ' ');
  ret += '-- ';
  if (index !== undefined) {
    ret += spaces(container.depth * 2);
    if (index !== '') {
      ret += `[${index}] `;
    }
  }
  let noChildren = false;
  const [firstChild] = container.children as unknown[];
  switch (container.mt) {
    case MT.POS_INT:
      ret += `Unsigned: ${firstChild}`;
      if (typeof firstChild === 'bigint') {
        ret += 'n';
      }
      break;
    case MT.NEG_INT:
      ret += `Negative: ${firstChild}`;
      if (typeof firstChild === 'bigint') {
        ret += 'n';
      }
      break;
    case MT.BYTE_STRING:
      ret += `Bytes (Length: ${pl(container.length)})`;
      break;
    case MT.UTF8_STRING:
      ret += `UTF8 (Length: ${pl(container.length)})`;
      if (container.length !== Infinity) {
        ret += `: ${JSON.stringify(firstChild)}`;
      }
      break;
    case MT.ARRAY:
      ret += `Array (Length: ${pl(container.value as bigint | number, 'item')})`;
      break;
    case MT.MAP:
      ret += `Map (Length: ${pl(container.value as bigint | number, 'pair')})`;
      break;
    case MT.TAG: {
      ret += `Tag #${container.value}`;
      const ct = (container.children as Tag);
      const [tagChild] =
        (ct.contents as CommentContainer).children as unknown[][];
      const t = new Tag(ct.tag, tagChild);
      saveEncoded(t as OriginalEncoding, enc);
      const c = t.comment(options, container.depth);
      if (c) {
        ret += ': ';
        ret += c;
      }
      noChildren ||= t.noChildren;
      break;
    }
    case MT.SIMPLE_FLOAT:
      if (firstChild === SYMS.BREAK) {
        ret += 'BREAK';
      } else if (container.ai > NUMBYTES.ONE) {
        if (Object.is(firstChild, -0)) {
          ret += 'Float: -0';
        } else {
          ret += `Float: ${firstChild}`;
        }
      } else {
        ret += 'Simple: ';
        if (firstChild instanceof Simple) {
          ret += firstChild.value;
        } else {
          ret += firstChild;
        }
      }
      break;
  }

  if (noChildren) {
    // No-op
  } else if (container.leaf) {
    ret += '\n';
    if (enc.length > numLen + 1) {
      const ind = spaces((container.depth + 1) * 2);
      const ranges = getRanges(enc);
      if (ranges?.length) {
        ranges.sort((a, b) => {
          const start = a[0] - b[0];
          if (start) {
            return start;
          }
          return b[1] - a[1];
        });
        let max = 0;
        for (const [start, len, type] of ranges) {
          if (start < max) {
            continue;
          }
          max = start + len;
          if (type === '<<') {
            ret += spaces(options.minCol + 1);
            ret += '--';
            ret += ind;
            ret += '<< ';
            const buf = subarrayRanges(enc, start, start + len);
            const bufRanges = getRanges(buf);
            if (bufRanges) {
              // The current range will always be start 0 in bufRanges, since
              // we just subtracted start from it.
              const rInd = bufRanges.findIndex(
                ([s2, l2, t2]) => (s2 === 0) && (l2 === len) && (t2 === '<<')
              );
              if (rInd >= 0) {
                bufRanges.splice(rInd, 1);
              }
            }
            ret += diagnose(buf);
            ret += ' >>\n';
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            ret += comment(buf, {
              initialDepth: container.depth + 1,
              minCol: options.minCol,
              noPrefixHex: true,
            });
            continue;
          } else if (type === "'") {
            ret += spaces(options.minCol + 1);
            ret += '--';
            ret += ind;
            ret += "'";
            ret += TD.decode(enc.subarray(start, start + len));
            ret += "'\n";
          }
          if (start > numLen) {
            for (let i = start; i < start + len; i += 8) {
              const end = Math.min(i + 8, start + len);
              ret += ind;
              ret += u8toHex(enc.subarray(i, end));
              ret += '\n';
            }
          }
        }
      } else {
        for (let i = numLen + 1; i < enc.length; i += 8) {
          ret += ind;
          ret += u8toHex(enc.subarray(i, i + 8));
          ret += '\n';
        }
      }
    }
  } else {
    ret += '\n';
    let i = 0;
    for (const c of container.children) {
      if (isCommentContainer(c)) {
        let kv = String(i);
        if (container.mt === MT.MAP) {
          kv = (i % 2) ? `val ${(i - 1) / 2}` : `key ${i / 2}`;
        } else if (container.mt === MT.TAG) {
          kv = '';
        }
        ret += output(c, options, kv);
      }
      i++;
    }
  }
  return ret;
}

const CommentOptionsDefault: RequiredCommentOptions = {
  ...CBORcontainer.defaultDecodeOptions,
  initialDepth: 0,
  noPrefixHex: false,
  minCol: 0,
};

/**
 * Create a string that describes the input CBOR.
 *
 * @param src CBOR-encoded string or byte array.
 * @param options Options for decoding.
 * @returns Comment string.
 * @throws On invalid CBOR.
 */
export function comment(
  src: Uint8Array | string,
  options?: CommentOptions
): string {
  const opts: RequiredCommentOptions = {
    ...CommentOptionsDefault,
    ...options,
    ParentType: CommentContainer,
    saveOriginal: true,
  };

  const stream = new DecodeStream(src, opts);
  let parent: Parent | undefined = undefined;
  let root: any = undefined;

  // Convert the stream to a tree of CBORcontainer's
  for (const mav of stream) {
    root = CBORcontainer.create(mav, parent, opts, stream);

    if (mav[2] === SYMS.BREAK) {
      if (parent?.isStreaming) {
        parent.left = 1; // Pushing the BREAK will decrease left by one.
      } else {
        throw new Error('Unexpected BREAK');
      }
    }

    if (!isCommentContainer(root)) {
      const c = new CommentContainer(mav, 0, parent, opts);
      c.leaf = true;
      c.children.push(root);
      saveEncoded(c, stream.toHere(mav[3]));
      root = c;
    }
    let d = (root.depth + 1) * 2; // Spaces, plus first byte
    const nb = root.numBytes();
    if (nb) {
      d += 1; // Space
      d += nb * 2; // Bytes
    }
    opts.minCol = Math.max(opts.minCol, d);
    if (parent) {
      parent.push(root, stream, mav[3]);
    }
    parent = root;

    while (parent?.done) {
      root = parent;
      if (!root.leaf) {
        saveEncoded(root, stream.toHere(root.offset));
      }
      ({parent} = parent);
    }
  }
  // Cheating:
  if (options) {
    options.minCol = opts.minCol;
  }

  let ret = opts.noPrefixHex ? '' : `0x${u8toHex(stream.toHere(0))}\n`;
  ret += output(root, opts);
  return ret;
}
