import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const target = new URL('../tests/fixtures/transparent-pixel-fixture.json', import.meta.url);
await mkdir(dirname(target.pathname), { recursive: true });
const fixture = { width: 4, height: 1, pixels: [[255,255,255,255],[25,65,210,255],[80,120,220,150],[255,255,255,255]] };
await writeFile(target, JSON.stringify(fixture, null, 2));
console.log(`Wrote ${target.pathname}`);
