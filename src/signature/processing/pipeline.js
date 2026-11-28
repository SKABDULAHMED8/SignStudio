import { DEFAULT_PROCESSING_SETTINGS, INK_PROFILES, MAX_INPUT_PIXELS, OUTPUT_SIZES } from './constants.js';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function rgbToHsv(red, green, blue) {
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

export function estimatePaperColor(imageData, sampleLimit = 12000) {
  const { data, width, height } = imageData;
  if (!data || width < 1 || height < 1 || data.length !== width * height * 4) throw new TypeError('Invalid image pixel buffer');
  const stride = Math.max(1, Math.floor((width * height) / sampleLimit));
  const samples = [];
  for (let pixel = 0; pixel < width * height; pixel += stride) {
    const i = pixel * 4;
    if (data[i + 3] < 10) continue;
    const brightness = Math.max(data[i], data[i + 1], data[i + 2]);
    if (brightness >= 150) samples.push([data[i], data[i + 1], data[i + 2], brightness]);
  }
  if (!samples.length) throw new Error('Paper background could not be detected');
  samples.sort((a, b) => a[3] - b[3]);
  const bright = samples.slice(Math.floor(samples.length * 0.65));
  const avg = [0, 0, 0];
  for (const sample of bright) { avg[0] += sample[0]; avg[1] += sample[1]; avg[2] += sample[2]; }
  return avg.map(channel => channel / bright.length);
}

export function normalizeLighting(imageData, paperColor, strength = 0.72) {
  const output = new Uint8ClampedArray(imageData.data);
  const target = (paperColor[0] + paperColor[1] + paperColor[2]) / 3;
  for (let i = 0; i < output.length; i += 4) {
    if (output[i + 3] === 0) continue;
    const current = (output[i] + output[i + 1] + output[i + 2]) / 3;
    const corrected = current + (target - current) * strength * clamp((245 - current) / 180);
    const scale = current > 0 ? corrected / current : 1;
    output[i] = clamp(output[i] * scale, 0, 255);
    output[i + 1] = clamp(output[i + 1] * scale, 0, 255);
    output[i + 2] = clamp(output[i + 2] * scale, 0, 255);
  }
  return { ...imageData, data: output };
}

export function createInkMask(imageData, paperColor, settings = {}) {
  const options = { ...DEFAULT_PROCESSING_SETTINGS, ...settings };
  const profile = INK_PROFILES[options.ink];
  if (!profile) throw new RangeError(`Unsupported ink profile: ${options.ink}`);
  const mask = new Float32Array(imageData.width * imageData.height);
  const paperBrightness = (paperColor[0] + paperColor[1] + paperColor[2]) / (3 * 255);
  const sensitivity = clamp(options.sensitivity);
  // Contrast floor controls how much darker a pixel must be than the estimated paper.
  const contrastFloor = 0.055 + (1 - sensitivity) * 0.16;
  // Alpha ramp controls how quickly faint ink edges fade instead of becoming binary.
  const alphaRamp = 0.12 + sensitivity * 0.24;
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const i = pixel * 4;
    if (imageData.data[i + 3] === 0) continue;
    const hsv = rgbToHsv(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]);
    const brightness = hsv.v;
    let hueMatches = false;
    if (options.ink === 'black') hueMatches = hsv.s <= profile.saturationMax && brightness <= profile.brightnessMax + sensitivity * 0.22;
    if (options.ink === 'blue') hueMatches = hsv.h >= profile.hueMin && hsv.h <= profile.hueMax && hsv.s >= profile.saturationMin && brightness <= profile.brightnessMax;
    if (options.ink === 'red') hueMatches = (hsv.h <= profile.hueLowMax || hsv.h >= profile.hueHighMin) && hsv.s >= profile.saturationMin && brightness <= profile.brightnessMax;
    if (options.ink === 'green') hueMatches = hsv.h >= profile.hueMin && hsv.h <= profile.hueMax && hsv.s >= profile.saturationMin && brightness <= profile.brightnessMax;
    const darkness = paperBrightness - brightness;
    const requiredContrast = contrastFloor * (options.ink === 'black' ? 0.78 : 1);
    if (!hueMatches || darkness <= requiredContrast) continue;
    const hueStrength = options.ink === 'black' ? 1 : clamp((hsv.s - profile.saturationMin) / 0.42 + 0.5);
    mask[pixel] = clamp((darkness - requiredContrast) / alphaRamp) * hueStrength;
  }
  return mask;
}

