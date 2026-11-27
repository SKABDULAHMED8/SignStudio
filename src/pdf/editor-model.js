const TYPES = new Set(['text', 'character-grid', 'tick', 'cross', 'date', 'signature', 'photo']);
const id = () => globalThis.crypto?.randomUUID?.() ?? `placement-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createPlacement({ type, pageIndex, bounds, ...properties }) {
  if (!TYPES.has(type)) throw new TypeError(`Unsupported placement type: ${type}`);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) throw new TypeError('A placement needs a valid page index.');
  const placement = { id: id(), type, pageIndex, bounds: { ...bounds }, ...properties };
  validatePlacement(placement);
  return placement;
}

export function validatePlacement(placement, pageSize = null) {
  if (!placement || !TYPES.has(placement.type)) throw new TypeError('Unsupported placement type.');
  if (!Number.isInteger(placement.pageIndex) || placement.pageIndex < 0) throw new TypeError('A placement needs a valid page index.');
  const b = placement.bounds;
  if (!b || ![b.x,b.y,b.width,b.height].every(Number.isFinite) || b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0) throw new RangeError('Placement bounds are invalid.');
  if (pageSize && (b.x + b.width > pageSize.width + 0.01 || b.y + b.height > pageSize.height + 0.01)) throw new RangeError('Placement bounds exceed the page bounds.');
  return true;
}

export function distributeCharacters(value, cells, { uppercase = false, preserveSpaces = false } = {}) {
  if (!Array.isArray(cells)) throw new TypeError('Character cells must be an array.');
  const chars = Array.from(String(value ?? ''));
  const output = [];
  let ignoredSpaces = 0;
  for (const character of chars) {
    if (character === ' ' && !preserveSpaces) { ignoredSpaces++; continue; }
    if (output.length >= cells.length) break;
    output.push(character);
  }
  const normalized = uppercase ? output.map(character => character.toLocaleUpperCase()) : output;
  return {
    cells: normalized.map((character, index) => ({ character, bounds: { ...cells[index] } })),
    overflow: Math.max(0, chars.filter(character => preserveSpaces || character !== ' ').length - cells.length),
    ignoredSpaces
  };
}
