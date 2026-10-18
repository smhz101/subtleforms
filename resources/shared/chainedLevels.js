/**
 * Editing helpers for chained (dependent) dropdowns.
 *
 * A level is one dropdown. Choices after the first name their parent with
 * `option.parent`, which is the previous dropdown's choice value.
 */

export function slugifyChoice(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function normalizeLevels(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((level) => ({
    label: typeof level?.label === 'string' ? level.label : '',
    options: Array.isArray(level?.options)
      ? level.options
          .filter((option) => option && typeof option === 'object')
          .map((option) => {
            const next = {
              label: option.label == null ? '' : String(option.label),
              value: option.value == null ? '' : String(option.value),
            };
            if (option.parent != null && option.parent !== '') {
              next.parent = String(option.parent);
            }
            return next;
          })
      : [],
  }));
}

function usedValues(options) {
  return new Set((options || []).map((option) => String(option?.value ?? '')));
}

export function uniqueValue(options, base) {
  const used = usedValues(options);
  const root = base || 'choice';
  if (!used.has(root)) {
    return root;
  }
  let index = 2;
  while (used.has(`${root}_${index}`)) {
    index += 1;
  }
  return `${root}_${index}`;
}

export function makeChoice(options, label, parent) {
  const text = String(label || '').trim();
  const value = uniqueValue(options, slugifyChoice(text) || `choice_${(options || []).length + 1}`);
  const choice = {
    label: text || `Choice ${(options || []).length + 1}`,
    value,
  };
  if (parent) {
    choice.parent = String(parent);
  }
  return choice;
}

/**
 * Choices in one dropdown that belong to the selected parent.
 * The first dropdown always returns every choice.
 */
export function choicesForParent(levels, depth, parentValue) {
  const options = levels?.[depth]?.options || [];
  if (depth <= 0) {
    return options;
  }
  if (parentValue == null || parentValue === '') {
    return [];
  }
  return options.filter((option) => String(option.parent) === String(parentValue));
}

export function addLevel(levels) {
  return [...normalizeLevels(levels), { label: '', options: [] }];
}

export function removeLevel(levels, depth) {
  // Later dropdowns name a parent in this one, so they go with it.
  return normalizeLevels(levels).slice(0, depth);
}

export function setLevelLabel(levels, depth, label) {
  const next = normalizeLevels(levels);
  if (!next[depth]) {
    return next;
  }
  next[depth] = { ...next[depth], label };
  return next;
}

export function addChoice(levels, depth, parentValue) {
  const next = normalizeLevels(levels);
  const level = next[depth];
  if (!level) {
    return next;
  }
  const choice = makeChoice(level.options, '', depth > 0 ? parentValue : undefined);
  next[depth] = { ...level, options: [...level.options, choice] };
  return next;
}

export function renameChoice(levels, depth, value, label) {
  const next = normalizeLevels(levels);
  const level = next[depth];
  if (!level) {
    return next;
  }
  next[depth] = {
    ...level,
    options: level.options.map((option) =>
      String(option.value) === String(value) ? { ...option, label } : option
    ),
  };
  return next;
}

/**
 * Remove a choice and every later choice that depended on it.
 */
export function removeChoice(levels, depth, value) {
  const next = normalizeLevels(levels);
  if (!next[depth]) {
    return next;
  }
  let gone = new Set([String(value)]);
  next[depth] = {
    ...next[depth],
    options: next[depth].options.filter((option) => String(option.value) !== String(value)),
  };
  for (let index = depth + 1; index < next.length; index += 1) {
    const dropped = [];
    const options = next[index].options.filter((option) => {
      if (gone.has(String(option.parent))) {
        dropped.push(String(option.value));
        return false;
      }
      return true;
    });
    next[index] = { ...next[index], options };
    gone = new Set(dropped);
  }
  return next;
}

function lineDepth(line) {
  const tabs = (line.match(/^\t*/) || [''])[0].length;
  const afterTabs = line.slice(tabs);
  const spaces = (afterTabs.match(/^ */) || [''])[0].length;
  return tabs + Math.floor(spaces / 2);
}

/**
 * Turn an indented list into dropdown levels.
 *
 * One choice per line. Two spaces, or one tab, nest it under the choice above.
 * Existing dropdown names are kept. Returns null when the text has no choices.
 */
export function levelsFromIndented(text, existing = []) {
  const rows = [];
  String(text || '').split(/\r?\n/).forEach((line) => {
    if (!line.trim()) {
      return;
    }
    rows.push({ label: line.trim(), depth: lineDepth(line) });
  });
  if (rows.length === 0) {
    return null;
  }

  const previous = normalizeLevels(existing);
  const levels = [];
  const stack = [];

  rows.forEach((row) => {
    let depth = row.depth;
    if (stack.length === 0) {
      depth = 0;
    } else if (depth > stack[stack.length - 1].depth + 1) {
      depth = stack[stack.length - 1].depth + 1;
    }
    while (stack.length && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    while (levels.length <= depth) {
      const index = levels.length;
      levels.push({
        label: previous[index]?.label || '',
        options: [],
      });
    }
    const parent = depth > 0 ? stack[stack.length - 1].value : undefined;
    const choice = makeChoice(levels[depth].options, row.label, parent);
    levels[depth].options.push(choice);
    stack.push({ depth, value: choice.value });
  });

  return levels;
}
