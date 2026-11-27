function luminance(data, offset) {
  return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

/**
 * Detects axis-aligned printed rectangles from a raster page.
 * Input and output are local-only. Bounds use a top-left page origin and
 * are scaled into the supplied page dimensions.
 */
export function detectFormGeometry(imageData, { pageWidth, pageHeight, threshold = 150, minArea = 250, minLineCoverage = 0.2 } = {}) {
  const { width, height, data } = imageData ?? {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !data || data.length !== width * height * 4) throw new TypeError('A valid RGBA image is required.');
  if (!(pageWidth > 0) || !(pageHeight > 0)) throw new TypeError('Valid page dimensions are required.');
  const rowRuns = [], colRuns = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) if (luminance(data, (y * width + x) * 4) < threshold) count++;
    if (count >= width * minLineCoverage) rowRuns.push(y);
  }
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) if (luminance(data, (y * width + x) * 4) < threshold) count++;
    if (count >= height * minLineCoverage) colRuns.push(x);
  }
  const groups = values => {
    const result = [];
    for (const value of values) {
      const last = result.at(-1);
      if (!last || value > last.end + 2) result.push({ start: value, end: value });
      else last.end = value;
    }
    return result;
  };
  const rows = groups(rowRuns).sort((a,b)=>(b.end-b.start)-(a.end-a.start)).slice(0, 32).sort((a,b)=>a.start-b.start);
  const cols = groups(colRuns).sort((a,b)=>(b.end-b.start)-(a.end-a.start)).slice(0, 32).sort((a,b)=>a.start-b.start);
  const regions = [];
  for (let yi = 0; yi < rows.length - 1; yi++) for (let yj = yi + 1; yj < rows.length; yj++) {
    const top = rows[yi].start, bottom = rows[yj].end;
    if (bottom - top < 6) continue;
    for (let xi = 0; xi < cols.length - 1; xi++) for (let xj = xi + 1; xj < cols.length; xj++) {
      const left = cols[xi].start, right = cols[xj].end;
      const pixelArea = (right - left) * (bottom - top);
      if (pixelArea < minArea) continue;
      const edgeCoverage = (lineCoverage(data, width, height, left, right, top, bottom));
      if (edgeCoverage < 0.68) continue;
      const bounds = {
        x: left / width * pageWidth,
        y: top / height * pageHeight,
        width: (right - left) / width * pageWidth,
        height: (bottom - top) / height * pageHeight
      };
      if (regions.some(region => overlaps(region.bounds, bounds, 0.85))) continue;
      regions.push({ id: `detected-${regions.length + 1}`, kind: 'rectangle', bounds, confidence: Math.min(0.99, 0.55 + edgeCoverage * 0.44), source: 'raster-geometry' });
    }
  }
  return { regions, horizontalLines: rows.length, verticalLines: cols.length, imageWidth: width, imageHeight: height };
}

function lineCoverage(data, width, height, left, right, top, bottom) {
  let hits = 0, total = 0;
  const sample = (x, y) => { total++; if (luminance(data, (y * width + x) * 4) < 150) hits++; };
  const strideX = Math.max(1, Math.ceil((right-left)/24)), strideY = Math.max(1, Math.ceil((bottom-top)/24));
  for (let x=left; x<=right; x+=strideX) { sample(x,top); sample(x,bottom); }
  for (let y=top; y<=bottom; y+=strideY) { sample(left,y); sample(right,y); }
  return total ? hits / total : 0;
}
function overlaps(a,b,ratio) {
  const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const intersection=x*y, smaller=Math.min(a.width*a.height,b.width*b.height);
  return smaller > 0 && intersection/smaller > ratio;
}
