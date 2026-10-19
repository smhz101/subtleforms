/**
 * Inspector panels for layout blocks (FA-02) and the Fixed Fee Logic tab
 * (PAY-02).
 */
import { resolveControls, controlSection, hasSection, LOGIC_ONLY_TYPES } from '../controlSections';

const notice = {
  meta: { category: 'layout' },
  layoutControls: [
    { type: 'textarea', name: 'content', label: 'Disclaimer Text' },
    { type: 'select', name: 'variant', label: 'Style', options: [] },
  ],
  inspectorControls: [{ type: 'text', name: 'cssClass', section: 'advanced' }],
};
const heading = {
  meta: { category: 'layout' },
  layoutControls: [
    { type: 'text', name: 'title', label: 'Title' },
    { type: 'textarea', name: 'description', label: 'Description' },
  ],
  inspectorControls: [],
};

describe('FA-02: layout block settings land in a drawn panel', () => {
  it('puts the notice text under General and its style under Appearance', () => {
    const sections = Object.fromEntries(resolveControls(notice).map((c) => [c.name, c.section]));
    expect(sections).toEqual({ content: 'general', variant: 'appearance', cssClass: 'advanced' });
    expect(hasSection(notice, 'general')).toBe(true);
    expect(hasSection(notice, 'appearance')).toBe(true);
  });

  it('puts the Section Heading and Page Break title under General', () => {
    expect(resolveControls(heading).map((c) => c.section)).toEqual(['general', 'general']);
  });

  it('keeps an explicit section', () => {
    expect(controlSection({ name: 'title', section: 'advanced' })).toBe('advanced');
  });
});

describe('PAY-02: Fixed Fee has a Logic tab', () => {
  it('lists the Fixed Fee with the other logic-only types', () => {
    expect(LOGIC_ONLY_TYPES).toContain('payment_hidden_price');
  });
});
