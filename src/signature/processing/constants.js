export const INK_PROFILES = Object.freeze({
  blue: Object.freeze({ hueMin: 200, hueMax: 250, saturationMin: 0.18, brightnessMax: 0.86 }),
  black: Object.freeze({ saturationMax: 0.34, brightnessMax: 0.62 }),
  red: Object.freeze({ hueLowMax: 15, hueHighMin: 345, saturationMin: 0.2, brightnessMax: 0.9 }),
  green: Object.freeze({ hueMin: 90, hueMax: 160, saturationMin: 0.18, brightnessMax: 0.9 })
});
export const DEFAULT_PROCESSING_SETTINGS = Object.freeze({
  ink: 'blue', sensitivity: 0.58, noiseRemoval: 0.45, cropMargin: 12,
  strokeThickness: 0, outputSize: 1024, lightingStrength: 0.72
});
export const OUTPUT_SIZES = Object.freeze([512, 1024, 2048, 'original']);
export const MAX_INPUT_BYTES = 24 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 28_000_000;
