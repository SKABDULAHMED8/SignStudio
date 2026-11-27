import { detectFormGeometry } from './form-detection.js';

self.addEventListener('message', event => {
  const { id, imageData, options } = event.data ?? {};
  try {
    const result = detectFormGeometry(imageData, options);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: { name: error.name, message: error.message } });
  }
});
