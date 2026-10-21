/**
 * UX2-14: the create dialog, the quick start wizard and Form settings offer
 * the same settings with the same names, help and defaults.
 */
import fs from 'fs';
import path from 'path';
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { formDescriptionHelp, formDescriptionLabel, formNameHelp, formNameLabel } from './formNameHelp';
import { formTypeChoices } from './formTypeChoices';
import { createInitialSchema } from './initialSchema';
import { structuralType, TYPE_STANDARD } from '../../shared/formType';

jest.mock('../components/builder/FormSettings.scss', () => ({}));
jest.mock('../components/settings/extensions/extensions.scss', () => ({}));
jest.mock('../components/merge-tags/MergeTags.scss', () => ({}));
jest.mock('../components/builder/LogicEditor.scss', () => ({}));
jest.mock('../modals/ConfirmModal.scss', () => ({}));
jest.mock('../components/builder/context/ConfigContext', () => ({ ConfigContext: require('react').createContext(null) }));
import { FormTypeControl } from '../components/builder/FormSettings';

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('one wording for the form name and description', () => {
  it('says the same thing in the same words', () => {
    expect(formNameLabel()).toBe('Form name');
    expect(formNameHelp()).toBe('The name shown to you and your visitors.');
    expect(formDescriptionLabel()).toBe('Description');
    expect(formDescriptionHelp()).toBe('Shown under the title when the block or shortcode displays it.');
  });

  it.each([
    '../pages/CreateFormPage.jsx',
    '../components/CreateFormWizard.jsx',
    '../components/builder/FormSettings.jsx',
  ])('%s takes the name, description and help from the shared wording', (file) => {
    const src = read(file);
    expect(src).toMatch(/formNameLabel\(\)/);
    expect(src).toMatch(/formNameHelp\(\)/);
    expect(src).toMatch(/formDescriptionLabel\(\)/);
    expect(src).toMatch(/formDescriptionHelp\(\)/);
    // No private copy of the wording that can drift.
    expect(src).not.toMatch(/__\(\s*'Form name'/);
    expect(src).not.toMatch(/__\(\s*'(Short description|Description)( \(optional\))?'/);
    expect(src).not.toMatch(/Only you see this/);
  });
});

describe('one list of form types', () => {
  it('Form settings offers the same type names as the create dialog and the wizard', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<FormTypeControl schema={{ metadata: { type: 'regular' }, fields: [] }} onChange={() => {}} />));
    const labels = [...container.querySelectorAll('[role="radio"]')].map((n) => n.textContent.trim());
    expect(labels).toEqual(formTypeChoices().map((choice) => choice.label));
    act(() => root.unmount());
    container.remove();

    const modal = read('../pages/CreateFormPage.jsx');
    expect(modal).toMatch(/formTypeChoices\(\)/);
    expect(modal).not.toMatch(/__\(\s*'(Standard|Multi-step|Conversational|Single page|Regular)'/);
    expect(read('../components/CreateFormWizard.jsx')).toMatch(/formTypeChoices\(\)/);
  });

  it('a form made from each choice reads back as that type in Form settings, and blank is Standard', () => {
    formTypeChoices().forEach((choice) => {
      const schema = createInitialSchema({ title: 'T', formType: choice.id });
      expect(structuralType(schema)).toBe(choice.id);
    });
    // The create dialog starts on Standard and Form settings treats a form with no type as Standard.
    expect(formTypeChoices()[0].label).toBe('Standard');
    expect(structuralType({ metadata: {}, fields: [] })).toBe(TYPE_STANDARD);
    expect(structuralType(createInitialSchema({ title: 'T' }))).toBe(TYPE_STANDARD);
  });
});
