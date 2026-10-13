import { evaluateFormula, FORMULA_ERROR } from './formula';

describe('evaluateFormula', () => {
  it('fails on division by zero', () => {
    expect(evaluateFormula('1/0', {})).toBeNull();
    expect(evaluateFormula('1 / 0', {})).toBeNull();
    expect(evaluateFormula('{qty} / {price}', { qty: 1, price: 0 })).toBeNull();
  });

  it('fails on modulo by zero', () => {
    expect(evaluateFormula('5%0', {})).toBeNull();
  });

  it('fails when a reference is missing', () => {
    expect(evaluateFormula('{qty}', {})).toBeNull();
    expect(evaluateFormula('{qty} * {price}', { qty: 2 })).toBeNull();
  });

  it('keeps an explicit zero', () => {
    expect(evaluateFormula('0+0', {})).toBe(0);
    expect(evaluateFormula('0', {})).toBe(0);
    expect(evaluateFormula('{a}+{b}', { a: 0, b: 0 })).toBe(0);
  });

  it('treats a failed dependency as a failure', () => {
    expect(evaluateFormula('{due} + 1', { due: FORMULA_ERROR })).toBeNull();
  });
});
