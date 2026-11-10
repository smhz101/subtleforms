/**
 * Tabs and Accordion (2.9.0).
 *
 * One component, two layouts. Every panel stays mounted: a closed panel only
 * gets the `hidden` attribute, so its fields keep their values and are still
 * validated. Tabs follow the WAI-ARIA tabs pattern, the Accordion the
 * accordion pattern (a button in a heading that owns a region). On narrow
 * screens Tabs can draw themselves as an Accordion.
 *
 * A closed panel is opened for the visitor before focus moves to a field
 * with an error: see utils/revealField.js.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { Fragment, useContext, useEffect, useId, useRef, useState } from '@wordpress/element';
import { FormContext } from './contexts';
import { registerReveal } from '../../utils/revealField';
import { collectLeafInputPaths } from '../../utils/schemaLeaves';
import { fieldConfig } from '../../../shared/fieldConfig';
import { PANEL_OF } from '../../../shared/panels';

const NARROW_QUERY = '(max-width: 600px)';

/** A panel's stable identity: its id, else its key. */
const panelId = (panel, index) => String(panel.id || panel.key || panel.config?.key || index);
const panelKey = (panel) => panel.config?.key || panel.key || panel.id || '';
const panelTitle = (panel) =>
  fieldConfig(panel).label || panel.label || __('Untitled', 'subtleforms');

/** Panels of a container, with their position among all of its panels. */
function panelsOf(field) {
  const type = PANEL_OF[field.type];
  const list = Array.isArray(field.children) ? field.children : [];
  return list
    .map((panel, index) => ({ panel, index }))
    .filter(({ panel }) => panel && panel.type === type);
}

/**
 * How many fields in a panel have an error. A Repeater's rows report under
 * `items.0.qty`, so a key counts for the field it starts with.
 */
function errorCount(panel, errors) {
  if (!errors) return 0;
  const keys = Object.keys(errors);
  if (!keys.length) return 0;
  const paths = new Set(collectLeafInputPaths(panel.children || []));
  if (!paths.size) return 0;
  return keys.filter((key) => paths.has(key) || paths.has(key.split('.')[0])).length;
}

/**
 * True under 600px wide, once the browser has said so. The query is asked of
 * the window that owns the container, so the builder preview iframe and the
 * live form each measure their own viewport. The global window is only the
 * fallback while the element is not mounted.
 */
function useNarrow(enabled, ref, ready) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const view = ref.current?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!enabled || !view || typeof view.matchMedia !== 'function') {
      setNarrow(false);
      return undefined;
    }
    const query = view.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(!!query.matches);
    update();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener?.(update);
    return () => query.removeListener?.(update);
  }, [enabled, ref, ready]);
  return enabled && narrow;
}

function Badge({ id, count }) {
  if (!count) return null;
  return (
    <span
      id={id}
      className='subtleforms-tab-badge'
      role='img'
      aria-label={sprintf(
        /* translators: %d: number of fields with an error */
        _n('%d error', '%d errors', count, 'subtleforms'),
        count
      )}>
      {count}
    </span>
  );
}

function TabsView({ baseId, label, position, items, activeId, onSelect, renderPanel }) {
  const buttons = useRef({});
  const vertical = position === 'left';
  const ids = items.map((item) => item.id);

  const move = (to) => {
    const next = ids[to];
    if (next === undefined) return;
    onSelect(next);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (event) => {
    const at = ids.indexOf(activeId);
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    if (event.key === nextKey) {
      event.preventDefault();
      move((at + 1) % ids.length);
    } else if (event.key === prevKey) {
      event.preventDefault();
      move((at - 1 + ids.length) % ids.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(ids.length - 1);
    }
  };

  return (
    <div
      className={`subtleforms-tabs subtleforms-tabs--${vertical ? 'left' : 'top'}`}
      data-sf-tabs=''>
      <div
        role='tablist'
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(node) => {
                buttons.current[item.id] = node;
              }}
              type='button'
              role='tab'
              id={`${baseId}-tab-${item.n}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.n}`}
              aria-describedby={item.errors ? `${baseId}-badge-${item.n}` : undefined}
              tabIndex={selected ? 0 : -1}
              className='subtleforms-tab'
              onClick={() => onSelect(item.id)}>
              <span className='subtleforms-tab-title'>{item.title}</span>
              <Badge id={`${baseId}-badge-${item.n}`} count={item.errors} />
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role='tabpanel'
          id={`${baseId}-panel-${item.n}`}
          aria-labelledby={`${baseId}-tab-${item.n}`}
          hidden={item.id !== activeId}
          tabIndex={0}
          className='subtleforms-tabpanel'>
          {renderPanel(item)}
        </div>
      ))}
    </div>
  );
}

