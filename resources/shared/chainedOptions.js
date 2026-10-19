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
export function chainedSelectLevels(config, selections = [], settings = {}) {
  const cfg = config && typeof config === 'object' ? config : {};
  const selected = Array.isArray(selections) ? selections : [];
  const levels = Array.isArray(cfg.levels) ? cfg.levels : null;

  const optionsForLevel = (depth) => {
    if (levels) {
      const options = Array.isArray(levels[depth]?.options) ? levels[depth].options : [];
      // A later dropdown is chained when its choices name a parent choice.
      // Older fields with no parent links keep showing every choice.
      if (depth === 0 || !options.some((opt) => opt && opt.parent)) {
        return options;
      }
      const parent = selected[depth - 1];
      if (parent === undefined || parent === null || parent === '') {
        return [];
      }
      return options.filter((opt) => String(opt?.parent) === String(parent));
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

  const includeEmpty = settings.includeEmpty === true && Array.isArray(levels);
  const rows = [];
  for (let depth = 0; depth < levelCount; depth++) {
    const levelOptions = optionsForLevel(depth);
    const list = Array.isArray(levelOptions) ? levelOptions : [];
    if (list.length === 0 && !includeEmpty) {
      continue;
    }
    rows.push({
      depth,
      label: levels?.[depth]?.label || '',
      options: list,
    });
  }
  return rows;
}

/**
 * The first level a required chained field still needs: a level that offers
 * choices for the answers so far but has no valid answer. Every level with
 * choices must be answered, not only the first (FLD2-10). Mirrors
 * FieldValidator::chainedMissingLevel() on the server.
 *
 * @param {Object} config     Field settings.
 * @param {Array}  selections Answer, one choice per level.
 * @return {number} Depth of the first unanswered level, or -1.
 */
export function firstUnansweredChainedLevel(config, selections) {
  const selected = Array.isArray(selections) ? selections : [];
  const rows = chainedSelectLevels(config, selected);
  for (const row of rows) {
    const answer = selected[row.depth];
    const valid =
      answer !== undefined &&
      answer !== null &&
      String(answer) !== '' &&
      row.options.some((opt) => String(opt?.value) === String(answer));
    if (!valid) {
      return row.depth;
    }
  }
  return -1;
}

/**
 * Columns show every list at once. With nothing chosen yet, the first choice
 * in the first list is the parent the other lists follow. This is only what
 * is shown: it is never written into the answer (FLD2-09).
 *
 * @param {Object} config Field settings.
 * @param {Array} [selections] Current choices.
 * @return {Array}
 */
export function defaultChainedColumnSelections(config, selections = []) {
  const selected = Array.isArray(selections) ? selections : [];
  if (selected[0] !== undefined && selected[0] !== null && String(selected[0]) !== '') {
    return selected;
  }
  const first = Array.isArray(config?.levels?.[0]?.options)
    ? config.levels[0].options.find((opt) => opt && opt.value !== undefined && String(opt.value) !== '')
    : null;
  return first ? [first.value] : selected;
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

/**
 * How dependent choices are drawn. Unknown values stay dropdowns.
 *
 * @param {Object} config Field settings.
 * @return {'dropdowns'|'buttons'|'columns'}
 */
export function chainedPresentation(config) {
  const value = config && typeof config === 'object' ? config.presentation : undefined;
  return value === 'buttons' || value === 'columns' ? value : 'dropdowns';
}
