/**
 * Free #135: the copy number of a form on the page, and the field id it makes.
 */
import { claimInstance, releaseInstance, fieldDomId, repeaterDomId } from './formInstance';

describe('claimInstance', () => {
  it('gives 1 to the first copy and 2 to the next', () => {
    const a = claimInstance('a1');
    const b = claimInstance('a1');
    expect([a, b]).toEqual([1, 2]);
    releaseInstance('a1', a);
    releaseInstance('a1', b);
  });

  it('reuses the lowest free number after a copy leaves', () => {
    const one = claimInstance('a2');
    const two = claimInstance('a2');
    const three = claimInstance('a2');
    releaseInstance('a2', two);
    expect(claimInstance('a2')).toBe(2);
    releaseInstance('a2', one);
    expect(claimInstance('a2')).toBe(1);
    expect(three).toBe(3);
  });

  it('counts each form id on its own', () => {
    const a = claimInstance('a3');
    const b = claimInstance('b3');
    const a2 = claimInstance('a3');
    expect([a, b, a2]).toEqual([1, 1, 2]);
    releaseInstance('a3', a);
    releaseInstance('a3', a2);
    releaseInstance('b3', b);
  });

  it('starts again at 1 once every copy is gone', () => {
    const n = claimInstance('a4');
    releaseInstance('a4', n);
    expect(claimInstance('a4')).toBe(1);
    releaseInstance('a4', 1);
  });
});

describe('fieldDomId', () => {
  it('keeps the plain id for copy 1', () => {
    expect(fieldDomId('name', 1)).toBe('subtleforms-field-name');
    expect(fieldDomId('name')).toBe('subtleforms-field-name');
  });

  it('adds the copy number from copy 2', () => {
    expect(fieldDomId('name', 2)).toBe('subtleforms-field-2-name');
    expect(fieldDomId('name', 3)).toBe('subtleforms-field-3-name');
  });

  it('keeps the existing character cleanup', () => {
    expect(fieldDomId('items.0.qty', 1)).toBe('subtleforms-field-items.0.qty');
    expect(fieldDomId('a b/c', 2)).toBe('subtleforms-field-2-a-b-c');
  });
});

describe('repeaterDomId', () => {
  it('keeps the plain id for copy 1 and numbers later copies', () => {
    expect(repeaterDomId('items', 1)).toBe('subtleforms-repeater-items');
    expect(repeaterDomId('items', 2)).toBe('subtleforms-repeater-2-items');
  });
});
