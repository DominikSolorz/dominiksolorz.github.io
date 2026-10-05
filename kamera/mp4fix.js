// Nagrania z przeglądarki (MediaRecorder) to „pocięte” MP4 bez zapisanej długości — telefon (zwłaszcza iPhone)
// traktuje je wtedy jak transmisję na żywo i nie pozwala przewijać. Tu liczymy prawdziwą długość z próbek
// (moof → traf → trun) i wpisujemy ją do nagłówków (mvhd, tkhd, mdhd, mehd). Dane obrazu się nie zmieniają.
const u32 = (d, o) => d.getUint32(o);
const type = (d, o) => String.fromCharCode(d.getUint8(o + 4), d.getUint8(o + 5), d.getUint8(o + 6), d.getUint8(o + 7));

// Pudełka [start, koniec) w zakresie; obsługuje rozmiar 64-bitowy i „do końca pliku”.
function boxes(d, from, to) {
  const out = [];
  for (let o = from; o + 8 <= to;) {
    let size = u32(d, o), head = 8;
    if (size === 1) { size = Number(d.getBigUint64(o + 8)); head = 16; } else if (size === 0) size = to - o;
    if (size < head || o + size > to) break;
    out.push({ type: type(d, o), start: o, end: o + size, body: o + head });
    o += size;
  }
  return out;
}
const child = (d, b, name) => boxes(d, b.body, b.end).find(x => x.type === name);
const children = (d, b, name) => boxes(d, b.body, b.end).filter(x => x.type === name);

// Pole długości w pudełku z wersją (v0: 32 bity, v1: 64 bity) — przesunięcie liczone od początku treści.
function setDur(d, b, off0, off1, value) {
  const v = d.getUint8(b.body);
  if (v === 1) d.setBigUint64(b.body + off1, BigInt(Math.round(value)));
  else d.setUint32(b.body + off0, Math.min(0xffffffff, Math.round(value)));
}

export async function fixMp4Duration(blob) {
  if (!/mp4/i.test(blob.type || "") || blob.size < 16) return blob;
  const buf = new Uint8Array(await blob.arrayBuffer());
  const d = new DataView(buf.buffer);
  const top = boxes(d, 0, buf.length);
  const moov = top.find(b => b.type === "moov");
  if (!moov || !top.some(b => b.type === "moof")) return blob; // zwykłe MP4 — ma już długość

  const mvhd = child(d, moov, "mvhd");
  if (!mvhd) return blob;
  const movieScale = u32(d, mvhd.body + (d.getUint8(mvhd.body) === 1 ? 20 : 12));

  // Ścieżki: identyfikator → skala czasu i domyślna długość próbki (z trex).
  const tracks = new Map();
  for (const trak of children(d, moov, "trak")) {
    const tkhd = child(d, trak, "tkhd"), mdia = child(d, trak, "mdia"), mdhd = mdia && child(d, mdia, "mdhd");
    if (!tkhd || !mdhd) continue;
    const id = u32(d, tkhd.body + (d.getUint8(tkhd.body) === 1 ? 20 : 12));
    tracks.set(id, { tkhd, mdhd, scale: u32(d, mdhd.body + (d.getUint8(mdhd.body) === 1 ? 20 : 12)), defDur: 0, total: 0 });
  }
  const mvex = child(d, moov, "mvex");
  for (const trex of mvex ? children(d, mvex, "trex") : []) {
    const t = tracks.get(u32(d, trex.body + 4)); if (t) t.defDur = u32(d, trex.body + 12);
  }

  // Suma długości próbek we wszystkich fragmentach.
  let absoluteOffsets = false;
  for (const moof of top.filter(b => b.type === "moof")) {
    for (const traf of children(d, moof, "traf")) {
      const tfhd = child(d, traf, "tfhd"); if (!tfhd) continue;
      const flags = u32(d, tfhd.body) & 0xffffff;
      const t = tracks.get(u32(d, tfhd.body + 4)); if (!t) continue;
      if (flags & 0x01) absoluteOffsets = true;
      let o = tfhd.body + 8 + (flags & 0x01 ? 8 : 0) + (flags & 0x02 ? 4 : 0);
      const def = flags & 0x08 ? u32(d, o) : t.defDur;
      for (const trun of children(d, traf, "trun")) {
        const tf = u32(d, trun.body) & 0xffffff, count = u32(d, trun.body + 4);
        let p = trun.body + 8 + (tf & 0x01 ? 4 : 0) + (tf & 0x04 ? 4 : 0);
        const per = (tf & 0x100 ? 4 : 0) + (tf & 0x200 ? 4 : 0) + (tf & 0x400 ? 4 : 0) + (tf & 0x800 ? 4 : 0);
        if (tf & 0x100) { for (let i = 0; i < count; i++, p += per) t.total += u32(d, p); }
        else t.total += def * count;
      }
    }
  }
  const seconds = Math.max(0, ...[...tracks.values()].map(t => (t.scale ? t.total / t.scale : 0)));
  if (!seconds) return blob;

  // Wpisanie długości do nagłówków (w miejscu — rozmiar pliku bez zmian).
  setDur(d, mvhd, 16, 24, seconds * movieScale);
  for (const t of tracks.values()) {
    setDur(d, t.tkhd, 20, 28, seconds * movieScale);
    setDur(d, t.mdhd, 16, 24, t.total);
  }
  const mehd = mvex && child(d, mvex, "mehd");
  if (mehd) { setDur(d, mehd, 4, 4, seconds * movieScale); return new Blob([buf], { type: blob.type }); }
  if (!mvex || absoluteOffsets) return new Blob([buf], { type: blob.type });

  // Brak mehd: dokładamy go (16 bajtów) na początku mvex. Przesunięcia danych w moof są względne — bezpieczne.
  const mehdBox = new Uint8Array(16), md = new DataView(mehdBox.buffer);
  md.setUint32(0, 16); mehdBox.set([0x6d, 0x65, 0x68, 0x64], 4); md.setUint32(8, 0);
  md.setUint32(12, Math.min(0xffffffff, Math.round(seconds * movieScale)));
  const grow = (b) => { if (u32(d, b.start) === 1) d.setBigUint64(b.start + 8, d.getBigUint64(b.start + 8) + 16n); else d.setUint32(b.start, u32(d, b.start) + 16); };
  grow(moov); grow(mvex);
  return new Blob([buf.subarray(0, mvex.body), mehdBox, buf.subarray(mvex.body)], { type: blob.type });
}
