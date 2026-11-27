import { processSignature } from '../processing/pipeline.js';

self.addEventListener('message', event => {
  const { id, imageData, settings } = event.data ?? {};
  try {
    const result = processSignature(imageData, settings);
    self.postMessage({ id, result }, [result.image.data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: { message: error.message, name: error.name } });
  }
});