export function calculateAlpha(mask, width, height, sensitivity = 0.58) {
  if (mask.length !== width * height) throw new TypeError('Ink mask dimensions do not match');
  const alpha = new Uint8ClampedArray(mask.length);
  const cutoff = 0.025 + (1 - clamp(sensitivity)) * 0.08;
  for (let i = 0; i < mask.length; i++) {
    const strength = clamp((mask[i] - cutoff) / (1 - cutoff));
    alpha[i] = Math.round(strength * 255);
  }
  return alpha;
}

export function removeNoise(alpha, width, height, noiseRemoval = 0.45) {
  if (alpha.length !== width * height) throw new TypeError('Alpha dimensions do not match');
  const visited = new Uint8Array(alpha.length);
  const output = new Uint8ClampedArray(alpha);
  const minimumPixels = Math.max(1, Math.round(1 + clamp(noiseRemoval) ** 2 * 44));
  const queue = new Int32Array(alpha.length);
  for (let start = 0; start < alpha.length; start++) {
    if (visited[start] || alpha[start] === 0) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width, y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && alpha[next] > 0) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail < minimumPixels) for (let i = 0; i < tail; i++) output[queue[i]] = 0;
  }
  return output;
}

export function cropToContent(imageData, alpha, margin = 12) {
  const { width, height, data } = imageData;
  if (alpha.length !== width * height) throw new TypeError('Alpha dimensions do not match');
  let left = width, top = height, right = -1, bottom = -1;
  for (let p = 0; p < alpha.length; p++) if (alpha[p] > 0) {
    const x = p % width, y = Math.floor(p / width);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < 0) throw new Error('No signature ink was found');
  const pad = Math.min(50, Math.max(0, Math.round(margin)));
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad); bottom = Math.min(height - 1, bottom + pad);
  const outWidth = right - left + 1, outHeight = bottom - top + 1;
  const pixels = new Uint8ClampedArray(outWidth * outHeight * 4);
  const croppedAlpha = new Uint8ClampedArray(outWidth * outHeight);
  for (let y = 0; y < outHeight; y++) for (let x = 0; x < outWidth; x++) {
    const source = (top + y) * width + left + x, target = y * outWidth + x;
    pixels[target * 4] = data[source * 4]; pixels[target * 4 + 1] = data[source * 4 + 1];
    pixels[target * 4 + 2] = data[source * 4 + 2]; pixels[target * 4 + 3] = alpha[source];
    croppedAlpha[target] = alpha[source];
  }
  return { width: outWidth, height: outHeight, data: pixels, alpha: croppedAlpha, origin: { x: left, y: top } };
}

export function recolorInk(imageData, color, alpha = null) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError('Ink colour must be a six-digit hex value');
  const channels = [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
  const output = new Uint8ClampedArray(imageData.width * imageData.height * 4);
  for (let pixel = 0; pixel < imageData.width * imageData.height; pixel++) {
    const a = alpha ? alpha[pixel] : imageData.data[pixel * 4 + 3];
    output[pixel * 4] = channels[0]; output[pixel * 4 + 1] = channels[1];
    output[pixel * 4 + 2] = channels[2]; output[pixel * 4 + 3] = a;
  }
  return { width: imageData.width, height: imageData.height, data: output };
}

