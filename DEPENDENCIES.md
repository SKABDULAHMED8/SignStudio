# Third-party dependencies and licenses

| Package | Role | License |
|---|---|---|
| `vite` | Development server and static build | MIT |
| `@playwright/test` | Chromium end-to-end browser tests | Apache-2.0 |
| `pdfjs-dist` | Lazy-loaded PDF parsing and rendering | Apache-2.0 |
| `pdf-lib` | Lazy-loaded PDF form editing and export | MIT |

The application uses browser-native Canvas, Web Workers, Pointer Events and File APIs. It does not use IndexedDB, Cache Storage, Service Workers or persistent browser storage. The unit suite uses Node.js built-in `node:test`; no test runner package is required.

All runtime dependencies are installed from npm during development and bundled into the static build. PDF libraries are loaded only when the PDF workspace is opened. No package is loaded from a CDN. Application icons, the web app manifest and social preview assets are stored locally under `public/`; no remote icon library or font is used.

License statements above describe the declared package licenses. Check installed package notices and transitive dependency notices before redistributing a public build. `package-lock.json` is committed. Use `npm ci` to install the exact locked dependency tree.
