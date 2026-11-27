import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { StrokeHistory } from '../../src/signature/draw/strokes.js';

describe('StrokeHistory', () => {
  test('supports undo and redo without mutating stored strokes', () => {
    const history = new StrokeHistory();
    history.add([{ x: 1, y: 1, pressure: 0.5 }]);
    history.add([{ x: 2, y: 2, pressure: 1 }]);
    assert.equal(history.current.length, 2);
    history.undo(); assert.equal(history.current.length, 1);
    history.redo(); assert.equal(history.current.length, 2);
  });
});