export function resizeOutput(imageData, requestedSize) {
  if (!OUTPUT_SIZES.includes(requestedSize)) throw new RangeError('Unsupported output size');
  const longest = Math.max(imageData.width, imageData.height);
  const limit = requestedSize === 'original' ? 4096 : requestedSize;
  const targetLongest = Math.min(longest, limit);
  const scale = Math.min(1, targetLongest / longest);
  return { width: Math.max(1, Math.round(imageData.width * scale)), height: Math.max(1, Math.round(imageData.height * scale)), scale };
}

export function processTransparentSignature(imageData, settings = {}) {
  const options = { ...DEFAULT_PROCESSING_SETTINGS, ...settings };
  if (!imageData?.data || imageData.width < 1 || imageData.height < 1 || imageData.data.length !== imageData.width * imageData.height * 4) throw new TypeError('Invalid transparent drawing buffer');
  if (imageData.width * imageData.height > MAX_INPUT_PIXELS) throw new RangeError('Drawing is too large to process');
  const alpha = new Uint8ClampedArray(imageData.width * imageData.height);
  for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = imageData.data[pixel * 4 + 3];
  const cleaned = removeNoise(alpha, imageData.width, imageData.height, options.noiseRemoval);
  const cropped = cropToContent(imageData, cleaned, options.cropMargin);
  const color = ({ blue: '#2459d3', black: '#17191f', red: '#c93636', green: '#198452' })[options.ink];
  if (!color) throw new RangeError(`Unsupported ink profile: ${options.ink}`);
  const recolored = recolorInk(cropped, color, cropped.alpha);
  const size = resizeOutput(recolored, options.outputSize);
  return { image: size.scale < 1 ? resizeNearestPremultiplied(recolored, size.width, size.height) : recolored, settings: options, source: 'drawing' };
}

export function processSignature(imageData, settings = {}) {
  const options = { ...DEFAULT_PROCESSING_SETTINGS, ...settings };
  if (imageData.width * imageData.height > MAX_INPUT_PIXELS) throw new RangeError('Image is too large to process');
  const paper = estimatePaperColor(imageData);
  const normalised = normalizeLighting(imageData, paper, options.lightingStrength);
  // Detect ink against the original pixel luminance. Lighting normalization is for
  // the exported colour data; applying it before contrast detection can brighten
  // dark ink to paper-white and erase the very signal the mask needs.
  const mask = createInkMask(imageData, paper, options);
  const alpha = removeNoise(calculateAlpha(mask, imageData.width, imageData.height, options.sensitivity), imageData.width, imageData.height, options.noiseRemoval);
  const cropped = cropToContent(normalised, alpha, options.cropMargin);
  const recolored = recolorInk(cropped, ({ blue: '#2459d3', black: '#17191f', red: '#c93636', green: '#198452' })[options.ink], cropped.alpha);
  const size = resizeOutput(recolored, options.outputSize);
  return { image: size.scale < 1 ? resizeNearestPremultiplied(recolored, size.width, size.height) : recolored, paperColor: paper, settings: options };
}

export function resizeNearestPremultiplied(source, width, height) {
  const output = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(source.width - 1, Math.floor(x * source.width / width));
    const sy = Math.min(source.height - 1, Math.floor(y * source.height / height));
    const from = (sy * source.width + sx) * 4, to = (y * width + x) * 4;
    const alpha = source.data[from + 3] / 255;
    output[to] = Math.round(source.data[from] * alpha);
    output[to + 1] = Math.round(source.data[from + 1] * alpha);
    output[to + 2] = Math.round(source.data[from + 2] * alpha);
    output[to + 3] = source.data[from + 3];
    if (alpha > 0) { output[to] = Math.round(output[to] / alpha); output[to + 1] = Math.round(output[to + 1] / alpha); output[to + 2] = Math.round(output[to + 2] / alpha); }
  }
  return { width, height, data: output };
}
