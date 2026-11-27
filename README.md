# SignStudio

SignStudio is a browser-based tool for creating transparent digital signatures and filling PDF forms. Files are processed in the browser and are not uploaded to a SignStudio server.

**Planned live URL:** https://skabdulahmed8.github.io/SignStudio/  
**Status:** Release preparation in progress. Do not publish this archive until the remaining privacy-workflow refactor and full test suite are complete.

## Requirements

- Node.js 22 LTS or newer
- npm

## Run locally

```powershell
npm ci
npm run dev
```

The Vite base path is `/SignStudio/`. For a local Pages-path preview, run:

```powershell
npm run build
npm run preview
```

Open `http://localhost:4173/SignStudio/`.

## Tests

```powershell
npm test
npm run test:e2e
npm run test:all
```

## Privacy

The intended workflow is Upload → Convert → Edit → Save → Close. Files should remain in browser memory until the user downloads them. No account or server upload is required. The current archive still contains legacy persistence code and is not yet compliant with this target. Do not use it with sensitive documents until that code has been removed and the storage audit has passed.

## License

MIT. See [LICENSE](LICENSE).
