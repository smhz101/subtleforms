/**
 * Rows for a chained select: one dropdown per depth that has options.
 *
 * `levels` is a fixed list of dropdowns. Without it, `options` is a tree and
 * each choice's `children` are the next dropdown.
 *
 * @param {Object} config Field settings.
 * @param {Array} [selections] Current choices, one per depth.
 * @return {Array<{depth: number, label: string, options: Array}>}
 */
export function chainedSelectLevels(config, selections = []) {
  const cfg = config && typeof config === 'object' ? config : {};
  const selected = Array.isArray(selections) ? selections : [];
  const levels = Array.isArray(cfg.levels) ? cfg.levels : null;

  const optionsForLevel = (depth) => {
    if (levels) {
      return Array.isArray(levels[depth]?.options) ? levels[depth].options : [];
    }

    let nodes = Array.isArray(cfg.options) ? cfg.options : [];
    for (let i = 0; i < depth; i++) {
      const chosen = nodes.find((o) => String(o.value) === String(selected[i]));
      nodes = Array.isArray(chosen?.children) ? chosen.children : [];
    }
    return nodes;
  };

  const levelCount = levels
    ? levels.length
    : // Depth of the tree along the current selection path, plus one more to
      // offer while the user still has somewhere to go.
      selected.reduce((depth, _sel, i) => {
        return optionsForLevel(i + 1).length > 0 ? depth + 1 : depth;
      }, 1);

  const rows = [];
  for (let depth = 0; depth < levelCount; depth++) {
    const options = optionsForLevel(depth);
    if (!Array.isArray(options) || options.length === 0) {
      continue;
    }
    rows.push({
      depth,
      label: levels?.[depth]?.label || '',
      options,
    });
  }
  return rows;
}

/**
 * Selections after one level changes. Choices below that level are dropped.
 *
 * @param {Array} selections Current choices.
 * @param {number} depth Level that changed.
 * @param {string} newValue New choice.
 * @return {Array}
 */
export function nextChainedSelections(selections, depth, newValue) {
  const next = (Array.isArray(selections) ? selections : []).slice(0, depth);
  next[depth] = newValue;
  return next.filter((v) => v !== '');
}
