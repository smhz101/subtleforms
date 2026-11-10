/**
 * UX2-13: the builder views and the inspector sections each have their own
 * name, so "Settings" or "Appearance" never means two different places.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (file) => readFileSync(join(__dirname, file), 'utf8');

const labels = (src, pattern) => [...src.matchAll(pattern)].map((m) => m[1]);

describe('builder names (UX2-13)', () => {
  const views = labels(read('layout/BuilderViewSwitcher.jsx'), /label: __\('([^']+)'/g);
  const inspector = read('FieldInspector.jsx');
  // The inspector is one sheet (2.9.0): no tabs, only sections.
  const sections = labels(inspector, /<InspectorSection\s+id='[a-z]+'\s+title=\{__\('([^']+)'/g);
  const previewPanels = labels(read('PreviewWorkspace.jsx'), /\{ __\( '([^']+)', 'subtleforms' \) \}/g);

  test('the inspector is one sheet with a Content section, and has no tabs', () => {
    expect(inspector).not.toContain('TabPanel');
    expect(sections).toEqual(expect.arrayContaining(['Content', 'Choices', 'Rules', 'Logic', 'Style', 'Advanced']));
    expect(sections).not.toContain('Display');
    expect(sections).not.toContain('Appearance');
  });

  test('no inspector section shares a name with a builder view', () => {
    expect(sections.filter((s) => views.includes(s))).toEqual([]);
  });

  test('the field Style section is not named like the preview Appearance panel', () => {
    expect(previewPanels).toContain('Appearance');
    expect(sections).not.toContain('Appearance');
  });
});
