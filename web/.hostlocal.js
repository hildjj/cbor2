/** @type {import('hostlocal').HostOptions} */
export default {
  prefix: 'cbor2',
  dir: '../docs',
  port: 5500,
  caSubject: '/C=US/ST=Colorado/L=Denver/O=_HostLocal/CN=_HostLocal-cbor2',
  glob: [
    'src/**',
    '../src/**',
    '!../src/version.ts',
  ],
  exec: 'cd .. && npm run build && npm run docs',
  initial: true,
};
