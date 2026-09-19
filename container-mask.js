(function exposeContainerMask(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ContainerMask = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  function floodSelect(rgba, width, height, startX, startY, tolerance = 0) {
    const size = width * height;
    const selected = new Uint8Array(size);
    const x = Math.floor(startX);
    const y = Math.floor(startY);
    if (!rgba || width < 1 || height < 1 || rgba.length < size * 4 || x < 0 || x >= width || y < 0 || y >= height) return selected;

    const start = y * width + x;
    const source = start * 4;
    const threshold = Math.max(0, Math.min(100, Number(tolerance) || 0)) * 2.55;
    const visited = new Uint8Array(size);
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;

    function matches(index) {
      const offset = index * 4;
      return Math.abs(rgba[offset] - rgba[source]) <= threshold
        && Math.abs(rgba[offset + 1] - rgba[source + 1]) <= threshold
        && Math.abs(rgba[offset + 2] - rgba[source + 2]) <= threshold
        && Math.abs(rgba[offset + 3] - rgba[source + 3]) <= threshold;
    }

    while (head < tail) {
      const index = queue[head++];
      if (!matches(index)) continue;
      selected[index] = 1;
      const px = index % width;
      const neighbours = [index - width, index + 1, index + width, index - 1];
      for (let direction = 0; direction < 4; direction++) {
        const next = neighbours[direction];
        if (next < 0 || next >= size || visited[next]) continue;
        if ((direction === 1 && px === width - 1) || (direction === 3 && px === 0)) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    return selected;
  }

  function paintCircle(mask, width, height, centerX, centerY, radius, value) {
    const safeRadius = Math.max(0, Number(radius) || 0);
    const left = Math.max(0, Math.floor(centerX - safeRadius));
    const right = Math.min(width - 1, Math.ceil(centerX + safeRadius));
    const top = Math.max(0, Math.floor(centerY - safeRadius));
    const bottom = Math.min(height - 1, Math.ceil(centerY + safeRadius));
    const squared = safeRadius * safeRadius;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        if ((x - centerX) ** 2 + (y - centerY) ** 2 <= squared) mask[y * width + x] = value ? 1 : 0;
      }
    }
  }

  function largestRegion(mask, width, height) {
    const size = width * height;
    const labels = new Int32Array(size);
    const queue = new Int32Array(size);
    const counts = [0];
    let label = 0;
    for (let start = 0; start < size; start++) {
      if (!mask[start] || labels[start]) continue;
      label++;
      let head = 0;
      let tail = 1;
      queue[0] = start;
      labels[start] = label;
      while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        const neighbours = [index - width, index + 1, index + width, index - 1];
        for (let direction = 0; direction < 4; direction++) {
          const next = neighbours[direction];
          if (next < 0 || next >= size || !mask[next] || labels[next]) continue;
          if ((direction === 1 && x === width - 1) || (direction === 3 && x === 0)) continue;
          labels[next] = label;
          queue[tail++] = next;
        }
      }
      counts[label] = tail;
    }
    let best = 0;
    for (let current = 1; current < counts.length; current++) {
      if (counts[current] > (counts[best] || 0)) best = current;
    }
    const output = new Uint8Array(size);
    if (!best) return output;
    for (let index = 0; index < size; index++) output[index] = labels[index] === best ? 1 : 0;
    return output;
  }

  function fillHoles(mask, width, height) {
    const size = width * height;
    const outside = new Uint8Array(size);
    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;
    function add(index) {
      if (index < 0 || index >= size || mask[index] || outside[index]) return;
      outside[index] = 1;
      queue[tail++] = index;
    }
    for (let x = 0; x < width; x++) {
      add(x);
      add((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      add(y * width);
      add(y * width + width - 1);
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      add(index - width);
      if (x < width - 1) add(index + 1);
      add(index + width);
      if (x > 0) add(index - 1);
    }
    const output = mask.slice();
    for (let index = 0; index < size; index++) {
      if (!mask[index] && !outside[index]) output[index] = 1;
    }
    return output;
  }

  function cleanMask(mask, width, height) {
    if (!mask || width < 1 || height < 1 || mask.length < width * height) return new Uint8Array(0);
    return fillHoles(largestRegion(mask, width, height), width, height);
  }

  function resizeMask(mask, width, height, maximumDimension) {
    const scale = Math.min(1, maximumDimension / Math.max(width, height));
    const nextWidth = Math.max(1, Math.round(width * scale));
    const nextHeight = Math.max(1, Math.round(height * scale));
    if (nextWidth === width && nextHeight === height) return { mask: mask.slice(), width, height };
    const selected = new Uint32Array(nextWidth * nextHeight);
    const totals = new Uint32Array(nextWidth * nextHeight);
    for (let y = 0; y < height; y++) {
      const nextY = Math.min(nextHeight - 1, Math.floor(y * nextHeight / height));
      for (let x = 0; x < width; x++) {
        const nextX = Math.min(nextWidth - 1, Math.floor(x * nextWidth / width));
        const target = nextY * nextWidth + nextX;
        totals[target]++;
        selected[target] += mask[y * width + x] ? 1 : 0;
      }
    }
    const output = new Uint8Array(nextWidth * nextHeight);
    for (let index = 0; index < output.length; index++) output[index] = selected[index] * 2 >= totals[index] ? 1 : 0;
    return { mask: output, width: nextWidth, height: nextHeight };
  }

  function traceBoundary(mask, width, height) {
    const edges = [];
    const starts = new Map();
    function add(x1, y1, x2, y2) {
      const index = edges.length;
      edges.push({ x1, y1, x2, y2 });
      const key = `${x1},${y1}`;
      if (!starts.has(key)) starts.set(key, []);
      starts.get(key).push(index);
    }
    function filled(x, y) {
      return x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x];
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!filled(x, y)) continue;
        if (!filled(x, y - 1)) add(x, y, x + 1, y);
        if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
        if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
        if (!filled(x - 1, y)) add(x, y + 1, x, y);
      }
    }
    const used = new Uint8Array(edges.length);
    let longest = [];
    for (let startIndex = 0; startIndex < edges.length; startIndex++) {
      if (used[startIndex]) continue;
      const first = edges[startIndex];
      const loop = [[first.x1, first.y1]];
      let edgeIndex = startIndex;
      while (!used[edgeIndex]) {
        const edge = edges[edgeIndex];
        used[edgeIndex] = 1;
        loop.push([edge.x2, edge.y2]);
        if (edge.x2 === first.x1 && edge.y2 === first.y1) break;
        const candidates = starts.get(`${edge.x2},${edge.y2}`) || [];
        edgeIndex = candidates.find(candidate => !used[candidate]);
        if (edgeIndex == null) break;
      }
      if (loop.length > longest.length && loop.at(-1)[0] === loop[0][0] && loop.at(-1)[1] === loop[0][1]) longest = loop.slice(0, -1);
    }
    return longest;
  }

  function perpendicularDistance(point, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    if (!dx && !dy) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    const progress = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point[0] - start[0] - progress * dx, point[1] - start[1] - progress * dy);
  }

  function simplifyOpen(points, tolerance) {
    if (points.length <= 2) return points.slice();
    let farthest = 0;
    let farthestDistance = 0;
    for (let index = 1; index < points.length - 1; index++) {
      const distance = perpendicularDistance(points[index], points[0], points.at(-1));
      if (distance > farthestDistance) {
        farthest = index;
        farthestDistance = distance;
      }
    }
    if (farthestDistance <= tolerance) return [points[0], points.at(-1)];
    return simplifyOpen(points.slice(0, farthest + 1), tolerance).slice(0, -1)
      .concat(simplifyOpen(points.slice(farthest), tolerance));
  }

  function simplifyClosed(points, maximumPoints) {
    if (points.length <= maximumPoints) return points;
    let first = 0;
    let second = 1;
    let farthest = -1;
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        const distance = (points[a][0] - points[b][0]) ** 2 + (points[a][1] - points[b][1]) ** 2;
        if (distance > farthest) {
          farthest = distance;
          first = a;
          second = b;
        }
      }
    }
    const chainA = [];
    for (let index = first; ; index = (index + 1) % points.length) {
      chainA.push(points[index]);
      if (index === second) break;
    }
    const chainB = [];
    for (let index = second; ; index = (index + 1) % points.length) {
      chainB.push(points[index]);
      if (index === first) break;
    }
    let tolerance = .5;
    let simplified = points;
    while (simplified.length > maximumPoints && tolerance < 64) {
      simplified = simplifyOpen(chainA, tolerance).slice(0, -1).concat(simplifyOpen(chainB, tolerance).slice(0, -1));
      tolerance *= 1.35;
    }
    return simplified;
  }

  function pointInPolygon(point, polygon) {
    if (!Array.isArray(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const [x, y] = polygon[index];
      const [previousX, previousY] = polygon[previous];
      if ((y > point[1]) !== (previousY > point[1])
        && point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x) inside = !inside;
    }
    return inside;
  }

  function buildContainerDefinition(mask, width, height, options = {}) {
    const resized = resizeMask(mask, width, height, options.maximumDimension || 160);
    const cleaned = cleanMask(resized.mask, resized.width, resized.height);
    let filledCount = 0;
    for (const value of cleaned) filledCount += value;
    if (filledCount < 4) return null;
    const boundary = simplifyClosed(traceBoundary(cleaned, resized.width, resized.height), options.maximumPoints || 96);
    if (boundary.length < 3) return null;
    const polygon = boundary.map(([x, y]) => [x / resized.width, y / resized.height]);
    const centerX = resized.width / 2;
    const centerY = resized.height / 2;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < cleaned.length; index++) {
      if (!cleaned[index]) continue;
      const x = index % resized.width;
      const y = Math.floor(index / resized.width);
      const distance = (x + .5 - centerX) ** 2 + (y + .5 - centerY) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return {
      polygon,
      spawn: [((bestIndex % resized.width) + .5) / resized.width, (Math.floor(bestIndex / resized.width) + .5) / resized.height]
    };
  }

  function wallPoints(definition, width, height) {
    if (!definition || !Array.isArray(definition.polygon)) return [];
    return definition.polygon.map(([x, y]) => [x * width, y * height]);
  }

  return { floodSelect, paintCircle, cleanMask, buildContainerDefinition, pointInPolygon, wallPoints };
});
