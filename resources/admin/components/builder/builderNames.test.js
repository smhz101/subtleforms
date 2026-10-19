/**
 * UX2-13: the builder views, the inspector tabs and the inspector sections
 * each have their own name, so "Settings" or "Appearance" never means two
 * different places.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const read = (file) => readFileSync(join(__dirname, file), 'utf8');

const labels = (src, pattern) => [...src.matchAll(pattern)].map((m) => m[1]);

describe('builder names (UX2-13)', () => {
  const views = labels(read('layout/BuilderViewSwitcher.jsx'), /label: __\('([^']+)'/g);
  const inspector = read('FieldInspector.jsx');
  const tabs = labels(inspector, /\{ name: '[a-z]+', title: __\('([^']+)'/g).concat(
    labels(inspector, /\{__\('(Validation)'/g)
  );
  const sections = labels(inspector, /<PanelBody title=\{__\('([^']+)'/g);
  const previewPanels = labels(read('PreviewWorkspace.jsx'), /\{ __\( '([^']+)', 'subtleforms' \) \}/g);

  test('the inspector has a Field tab and a Display section', () => {
    expect(tabs).toContain('Field');
    expect(tabs).toContain('Style');
    expect(sections).toContain('Display');
    expect(sections).not.toContain('Appearance');
  });

  test('no inspector tab shares a name with a builder view', () => {
    expect(tabs.filter((t) => views.includes(t))).toEqual([]);
  });

  test('no inspector section shares a name with a tab or a view', () => {
    expect(sections.filter((s) => tabs.includes(s) || views.includes(s))).toEqual([]);
  });

  test('the field Display section is not named like the preview Appearance panel', () => {
    expect(previewPanels).toContain('Appearance');
    expect(sections).not.toContain('Appearance');
  });
});
