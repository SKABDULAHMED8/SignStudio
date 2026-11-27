import { MAX_INPUT_BYTES } from './processing/constants.js';
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif']);
export function validateImageFile(file) {
  if (!file || typeof file.size !== 'number') return { valid: false, code: 'SS-IMG-202', message: 'Choose an image file to continue.' };
  if (!ACCEPTED_TYPES.has(file.type)) return { valid: false, code: 'SS-IMG-202', message: 'This image format is not supported by this browser. Try JPG, PNG or WEBP.' };
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) return { valid: false, code: 'SS-IMG-203', message: 'This image is too large. Choose an image smaller than 24 MB.' };
  return { valid: true };
}
