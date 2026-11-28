import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const ROOT = new URL('../../', import.meta.url);
const text = async path => readFile(new URL(path, ROOT), 'utf8');

test('GitHub Pages SEO metadata and chat previews use the canonical public URL', async () => {
  const html = await text('index.html');
  assert.match(html, /<html lang="en">/);
  assert.ok(html.includes('rel="canonical" href="https://skabdulahmed8.github.io/SignStudio/"'));
  assert.ok(html.includes('href="/SignStudio/favicon.svg"'));
  assert.ok(html.includes('type="image/svg+xml"'));
  assert.ok(html.includes('href="/SignStudio/site.webmanifest"'));
  assert.ok(html.includes('property="og:site_name" content="SignStudio"'));
  assert.ok(html.includes('property="og:image:width" content="1200"'));
  assert.ok(html.includes('property="og:image:height" content="630"'));
  assert.ok(html.includes('https://skabdulahmed8.github.io/SignStudio/social-preview.png'));
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.match(html, /"@type":\s*"SoftwareApplication"/);
  assert.match(html, /How it works/);
  assert.match(html, /Privacy/);
  assert.match(html, /SignStudio questions/);
  assert.match(html, /not a general-purpose photo cutout tool/i);
  assert.match(html, /Draw and place handwritten signatures on PDF pages/);
});

test('robots, sitemap, manifest and AI discovery file use the GitHub Pages URL', async () => {
  const robots = await text('public/robots.txt');
  const sitemap = await text('public/sitemap.xml');
  const manifest = await text('public/site.webmanifest');
  const llms = await text('public/llms.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/skabdulahmed8\.github\.io\/SignStudio\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/skabdulahmed8\.github\.io\/SignStudio\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-11-28<\/lastmod>/);
  assert.match(manifest, /"start_url": "\/SignStudio\//);
  assert.match(manifest, /icon-192\.png/);
  assert.match(llms, /SignStudio/);
  assert.match(llms, /does not upload/i);
  assert.match(llms, /Handwritten Signature/);
});

test('required local branding assets exist', async () => {
  for (const path of ['public/logo.svg','public/favicon.svg','public/favicon.ico','public/apple-touch-icon.png','public/icon-192.png','public/icon-512.png','public/social-preview.png']) {
    assert.ok((await stat(new URL(path, ROOT))).size > 0, path + ' must exist');
  }
  for (const [path, width, height] of [['public/apple-touch-icon.png',180,180],['public/icon-192.png',192,192],['public/icon-512.png',512,512],['public/social-preview.png',1200,630]]) {
    const png = await readFile(new URL(path, ROOT));
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', path + ' must be a PNG');
    assert.equal(png.readUInt32BE(16), width, path + ' width');
    assert.equal(png.readUInt32BE(20), height, path + ' height');
  }
});

test('GitHub Pages deployment builds before preview E2E and uploads only the verified dist output', async () => {
  const workflow = await text('.github/workflows/deploy.yml');
  const build = workflow.indexOf('npm run build');
  const e2e = workflow.indexOf('npm run test:e2e');
  const artifact = workflow.indexOf('actions/upload-pages-artifact@v3');
  assert.ok(build >= 0 && e2e > build && artifact > e2e, 'build must precede preview tests, which must precede artifact upload');
  assert.match(workflow, /branches:\s*\[main\]/);
});
