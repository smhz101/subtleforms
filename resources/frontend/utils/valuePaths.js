export function isDevBuild() {
  // wp-scripts defines NODE_ENV for builds/tests.
  return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
}

export function toPathSegments(path) {
  if (Array.isArray(path)) {
    return path.map(String).filter(Boolean);
  }

  if (typeof path !== 'string') {
    return [];
  }

  const trimmed = path.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getIn(obj, path, defaultValue = undefined) {
  const segments = toPathSegments(path);
  if (segments.length === 0) {
    return defaultValue;
  }

  let cursor = obj;
  for (const seg of segments) {
    if (cursor === null || cursor === undefined) {
      return defaultValue;
    }
    if (typeof cursor !== 'object') {
      return defaultValue;
    }
    cursor = cursor[seg];
  }

  return cursor === undefined ? defaultValue : cursor;
}

function setInObject(obj, segments, value) {
  const [head, ...tail] = segments;
  const safeObj = obj && typeof obj === 'object' ? obj : {};

  if (!head) {
    return safeObj;
  }

  if (tail.length === 0) {
    // Only clone at the leaf.
    return {
      ...safeObj,
      [head]: value,
    };
  }

  const nextChild = setInObject(safeObj[head], tail, value);

  // Only clone objects along the updated path.
  return {
    ...safeObj,
    [head]: nextChild,
  };
}

export function setIn(obj, path, value) {
  const segments = toPathSegments(path);
  if (segments.length === 0) {
    return obj;
  }

  return setInObject(obj, segments, value);
}

export function flattenToPathMap(values) {
  const out = {};

  const walk = (node, prefix) => {
    if (node === null || node === undefined) {
      return;
    }

    // Treat arrays/objects as nested; everything else is a leaf.
    if (typeof node !== 'object') {
      if (prefix) {
        out[prefix] = node;
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((value, idx) => {
        const nextPrefix = prefix ? `${prefix}.${idx}` : String(idx);
        walk(value, nextPrefix);
      });
      return;
    }

    Object.keys(node).forEach((k) => {
      const nextPrefix = prefix ? `${prefix}.${k}` : k;
      walk(node[k], nextPrefix);
    });
  };

  walk(values, '');
  return out;
}
