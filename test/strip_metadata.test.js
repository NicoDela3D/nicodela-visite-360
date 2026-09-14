import test from 'node:test';
import assert from 'node:assert/strict';
import { stripJpeg, stripPng } from '../tools/strip_metadata.mjs';

function fakeJpeg() {
  return Buffer.from([
    0xff, 0xd8,                                     // SOI
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,             // APP0 (JFIF) — à garder
    0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66, // APP1 (Exif) — à retirer
    0xff, 0xfe, 0x00, 0x05, 0x61, 0x62, 0x63,       // COM — à retirer
    0xff, 0xda, 0x00, 0x02,                         // SOS : le reste est copié tel quel
    0x12, 0x34, 0xff, 0xd9,                         // données + EOI
  ]);
}

test('stripJpeg retire APP1 et COM, garde APP0 et les données', () => {
  const out = stripJpeg(fakeJpeg());
  assert.deepEqual([...out.subarray(0, 2)], [0xff, 0xd8]);
  assert.ok(out.includes(Buffer.from([0xff, 0xe0])), 'APP0 conservé');
  assert.ok(!out.includes(Buffer.from('Exif', 'ascii')), 'Exif retiré');
  assert.ok(!out.includes(Buffer.from('abc', 'ascii')), 'COM retiré');
  assert.deepEqual([...out.subarray(out.length - 4)], [0x12, 0x34, 0xff, 0xd9]);
});
test('stripJpeg refuse un non-JPEG', () => assert.throws(() => stripJpeg(Buffer.from([0, 1, 2]))));

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'ascii'), Buffer.from(data), Buffer.alloc(4)]); // CRC bidon
}
function fakePng() {
  return Buffer.concat([Buffer.from(SIG), chunk('IHDR', []), chunk('tEXt', [0x68, 0x69]), chunk('IEND', [])]);
}

test('stripPng retire tEXt, garde IHDR et IEND', () => {
  const out = stripPng(fakePng());
  assert.ok(out.includes(Buffer.from('IHDR', 'ascii')));
  assert.ok(out.includes(Buffer.from('IEND', 'ascii')));
  assert.ok(!out.includes(Buffer.from('tEXt', 'ascii')));
});
test('stripPng refuse un non-PNG', () => assert.throws(() => stripPng(Buffer.from([0, 1, 2]))));
