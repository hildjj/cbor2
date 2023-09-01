import {DecodeOptions, MtAiValue, Parent, RequiredDecodeOptions} from './options.js';
import {MT, NUMBYTES, SYMS} from './constants.js';
import {type OriginalEncoding, getEncoded, saveEncoded} from './box.js';
import {CBORcontainer} from './container.js';
import {DecodeStream} from './decodeStream.js';
import {Simple} from './simple.js';
import {u8toHex} from './utils.js';

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
  maxDepth: number,
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
  ret = ret.padEnd(maxDepth + 1, ' ');
  ret += '-- ';
  if (index !== undefined) {
    ret += spaces(container.depth * 2);
    if (index !== '') {
      ret += `[${index}] `;
    }
  }
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
    case MT.TAG:
      ret += `Tag #${container.value}`;
      break;
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

  ret += '\n';
  if (container.leaf) {
    if (enc.length > numLen + 1) {
      const ind = spaces((container.depth + 1) * 2);
      for (let i = numLen + 1; i < enc.length; i += 8) {
        ret += ind;
        ret += u8toHex(enc.subarray(i, i + 8));
        ret += '\n';
      }
    }
  } else {
    let i = 0;
    for (const c of container.children) {
      if (isCommentContainer(c)) {
        let kv = String(i);
        if (container.mt === MT.MAP) {
          kv = (i % 2) ? `val ${(i - 1) / 2}` : `key ${i / 2}`;
        } else if (container.mt === MT.TAG) {
          kv = '';
        }
        ret += output(c, maxDepth, kv);
      }
      i++;
    }
  }
  return ret;
}

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
  options?: DecodeOptions
): string {
  const opts: Required<DecodeOptions> = {
    ...CBORcontainer.defaultOptions,
    ...options,
    ParentType: CommentContainer,
    saveOriginal: true,
  };

  const stream = new DecodeStream(src, opts);
  let parent: Parent | undefined = undefined;
  let ret: any = undefined;
  let maxDepth = -Infinity;

  // Convert the stream to a tree of CBORcontainer's
  for (const mav of stream) {
    ret = CBORcontainer.create(mav, parent, opts, stream);

    if (mav[2] === SYMS.BREAK) {
      if (parent?.isStreaming) {
        parent.left = 1; // Pushing the BREAK will decrease left by one.
      } else {
        throw new Error('Unexpected BREAK');
      }
    }

    if (!isCommentContainer(ret)) {
      const c = new CommentContainer(mav, 0, parent, opts);
      c.leaf = true;
      c.children.push(ret);
      saveEncoded(c, stream.toHere(mav[3]));
      ret = c;
    }
    let d = (ret.depth + 1) * 2; // Spaces, plus first byte
    const nb = ret.numBytes();
    if (nb) {
      d += 1; // Space
      d += nb * 2; // Bytes
    }
    maxDepth = Math.max(maxDepth, d);
    if (parent) {
      parent.push(ret, stream, mav[3]);
    }
    parent = ret;

    while (parent?.done) {
      ret = parent;
      if (!ret.leaf) {
        saveEncoded(ret, stream.toHere(ret.offset));
      }
      ({parent} = parent);
    }
  }

  return `0x${u8toHex(stream.toHere(0))}\n${output(ret, maxDepth)}`;
}
