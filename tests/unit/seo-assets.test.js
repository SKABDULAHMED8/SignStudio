import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const ROOT = new URL('../../', import.meta.url);
const text = async path => readFile(new URL(path, ROOT), 'utf8');
test('GitHub Pages SEO metadata points to the planned public SignStudio URL', async () => {
  const html = await text('index.html');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /rel="canonical" href="https:\/\/skabdulahmed8\.github\.io\/SignStudio\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:site_name" content="SignStudio"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /rel="icon" href="\\/SignStudio\\/favicon\\.svg" type="image\\/svg\\+xml"/);
  assert.match(html, /rel="manifest" href="\\/SignStudio\\/site\\.webmanifest"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /property="og:image" content="https:\/\/skabdulahmed8\.github\.io\/SignStudio\/social-preview\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /"@type":"SoftwareApplication"/);
  assert.match(html, /How it works/);
  assert.match(html, /Privacy/);
});
test('robots and sitemap point to the GitHub Pages site', async () => {
  const robots = await text('public/robots.txt'); const sitemap = await text('public/sitemap.xml'); const manifest = await text('public/site.webmanifest'); const llms = await text('public/llms.txt');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/skabdulahmed8\.github\.io\/SignStudio\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/skabdulahmed8\.github\.io\/SignStudio\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-11-28<\/lastmod>/);
  assert.match(manifest, /start_url/);
  assert.match(manifest, /icon-192.png/);
  assert.match(llms, /SignStudio/);
  assert.match(llms, /does not upload/i);
});
test('required branding assets exist at their specified dimensions', async () => {
  for (const path of ['public/logo.svg','public/favicon.svg','public/favicon.ico','public/apple-touch-icon.png','public/icon-192.png','public/icon-512.png','public/social-preview.png']) assert.ok((await stat(new URL(path, ROOT))).size > 0, `${path} must exist`);
});
