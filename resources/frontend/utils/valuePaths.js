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
  const isIndex = /^\d+$/.test(head || '');
  // Repeater groups live in arrays (`items.0.qty`): keep them arrays.
  const safeObj =
    obj && typeof obj === 'object' ? obj : isIndex ? [] : {};

  if (!head) {
    return safeObj;
  }

  const clone = Array.isArray(safeObj) ? [...safeObj] : { ...safeObj };

  if (tail.length === 0) {
    // Only clone at the leaf.
    clone[head] = value;
    return clone;
  }

  const nextIsIndex = /^\d+$/.test(tail[0]);
  const child = safeObj[head];
  clone[head] = setInObject(
    child && typeof child === 'object' ? child : nextIsIndex ? [] : {},
    tail,
    value
  );

  // Only clone objects along the updated path.
  return clone;
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

/**
 * Remove the value at a dotted path (`items.1.qty`) without mutating the
 * input. Missing paths return the input unchanged.
 */
export function deleteIn(obj, path) {
  const segments = toPathSegments(path);
  if (!segments.length || !obj || typeof obj !== 'object') return obj;
  const [head, ...tail] = segments;
  if (!(head in obj)) return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  if (!tail.length) {
    if (Array.isArray(clone)) clone[head] = undefined;
    else delete clone[head];
    return clone;
  }
  clone[head] = deleteIn(obj[head], tail);
  return clone;
}
