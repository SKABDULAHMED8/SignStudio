const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function fingerprintImage(image) {
  if (!image?.data || image.width < 1 || image.height < 1 || image.data.length !== image.width * image.height * 4) throw new TypeError('Invalid signature image.');
  const samples = new Float32Array(9 * 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) {
    const sx = clamp(Math.floor((x + 0.5) * image.width / 9), 0, image.width - 1);
    const sy = clamp(Math.floor((y + 0.5) * image.height / 8), 0, image.height - 1);
    const offset = (sy * image.width + sx) * 4;
    const alpha = image.data[offset + 3] / 255;
    const red = image.data[offset] * alpha + 255 * (1 - alpha);
    const green = image.data[offset + 1] * alpha + 255 * (1 - alpha);
    const blue = image.data[offset + 2] * alpha + 255 * (1 - alpha);
    samples[y * 9 + x] = red * 0.299 + green * 0.587 + blue * 0.114;
  }
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (samples[y * 9 + x] > samples[y * 9 + x + 1]) bits |= 1n << BigInt(y * 8 + x);
  }
  return bits.toString(16).padStart(16, '0');
}

export function hammingDistance(first, second) {
  if (!/^[0-9a-f]{16}$/i.test(first) || !/^[0-9a-f]{16}$/i.test(second)) throw new TypeError('Fingerprints must be 64-bit hexadecimal strings.');
  let value = BigInt(`0x${first}`) ^ BigInt(`0x${second}`), count = 0;
  while (value) { value &= value - 1n; count++; }
  return count;
}

export function findSimilarSignature(records, image, maxDistance = 6) {
  const target = fingerprintImage(image);
  let best = null;
  for (const record of records) {
    const fingerprint = record?.fingerprint ?? (record?.image?.data ? fingerprintImage(record.image) : null);
    if (!fingerprint) continue;
    const distance = hammingDistance(target, fingerprint);
    if (distance <= maxDistance && (!best || distance < best.distance)) best = { record, distance, similarity: (64 - distance) / 64 };
  }
  return best;
}
