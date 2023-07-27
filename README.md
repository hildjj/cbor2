# cbor2

Encode and parse data in the Concise Binary Object Representation (CBOR) data
format ([RFC8949](https://www.rfc-editor.org/rfc/rfc8949.html)).

This package supersedes [node-cbor](https://github.com/hildjj/node-cbor/tree/main/packages/cbor), with the following goals:

- Web-first.  Usable in node.
- Simpler where possible.  Remove non-core features in favor of extensibility.
- Synchronous decoding.  Removes streaming capabilities that are rarely used.
- Complete break of API compatibility, allowing use of newer JavaScript constructs.
- No work-arounds for older environments.

## Supported Node.js versions

This project now only supports versions of Node that the Node team is
[currently supporting](https://github.com/nodejs/Release#release-schedule).
Ava's [support
statement](https://github.com/avajs/ava/blob/main/docs/support-statement.md)
is what we will be using as well. Since the first release will not be soon,
that means Node `18`+ is required.

## Installation

```bash
npm install --save cbor2
```

## Documentation

See the full API [documentation](http://hildjj.github.io/cbor2/).

Example:

```js
import {decode, diagnose, encode} from 'cbor';

const encoded = encode(true); // Returns Uint8Array(1) [ 245 ]
decode(encoded); // Returns true

// Use integers as keys:
const m = new Map();
m.set(1, 25);
encode(m); // Returns Uint8Array(3) [ 161, 1, 24, 25 ]
diagnose(encode(m)); // {1: 25_0}
```

## Supported types

If you load `cbor2` using `import {decode, encode} from 'cbor2';`, all of the
type converters will be loaded automatically.  If you import only pieces of
the API and you want the type converters loaded, please also do
`import 'cbor2/types';`.

The following types are supported for encoding:

- boolean
- number (including -0, NaN, and ±Infinity)
- string
- Array, Set (encoded as Array)
- Object (including null), Map
- undefined
- Buffer
- Date,
- RegExp
- URL
- TypedArrays
- Map, Set
- bigint

Decoding supports the above types, including the following CBOR tag numbers:

| Tag | Generated Type      |
|-----|---------------------|
| 0   | Date                |
| 1   | Date                |
| 2   | BigInt              |
| 3   | BigInt              |
| 24  | any                 |
| 32  | URL                 |
| 33  | Tagged              |
| 34  | Tagged              |
| 35  | RegExp              |
| 64  | Uint8Array          |
| 65  | Uint16Array         |
| 66  | Uint32Array         |
| 67  | BigUint64Array      |
| 68  | Uint8ClampedArray   |
| 69  | Uint16Array         |
| 70  | Uint32Array         |
| 71  | BigUint64Array      |
| 72  | Int8Array           |
| 73  | Int16Array          |
| 74  | Int32Array          |
| 75  | BigInt64Array       |
| 77  | Int16Array          |
| 78  | Int32Array          |
| 79  | BigInt64Array       |
| 81  | Float32Array        |
| 82  | Float64Array        |
| 85  | Float32Array        |
| 86  | Float64Array        |
| 258 | Set                 |
| 262 | any                 |
| 279 | RegExp              |
| 55799 | any               |
| 0xffff | Error            |
| 0xffffffff | Error        |
| 0xffffffffffffffff | Error|

## Adding new Encoders

There are several ways to add a new encoder:

### `toCBOR` method

This is the easiest approach, if you can modify the class being encoded.  Add
a `toCBOR()` method to your class, which should return a two-element array
containing the tag number and data item that encodes your class.  If the tag
number is `undefined`, no tag will be written.

For example:

```js
class Foo {
  constructor(one, two) {
    this.one = one;
    this.two = two;
  }

  toCBOR() {
    return [64000, [this.one, this.two]];
  }
}
```

You can also modify an existing type by monkey-patching a `toCBOR` function
onto its prototype, but this isn't recommended.

### `toJSON()` method

If your object does not have a `toCBOR()` method, but does have a `toJSON()`
method, the value returned from `toJSON()` will be used to serialize the
object.

### `registerEncoder`

Sometimes, you want to support an existing type without modification to that
type.  In this case, call `registerEncoder(type, encodeFunction)`. The
`encodeFunction` takes an object instance and returns the same type as
`toCBOR` above:

```js
import {registerEncoder} from 'cbor2/encoder';

class Bar {
  constructor() {
    this.three = 3;
  }
}
registerEncoder(Bar, b => [undefined, b.three]);
```

## Adding new decoders

Most of the time, you will want to add support for decoding a new tag type.  If
the Decoder class encounters a tag it doesn't support, it will generate a `Tag`
instance that you can handle or ignore as needed.  To have a specific type
generated instead, call `Tag.registerDecoder()` with the tag number and a function that will convert the tags value to the appropriate type. For the `Foo` example above, this might look like:

```js
import {Tag} from 'cbor2/tag';

Tag.registerDecoder(64000, tag => new Foo(tag.contents[0], tag.contents[1]));
```

You can also replace the default decoders by passing in an appropriate tag
function.  For example:

```js
// Tag 0 is Date/Time as an ISO-8601 string
import 'cbor2/types';
import {Tag} from 'cbor2/tag';

Tag.registerDecoder(0, ({contents}) => Temporal.Instant.from(contents));
```

## Developers

The tests for this package use a set of test vectors from RFC 8949 appendix A
by importing a machine readable version of them from
[https://github.com/cbor/test-vectors](https://github.com/cbor/test-vectors). For these tests to work, you will need
to use the command `git submodule update --init` after cloning or pulling this
code.   See the [git docs](https://gist.github.com/gitaarik/8735255#file-git_submodules-md)
for more information.

---
[![Build Status](https://github.com/hildjj/cbor2/workflows/Tests/badge.svg)](https://github.com/hildjj/cbor2/actions?query=workflow%3ATests)
[![codecov](https://codecov.io/gh/hildjj/cbor2/branch/main/graph/badge.svg?token=N7B7YLIDM4)](https://codecov.io/gh/hildjj/cbor2)
