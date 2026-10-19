import { detectCsvDelimiter, levelsFromCsv, needsReplaceConfirm } from './chainedLevels';

test('a semicolon file becomes two dropdowns and replacing lists asks first', () => {
  expect(detectCsvDelimiter('Province;City\nOntario;Toronto')).toBe(';');
  const levels = levelsFromCsv('Province;City\nOntario;Toronto');
  expect(levels).toHaveLength(2);
  expect(levels[0].label).toBe('Province');
  expect(levels[1].options[0].label).toBe('Toronto');
  expect(needsReplaceConfirm(levels)).toBe(true);
  expect(needsReplaceConfirm([])).toBe(false);
});
