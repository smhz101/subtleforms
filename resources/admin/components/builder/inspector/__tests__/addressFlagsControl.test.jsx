/**
 * "Show country flags" on the Address field follows the Country sub-field as
 * it is drawn now: the sub-field rows first, the older enable_country flag
 * only when there are no rows.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import DynamicInspectorPanel from '../DynamicInspectorPanel';
import { ConfigContext } from '../../context/ConfigContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

const definition = {
  inspectorControls: [
    { type: 'checkbox', name: 'showFlags', label: 'Show country flags', section: 'general', showWhen: { enable_country: [true, 1, '1', ''] } },
  ],
};

function labels(field) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ConfigContext.Provider value={{ fieldDefinitions: { address_group: definition } }}>
        <DynamicInspectorPanel field={field} onUpdate={() => {}} sections={['general']} />
      </ConfigContext.Provider>
    )
  );
  const out = [...container.querySelectorAll('label')].map((l) => l.textContent);
  act(() => root.unmount());
  container.remove();
  return out;
}

const address = (extra = {}) => ({ type: 'address_group', id: 'a', ...extra });

describe('Show country flags control', () => {
  it('shows with nothing stored', () => {
    expect(labels(address())).toEqual(['Show country flags']);
  });

  it('hides when the Country row is switched off, shows when it is on', () => {
    expect(labels(address({ fields: { country: { enabled: false } } }))).toEqual([]);
    expect(labels(address({ fields: { country: { enabled: true } } }))).toEqual(['Show country flags']);
  });

  it('an older enable_country flag is a fallback, the rows win', () => {
    expect(labels(address({ enable_country: false }))).toEqual([]);
    expect(labels(address({ enable_country: false, fields: { country: { enabled: true } } }))).toEqual(['Show country flags']);
    expect(labels(address({ enable_country: true, fields: { country: { enabled: false } } }))).toEqual([]);
  });
});
