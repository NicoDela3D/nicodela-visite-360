// Retire les métadonnées des JPG/PNG avant publication (EXIF, commentaires,
// chunks texte PNG — leçon du PNG Corsier qui fuitait le chemin Blender).
// Usage : node tools/strip_metadata.mjs assets/panos [autres dossiers...]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('pas un JPEG');
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`segment JPEG invalide à l'offset ${i}`);
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); break; } // SOS : données jusqu'à la fin
    const len = buf.readUInt16BE(i + 2);
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe; // APP1-15, COM
    if (!drop) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(out);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

export function stripPng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('pas un PNG');
  const out = [PNG_SIG];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, i + 12 + len));
    i += 12 + len;
  }
  return Buffer.concat(out);
}

// garde « exécuté directement » (import depuis les tests → pas de CLI)
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  for (const dir of process.argv.slice(2)) {
    for (const f of readdirSync(dir)) {
      const ext = extname(f).toLowerCase();
      const path = join(dir, f);
      if (ext === '.jpg' || ext === '.jpeg') writeFileSync(path, stripJpeg(readFileSync(path)));
      else if (ext === '.png') writeFileSync(path, stripPng(readFileSync(path)));
      else continue;
      console.log(`nettoyé : ${path}`);
    }
  }
}
