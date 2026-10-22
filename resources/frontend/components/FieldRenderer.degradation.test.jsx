/**
 * Forms saved with a feature SubtleForms Pro provides still work without it:
 * a Picture Choice field is a plain choice, a multi-file upload takes one
 * file. Nothing in the saved field is changed.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FieldRenderer from './FieldRenderer';
import { registerFieldType, registerFieldOverride } from '../../shared/extend';
import { effectiveFieldType } from '../../shared/fieldFallback';

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const options = [
  { label: 'Cat', value: 'cat', image: 'https://example.test/cat.png' },
  { label: 'Dog', value: 'dog', image: 'https://example.test/dog.png' },
];
const picture = (extra = {}) => ({ type: 'picture_choice', key: 'pet', label: 'Pet', options, ...extra });

afterEach(() => {
  const store = window.__subtleformsExtend;
  delete store.fields.picture_choice;
  store.overrides = {};
});

describe('Picture Choice without SubtleForms Pro', () => {
  test('falls back to radio buttons with the labels, and ignores the images', () => {
    const onChange = jest.fn();
    const { container, unmount } = mount(
      <FieldRenderer field={picture()} values={{}} onChange={onChange} errors={{}} />
    );
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(2);
    expect(container.textContent).toContain('Cat');
    expect(container.textContent).toContain('Dog');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.subtleforms-picture-choice')).toBeNull();
    act(() => radios[1].click());
    expect(onChange).toHaveBeenCalledWith('pet', 'dog');
    unmount();
  });

  test('falls back to checkboxes when several answers are allowed', () => {
    const { container, unmount } = mount(
      <FieldRenderer field={picture({ allowMultiple: true })} values={{}} onChange={() => {}} errors={{}} />
    );
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(container.querySelector('img')).toBeNull();
    unmount();
  });

  test('keeps the saved field as it was', () => {
    const field = picture({ allowMultiple: true });
    const copy = JSON.stringify(field);
    effectiveFieldType(field);
    expect(JSON.stringify(field)).toBe(copy);
  });

  test('uses the field type an add-on registers instead', () => {
    registerFieldType('picture_choice', { component: () => <p className='pro-picture'>pictures</p> });
    const { container, unmount } = mount(
      <FieldRenderer field={picture()} values={{}} onChange={() => {}} errors={{}} />
    );
    expect(container.querySelector('.pro-picture')).not.toBeNull();
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    unmount();
  });
});

describe('effectiveFieldType', () => {
  test('maps only the types that have a fallback', () => {
    expect(effectiveFieldType({ type: 'picture_choice' })).toBe('radio');
    expect(effectiveFieldType({ type: 'picture_choice', config: { allowMultiple: true } })).toBe('multiple_choice');
    expect(effectiveFieldType({ type: 'text' })).toBe('text');
    expect(effectiveFieldType(null)).toBeFalsy();
  });
});

describe('field overrides', () => {
  test('an add-on draws a built-in type for the fields it applies to', () => {
    registerFieldOverride('radio', {
      applies: (field, config) => config.special === true,
      component: () => <p className='pro-radio'>special</p>,
    });
    const special = { type: 'radio', key: 'a', label: 'A', special: true, options };
    const plain = { type: 'radio', key: 'b', label: 'B', options };
    const one = mount(<FieldRenderer field={special} values={{}} onChange={() => {}} errors={{}} />);
    expect(one.container.querySelector('.pro-radio')).not.toBeNull();
    one.unmount();
    const two = mount(<FieldRenderer field={plain} values={{}} onChange={() => {}} errors={{}} />);
    expect(two.container.querySelector('.pro-radio')).toBeNull();
    expect(two.container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    two.unmount();
  });
});
