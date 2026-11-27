# SignStudio functional repair notes

## Root causes addressed

1. The PDF editor only exposed fields discovered as supported AcroForm fields. A printed, flattened or scanned bank form has no interactive AcroForm fields, so the app showed no text-entry controls for its visible boxes.
2. PDF export applied AcroForm values but did not explicitly regenerate field appearance streams before saving. Some PDF viewers can therefore display field values inconsistently.
3. PDF overlay interactions previously handled image/signature placements only. There was no selectable text placement model for a static page.
4. Vertical spacing used mostly fixed values. Heading and footer spacing now responds to viewport height and safe-area insets.

## Changes

- Added a manual text tool to PDF Workspace.
- Users can type text, choose a text size, activate placement mode, click a PDF page, drag the text, and remove the selected placement.
- Manual text is drawn into the exported PDF page. It works for printed, flattened and scanned PDFs without interactive fields.
- Kept existing AcroForm text, checkbox, dropdown, option-list and radio controls.
- Regenerate AcroForm appearance streams after applying values.
- Signature and text placements share selection, drag, keyboard-delete and remove controls.
- Text and signature placement coordinates are scaled when changing PDF page zoom.
- Added unit tests for manual text coordinate conversion.
- Added a Playwright regression test for placing and exporting text on a non-fillable PDF.
- Added responsive heading, footer and PDF tools spacing.
- No dependency changes.
- No storage schema, saved signature format, or encrypted backup format changes.
- No network upload or external service calls added.

## Known limits

- PDF Signature fields, XFA/dynamic forms and certificate-backed digital signatures are not implemented.
- Manual text is page content, not an interactive PDF form field.
- Manual text uses PDF Standard Helvetica. Its character support is limited to the WinAnsi character set. Use ordinary Latin characters for best compatibility; complex scripts may require an embedded Unicode font, which is not included.
- Scanned forms do not provide machine-detectable boxes. Users must place text visually.
- Browser E2E and production build were not run in this environment because dependency installation did not complete. Run `npm ci`, `npm run test:all` and `npm run build` locally before treating this revision as verified.
