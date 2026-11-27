export function getCapabilities() {
  return {
    secureContext: Boolean(globalThis.isSecureContext),
    workers: typeof Worker !== 'undefined',
    indexedDB: 'indexedDB' in globalThis,
    webCrypto: Boolean(globalThis.crypto?.subtle),
    folderPicker: typeof globalThis.showSaveFilePicker === 'function',
    serviceWorker: 'serviceWorker' in navigator,
    cameraInput: 'mediaDevices' in navigator && Boolean(navigator.mediaDevices?.getUserMedia)
  };
}
