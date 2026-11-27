import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdfLibraries() {
  const { PDFDocument } = await import('pdf-lib');
  return { pdfjs, PDFDocument };
}
