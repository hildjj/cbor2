const b64ToUrl = {
  '+': '-',
  '/': '_',
  '=': '',
};
const urlToB64 = {
  '-': '+',
  '_': '/',
};
export function bytesToBase64(buf) {
  const u8 = new Uint8Array(buf);
  const binString = Array.from(u8, byte => String.fromCodePoint(byte)).join('');
  return btoa(binString);
}
export function bytesToBase64url(buf) {
  const b64 = bytesToBase64(buf);
  return b64.replace(/[+/=]/g, s => b64ToUrl[s]);
}
export async function compressString(txt) {
  const te = new TextEncoderStream();
  const rd = te.readable.pipeThrough(new CompressionStream('deflate'));
  const w = te.writable.getWriter();
  await w.write(txt);
  await w.close();
  const r = new Response(rd);
  return bytesToBase64url(await r.arrayBuffer());
}
export async function decompressString(compressed) {
  let b64 = compressed.replace(/[_-]/g, s => (urlToB64[s] ?? s));
  while (b64.length % 4) {
    b64 += '=';
  }
  const resp = await fetch(`data:text/javascript;base64,${b64}`);
  const dec = resp.body?.pipeThrough(new DecompressionStream('deflate'));
  const res = new Response(dec);
  return res.text();
}