function AccordionView({ baseId, icon, items, openIds, onToggle, renderPanel }) {
  const root = useRef(null);
  const triggers = () =>
    Array.from(root.current?.querySelectorAll(`[data-sf-trigger="${baseId}"]`) || []);

  const onKeyDown = (event) => {
    if (!event.target.matches?.(`[data-sf-trigger="${baseId}"]`)) return;
    const list = triggers();
    const at = list.indexOf(event.target);
    let to = -1;
    if (event.key === 'ArrowDown') to = (at + 1) % list.length;
    else if (event.key === 'ArrowUp') to = (at - 1 + list.length) % list.length;
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = list.length - 1;
    if (to >= 0) {
      event.preventDefault();
      list[to]?.focus();
    }
  };

  return (
    <div
      ref={root}
      className={`subtleforms-accordion${icon === 'plus' ? ' subtleforms-accordion--plus' : ''}`}
      data-sf-accordion=''
      onKeyDown={onKeyDown}>
      {items.map((item) => {
        const open = openIds.includes(item.id);
        return (
          <Fragment key={item.id}>
            <h3 className='subtleforms-accordion-heading'>
              <button
                type='button'
                id={`${baseId}-trigger-${item.n}`}
                data-sf-trigger={baseId}
                aria-expanded={open}
                aria-controls={`${baseId}-region-${item.n}`}
                aria-describedby={item.errors ? `${baseId}-badge-${item.n}` : undefined}
                className='subtleforms-accordion-trigger'
                onClick={() => onToggle(item.id)}>
                <span className='subtleforms-accordion-title'>{item.title}</span>
                <Badge id={`${baseId}-badge-${item.n}`} count={item.errors} />
                <span className='subtleforms-accordion-icon' aria-hidden='true' />
              </button>
            </h3>
            <div
              role='region'
              id={`${baseId}-region-${item.n}`}
              aria-labelledby={`${baseId}-trigger-${item.n}`}
              hidden={!open}
              className='subtleforms-accordion-panel'>
              {renderPanel(item)}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

export default function PanelContainer({
  field,
  config,
  renderChild,
  errors,
  hiddenFields,
  appearanceClasses,
  appearanceStyle,
}) {
  const isTabs = field.type === 'tabs_container';
  const baseId = `subtleforms-${isTabs ? 'tabs' : 'accordion'}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { panelState } = useContext(FormContext) || {};
  const storeKey = field.id || config.key || field.key || baseId;

  const all = panelsOf(field);
  // A panel that logic hides is not drawn at all.
  const items = all
    .filter(({ panel }) => !hiddenFields?.has(panelKey(panel)))
    .map(({ panel, index }) => ({
      panel,
      n: index,
      id: panelId(panel, index),
      title: panelTitle(panel),
      errors: errorCount(panel, errors),
    }));

  // What the visitor opened survives a step change: it is kept by the form.
  const [state, setState] = useState(() => {
    const saved = panelState?.get(storeKey);
    if (saved) return saved;
    if (isTabs) {
      const start = all[Math.max(0, Math.min(parseInt(config.active, 10) || 0, all.length - 1))];
      return { active: start ? panelId(start.panel, start.index) : null, open: [] };
    }
    const mode = config.open || 'first';
    const first = all[0] ? [panelId(all[0].panel, all[0].index)] : [];
    return {
      active: null,
      open: mode === 'all' ? all.map(({ panel, index }) => panelId(panel, index)) : mode === 'none' ? [] : first,
    };
  });
  const update = (next) => {
    setState(next);
    panelState?.set(storeKey, next);
  };

  // Tabs on a narrow screen can draw as an Accordion (one component, two layouts).
  const wrapRef = useRef(null);
  const collapsed = useNarrow(
    isTabs && config.collapse_mobile !== false && config.collapse_mobile !== 0,
    wrapRef,
    items.length > 0
  );
  const asAccordion = !isTabs || collapsed;

  // The open tab: the chosen one, else the first that is shown.
  const visibleIds = items.map((item) => item.id);
  // `null` means every section is closed, which only an Accordion layout allows.
  const activeId =
    asAccordion && state.active === null
      ? null
      : visibleIds.includes(state.active)
        ? state.active
        : visibleIds[0] ?? null;

  const select = (id) => update({ ...state, active: id });
  const toggle = (id) => {
    if (isTabs) {
      // Tabs drawn as an Accordion open one section at a time.
      update({ ...state, active: activeId === id ? null : id });
      return;
    }
    const open = state.open.includes(id);
    if (config.multiple) {
      update({ ...state, open: open ? state.open.filter((x) => x !== id) : [...state.open, id] });
    } else {
      update({ ...state, open: open ? [] : [id] });
    }
  };
  const openIds = isTabs ? (activeId ? [activeId] : []) : state.open;

  // Let a field with an error open its panel (revealField).
  const latest = useRef({});
  latest.current = { state, update, isTabs, config };
  const itemKey = items.map((item) => `${item.n}:${item.id}`).join('|');
  useEffect(() => {
    const cleanups = items.map((item) =>
      registerReveal(`${baseId}-${asAccordion ? 'region' : 'panel'}-${item.n}`, () => {
        const { state: current, update: save, isTabs: tabs, config: cfg } = latest.current;
        if (tabs) {
          save({ ...current, active: item.id });
        } else if (!current.open.includes(item.id)) {
          save({ ...current, open: cfg.multiple ? [...current.open, item.id] : [item.id] });
        }
      })
    );
    return () => cleanups.forEach((cleanup) => cleanup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId, asAccordion, itemKey]);

  const renderPanel = ({ panel }) => (
    <div className='subtleforms-panel-fields'>
      {(panel.children || []).map((child) => renderChild(child))}
    </div>
  );

  const wrap = (body) => (
    <div
      ref={wrapRef}
      className={['subtleforms-field', 'subtleforms-field-container', 'subtleforms-field-panels', appearanceClasses]
        .filter(Boolean)
        .join(' ')}
      style={appearanceStyle}>
      {body}
    </div>
  );

  if (!items.length) {
    return null;
  }

  if (asAccordion) {
    return wrap(
      <AccordionView
        baseId={baseId}
        icon={isTabs ? 'chevron' : config.icon}
        items={items}
        openIds={openIds}
        onToggle={toggle}
        renderPanel={renderPanel}
      />
    );
  }

  return wrap(
    <TabsView
      baseId={baseId}
      label={config.label || __('Sections', 'subtleforms')}
      position={config.position === 'left' ? 'left' : 'top'}
      items={items}
      activeId={activeId}
      onSelect={select}
      renderPanel={renderPanel}
    />
  );
}
