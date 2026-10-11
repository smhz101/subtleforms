/**
 * Safe formula evaluator for Calculation fields.
 *
 * Mirrors src/Engine/Formula.php exactly: field keys in braces, numbers,
 * + - * / %, brackets, and round/floor/ceil/abs/min/max. No eval — the
 * expression is tokenised and parsed by recursive descent, and anything
 * outside the grammar evaluates to 0. The server recomputes on submit.
 */

import { getIn } from './valuePaths';

function toNumber(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, v) => sum + toNumber(v), 0);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const clean = value.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      tokens.push(['num', expr.slice(i, j)]);
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < expr.length && /[a-zA-Z]/.test(expr[j])) j++;
      tokens.push(['fn', expr.slice(i, j).toLowerCase()]);
      i = j;
      continue;
    }
    if ('+-*/%(),'.includes(c)) {
      tokens.push(['op', c]);
      i++;
      continue;
    }
    throw new Error('Unexpected character');
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const expect = (op) => {
    const t = peek();
    if (!t || t[0] !== 'op' || t[1] !== op) throw new Error(`Expected ${op}`);
    pos++;
  };

  function expression() {
    let v = term();
    for (let t = peek(); t && t[0] === 'op' && (t[1] === '+' || t[1] === '-'); t = peek()) {
      pos++;
      const rhs = term();
      v = t[1] === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  function term() {
    let v = unary();
    for (let t = peek(); t && t[0] === 'op' && '*/%'.includes(t[1]); t = peek()) {
      pos++;
      const rhs = unary();
      if (t[1] === '*') v *= rhs;
      else if (t[1] === '/') v = rhs === 0 ? 0 : v / rhs;
      else v = rhs === 0 ? 0 : v % rhs;
    }
    return v;
  }

  function unary() {
    const t = peek();
    if (t && t[0] === 'op' && (t[1] === '-' || t[1] === '+')) {
      pos++;
      const v = unary();
      return t[1] === '-' ? -v : v;
    }
    return primary();
  }

  function primary() {
    const t = peek();
    if (!t) throw new Error('Unexpected end');
    if (t[0] === 'num') {
      pos++;
      return parseFloat(t[1]) || 0;
    }
    if (t[0] === 'op' && t[1] === '(') {
      pos++;
      const v = expression();
      expect(')');
      return v;
    }
    if (t[0] === 'fn') {
      pos++;
      expect('(');
      const args = [expression()];
      for (let n = peek(); n && n[0] === 'op' && n[1] === ','; n = peek()) {
        pos++;
        args.push(expression());
      }
      expect(')');
      switch (t[1]) {
        case 'round': {
          const f = 10 ** Math.trunc(args[1] || 0);
          return Math.round(args[0] * f) / f;
        }
        case 'floor':
          return Math.floor(args[0]);
        case 'ceil':
          return Math.ceil(args[0]);
        case 'abs':
          return Math.abs(args[0]);
        case 'min':
          return Math.min(...args);
        case 'max':
          return Math.max(...args);
        default:
          throw new Error('Unknown function');
      }
    }
    throw new Error('Unexpected token');
  }

  const result = expression();
  if (pos !== tokens.length) throw new Error('Trailing tokens');
  return result;
}

/**
 * Evaluate a formula.
 *
 * @param {string} formula  Formula text, e.g. "{qty} * {price}".
 * @param {Object} values   Current form values.
 * @param {number} decimals Decimal places.
 * @return {number}
 */
export function evaluateFormula(formula, values, decimals = 2) {
  if (!formula || typeof formula !== 'string') return 0;
  const expr = formula.replace(/\{([a-zA-Z0-9_\-.]+)\}/g, (_, key) =>
    String(toNumber(getIn(values, key, values?.[key])))
  );
  try {
    const result = parse(tokenize(expr));
    if (!Number.isFinite(result)) return 0;
    const d = Math.max(0, Math.min(6, parseInt(decimals, 10) || 0));
    const f = 10 ** d;
    return Math.round(result * f) / f;
  } catch (e) {
    return 0;
  }
}

/**
 * Field keys referenced by a formula.
 *
 * @param {string} formula Formula text.
 * @return {string[]}
 */
export function formulaDependencies(formula) {
  if (!formula) return [];
  return Array.from(formula.matchAll(/\{([a-zA-Z0-9_\-.]+)\}/g), (m) => m[1]);
}
