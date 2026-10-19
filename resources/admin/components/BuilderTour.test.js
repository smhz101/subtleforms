/**
 * UX2-26: the builder tour describes what is on screen, points at a real
 * selected field for the toolbar and settings steps, and never scrolls the
 * window.
 */
jest.mock('./BuilderTour.scss', () => ({}));
import { readFileSync } from 'fs';
import { join } from 'path';
import { TOUR_STEPS, selectFirstField, revealInContainer } from './BuilderTour';

describe('builder tour steps (UX2-26)', () => {
  test('the header step names the buttons the header really has', () => {
    const header = TOUR_STEPS.find((s) => s.id === 'header').content;
    expect(header).not.toMatch(/Save, Publish, or Delete buttons/);
    expect(header).toMatch(/Publish/);
    expect(header).toMatch(/Save draft/);
    expect(header).toMatch(/Delete form/);
  });

  test('the toolbar and settings steps select a field first', () => {
    for (const id of ['field-toolbar', 'right-panel']) {
      expect(typeof TOUR_STEPS.find((s) => s.id === id).prepare).toBe('function');
    }
    expect(TOUR_STEPS.find((s) => s.id === 'field-toolbar').selector).toContain('sf-field-toolbar--visible');
  });

  test('the entries step uses the name of the view', () => {
    const view = readFileSync(join(__dirname, 'builder/layout/BuilderViewSwitcher.jsx'), 'utf8');
    expect(view).toMatch(/label: __\('Entries'/);
    expect(TOUR_STEPS.find((s) => s.id === 'entries-tab').title).toBe('Entries');
  });

  test('step titles are in sentence case', () => {
    for (const step of TOUR_STEPS) {
      const words = step.title.split(' ').slice(1);
      expect(words.filter((w) => /^[A-Z][a-z]/.test(w))).toEqual([]);
    }
  });

  test('the tour never calls scrollIntoView', () => {
    const src = readFileSync(join(__dirname, 'BuilderTour.jsx'), 'utf8');
    expect(src).not.toMatch(/scrollIntoView\(/);
  });
});

describe('selectFirstField', () => {
  test('clicks the first canvas field when none is selected', () => {
    document.body.innerHTML = '<div data-tour="canvas"><div class="sf-field-chrome" id="a"></div><div class="sf-field-chrome"></div></div>';
    const click = jest.fn();
    document.getElementById('a').addEventListener('click', click);
    selectFirstField(document);
    expect(click).toHaveBeenCalledTimes(1);
  });

  test('leaves the selection alone when a field is selected', () => {
    document.body.innerHTML = '<div class="sf-field-toolbar--visible"></div><div data-tour="canvas"><div class="sf-field-chrome" id="a"></div></div>';
    const click = jest.fn();
    document.getElementById('a').addEventListener('click', click);
    selectFirstField(document);
    expect(click).not.toHaveBeenCalled();
  });
});

describe('revealInContainer', () => {
  test('scrolls the scroll container, not the window', () => {
    document.body.innerHTML = '<div id="box" style="overflow-y:auto"><div id="t"></div></div>';
    const box = document.getElementById('box');
    const target = document.getElementById('t');
    Object.defineProperty(box, 'scrollHeight', { value: 2000 });
    Object.defineProperty(box, 'clientHeight', { value: 500 });
    box.getBoundingClientRect = () => ({ top: 100, bottom: 600 });
    target.getBoundingClientRect = () => ({ top: 900, bottom: 1000 });
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    revealInContainer(target);
    expect(box.scrollTop).toBe(900 - 100 - 16);
    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });

  test('does nothing when the target is in view', () => {
    document.body.innerHTML = '<div id="box" style="overflow-y:auto"><div id="t"></div></div>';
    const box = document.getElementById('box');
    const target = document.getElementById('t');
    Object.defineProperty(box, 'scrollHeight', { value: 2000 });
    Object.defineProperty(box, 'clientHeight', { value: 500 });
    box.getBoundingClientRect = () => ({ top: 100, bottom: 600 });
    target.getBoundingClientRect = () => ({ top: 200, bottom: 300 });
    revealInContainer(target);
    expect(box.scrollTop).toBe(0);
  });
});
