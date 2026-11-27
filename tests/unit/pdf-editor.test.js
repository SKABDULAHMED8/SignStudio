import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlacement, distributeCharacters, validatePlacement } from '../../src/pdf/editor-model.js';
import { PlacementHistory } from '../../src/pdf/history.js';
import { detectFormGeometry } from '../../src/pdf/form-detection.js';

test('character grid distributes one character into each cell and reports overflow', () => {
  const result = distributeCharacters('ab cdef', Array.from({length: 5}, (_, i) => ({ x: i * 10, y: 0, width: 8, height: 12 })), { uppercase: true });
  assert.deepEqual(result.cells.map(cell => cell.character), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(result.overflow, 1);
  assert.equal(result.ignoredSpaces, 1);
});

test('placement model rejects invalid page bounds and creates stable typed placements', () => {
  const item = createPlacement({ type: 'tick', pageIndex: 0, bounds: { x: 10, y: 20, width: 12, height: 12 } });
  assert.equal(item.type, 'tick');
  assert.ok(item.id);
  assert.equal(validatePlacement(item, { width: 100, height: 100 }), true);
  assert.throws(() => createPlacement({ type: 'unknown', pageIndex: 0, bounds: { x: 0, y: 0, width: 1, height: 1 } }), /type/i);
  assert.throws(() => validatePlacement({ ...item, bounds: { x: 99, y: 0, width: 5, height: 5 } }, { width: 100, height: 100 }), /bounds/i);
});

test('placement history supports undo, redo and clears redo after a new command', () => {
  const history = new PlacementHistory();
  history.execute({ do: state => [...state, 'a'], undo: state => state.filter(x => x !== 'a') });
  history.execute({ do: state => [...state, 'b'], undo: state => state.filter(x => x !== 'b') });
  assert.deepEqual(history.undo(['a', 'b']), ['a']);
  assert.deepEqual(history.redo(['a']), ['a', 'b']);
  history.undo(['a', 'b']);
  history.execute({ do: state => [...state, 'c'], undo: state => state.filter(x => x !== 'c') });
  assert.equal(history.canRedo, false);
});

test('detector finds a rectangular printed box in a binary raster and returns page-space geometry', () => {
  const width = 100, height = 70, data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i*4]=255; data[i*4+1]=255; data[i*4+2]=255; data[i*4+3]=255; }
  for (let x=20;x<=70;x++) for (const y of [15,45]) data[(y*width+x)*4]=data[(y*width+x)*4+1]=data[(y*width+x)*4+2]=0;
  for (let y=15;y<=45;y++) for (const x of [20,70]) data[(y*width+x)*4]=data[(y*width+x)*4+1]=data[(y*width+x)*4+2]=0;
  const result = detectFormGeometry({ width, height, data }, { pageWidth: 500, pageHeight: 350, minArea: 100 });
  assert.ok(result.regions.some(region => Math.abs(region.bounds.x - 100) < 15 && Math.abs(region.bounds.y - 75) < 15 && region.bounds.width > 200 && region.bounds.height > 100));
});

