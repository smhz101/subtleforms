/**
 * 2.6.0 front-end speed: heavier field code is downloaded only for forms
 * that need it, and the form waits for it so fields never pop in.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('fieldGroups', () => {
  const { fieldGroups, containerGroups } = require('./lazyFields');

  test('a plain form needs nothing extra', () => {
    const schema = {
      metadata: { type: 'regular' },
      fields: [
        { type: 'text', key: 'name' },
        { type: 'phone', key: 'phone' },
        { type: 'select', key: 'topic' },
      ],
    };
    expect([...fieldGroups(schema)]).toEqual([]);
    expect([...fieldGroups(null)]).toEqual([]);
  });

  test('nested fields, config-wrapped settings and the form type count', () => {
    const schema = {
      metadata: { type: 'conversational' },
      fields: [
        {
          type: 'step',
          children: [
            { type: 'datetime' },
            {
              type: 'two_column_container',
              columns: [
                [{ type: 'tel', config: { enableCountryCode: true } }],
                { fields: [{ type: 'file_upload' }] },
              ],
            },
          ],
        },
        { type: 'repeat_container', config: { fields: [{ type: 'payment_amount' }] } },
        { type: 'chained_select' },
        { type: 'rich_text' },
      ],
    };
    expect([...fieldGroups(schema)].sort()).toEqual(
      ['chained', 'conversational', 'date', 'geo', 'payments', 'repeater', 'richText', 'upload']
    );
  });

  test('container hint keeps known groups only', () => {
    const div = document.createElement('div');
    div.dataset.features = 'date  geo bogus upload';
    expect(containerGroups(div)).toEqual(['date', 'geo', 'upload']);
    expect(containerGroups(document.createElement('div'))).toEqual([]);
  });
});

describe('loading', () => {
  test('groups load once, unknown groups resolve, nothing rejects', async () => {
    let mod;
    jest.isolateModules(() => {
      mod = require('./lazyFields');
    });
    const schema = { fields: [{ type: 'date' }] };
    expect(mod.fieldsReadyFor(schema)).toBe(false);
    await expect(mod.loadGroups(['date', 'nope'])).resolves.toBeUndefined();
    expect(mod.fieldsReadyFor(schema)).toBe(true);
    const first = await mod.loadGroup('date');
    expect(await mod.loadGroup('date')).toBe(first);
    expect(await mod.loadGroup('nope')).toBeNull();
  });

  test('a field whose code is not here yet shows the loading line, then the field', async () => {
    const mod = require('./lazyFields');
    const Date = mod.lazyField('date');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Date mode='date' inputId='d' name='d' value='' onChange={() => {}} />);
    });
    expect(container.querySelector('.subtleforms-field-loading')).not.toBeNull();
    // The download is a resolved promise in tests, so the field is there once
    // React has retried.
    await act(async () => {
      await mod.loadGroup('date');
    });
    expect(container.querySelector('.subtleforms-picker__trigger')).not.toBeNull();
    expect(container.querySelector('.subtleforms-field-loading')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  test('a field whose code is here renders at once, with no loading line', async () => {
    const mod = require('./lazyFields');
    await mod.loadGroup('geo');
    const Country = mod.lazyField('geo', 'CountrySelect');
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Country inputId='c' name='c' value='' onChange={() => {}} />));
    expect(container.querySelector('.subtleforms-field-loading')).toBeNull();
    expect(container.querySelector('.subtleforms-picker__trigger')).not.toBeNull();
    act(() => root.unmount());
  });
});

describe('country list stays out of the main bundle', () => {
  test('conditions compare as text until the list is loaded, as codes after', () => {
    jest.isolateModules(() => {
      const { evaluateCondition } = require('../../../shared/conditions');
      const field = { type: 'country' };
      expect(evaluateCondition('DE', 'equals', 'DE', '', { field })).toBe(true);
      expect(evaluateCondition('Germany', 'equals', 'DE', '', { field })).toBe(false);
      require('../../../shared/countries');
      expect(evaluateCondition('Germany', 'equals', 'DE', '', { field })).toBe(true);
    });
  });

  test('phone validation does not need the country list', () => {
    jest.isolateModules(() => {
      const dial = require('../../../shared/phoneDial');
      expect(dial.isValidInternational('+44 20 7946 0958')).toBe(true);
      expect(dial.isValidInternational('+1 555')).toBe(false);
      // phone.js still offers the same functions.
      const phone = require('../../../shared/phone');
      expect(phone.isValidInternational).toBe(dial.isValidInternational);
      expect(phone.DIAL_CODES).toBe(dial.DIAL_CODES);
    });
  });
});
