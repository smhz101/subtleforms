/**
 * @jest-environment jsdom
 */
import { TOUR_STEPS_EXPORT } from './BuilderTour';

// Re-read steps from source file for a lightweight contract test.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'BuilderTour.jsx'), 'utf8');

describe('BuilderTour steps (UX2-26)', () => {
  it('does not claim Save/Publish/Delete buttons live in the header title', () => {
    expect(src).not.toMatch(/use Save, Publish, or Delete buttons/);
    expect(src).toMatch(/form title/i);
  });

  it('tells users to select a field before the inspector has content', () => {
    expect(src).toMatch(/Select a field on the canvas/);
  });
});
