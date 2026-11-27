/**
 * Extensions: what each plan adds to SubtleForms, as cards with search,
 * tabs (Discover, All extensions, My plan) and plan and category chips.
 */
import { useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, SearchControl } from '@wordpress/components';
import AdminShell from '../components/AdminShell';
import TabBar from '../components/TabBar';
import ExtensionCard from '../components/extensions/ExtensionCard';
import Icon from '../ui/Icon';
import {
  PLANS,
  getPlanLabels,
  getCategoryBlurbs,
  matchesQuery,
  recommend,
  sortEntries,
} from '../components/extensions/catalog';
import { useExtensions } from '../data';
import './ExtensionsPage.scss';

const TAB_KEY = 'subtleforms_extensions_tab';
const TABS = ['discover', 'all', 'plan'];

function readTab() {
  try {
    const tab = window.localStorage.getItem(TAB_KEY);
    return TABS.includes(tab) ? tab : 'discover';
  } catch (e) {
    return 'discover';
  }
}

function Grid({ entries, onChanged }) {
  return (
    <div className='sf-ext-grid'>
      {entries.map((entry) => (
        <ExtensionCard key={entry.slug} entry={entry} onChanged={onChanged} />
      ))}
    </div>
  );
}

function Section({ title, blurb, children, onSeeAll }) {
  return (
    <section className='sf-ext-section'>
      <div className='sf-ext-section__head'>
        <div>
          <h2 className='sf-ext-section__title'>{title}</h2>
          {blurb ? <p className='sf-ext-section__blurb'>{blurb}</p> : null}
        </div>
        {onSeeAll ? (
          <Button variant='link' onClick={onSeeAll}>
            {__('See all', 'subtleforms')}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function ExtensionsPage() {
  const { data, isLoading, error, refetch } = useExtensions();
  const [tab, setTabState] = useState(readTab);
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('all');
  const [category, setCategory] = useState('all');
  const chipsRef = useRef(null);

  const entries = useMemo(() => data?.entries || [], [data]);
  const categories = useMemo(() => data?.categories || [], [data]);
  const planLabels = getPlanLabels();
  const blurbs = getCategoryBlurbs();
  const onChanged = () => refetch();

  const setTab = (next) => {
    setTabState(next);
    try {
      window.localStorage.setItem(TAB_KEY, next);
    } catch (e) {
      // Remembering the tab is optional.
    }
  };

  const found = useMemo(() => entries.filter((e) => matchesQuery(e, query)), [entries, query]);
  const searching = query.trim() !== '';

  const seeAll = (id) => {
    setPlan('all');
    setCategory(id);
    setTab('all');
  };

  const empty = (
    <div className='sf-ext-empty'>
      <p>{sprintf(/* translators: %s: the search text. */ __('No extensions match "%s".', 'subtleforms'), query.trim())}</p>
      <Button variant='secondary' onClick={() => setQuery('')}>
        {__('Clear search', 'subtleforms')}
      </Button>
    </div>
  );

  const renderDiscover = () => {
    const picks = recommend(found, !!data?.wooActive);
    return (
      <>
        {picks.length ? (
          <Section title={__('Recommended for this site', 'subtleforms')}>
            <Grid entries={picks} onChanged={onChanged} />
          </Section>
        ) : null}
        {categories.map((cat) => {
          const list = sortEntries(found.filter((e) => e.category === cat.id));
          if (!list.length) {
            return null;
          }
          return (
            <Section
              key={cat.id}
              title={cat.label}
              blurb={blurbs[cat.id]}
              onSeeAll={() => seeAll(cat.id)}>
              <Grid entries={list.slice(0, 3)} onChanged={onChanged} />
            </Section>
          );
        })}
      </>
    );
  };

  const chip = (key, label, active, onClick) => (
    <button
      key={key}
      type='button'
      className={`sf-ext-chip${active ? ' is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}>
      {label}
    </button>
  );

  const renderAll = () => {
    const list = sortEntries(
      found.filter(
        (e) => (plan === 'all' || e.plan === plan) && (category === 'all' || e.category === category)
      )
    );
    return (
      <>
        <div className='sf-ext-chips'>
          <div className='sf-ext-chips__row' ref={chipsRef} role='group' aria-label={__('Filter extensions', 'subtleforms')}>
            {chip('all', __('All', 'subtleforms'), plan === 'all' && category === 'all', () => {
              setPlan('all');
              setCategory('all');
            })}
            {PLANS.map((p) => chip(`plan-${p}`, planLabels[p], plan === p, () => setPlan(plan === p ? 'all' : p)))}
            {categories.map((c) => chip(`cat-${c.id}`, c.label, category === c.id, () => setCategory(category === c.id ? 'all' : c.id)))}
          </div>
          <button
            type='button'
            className='sf-ext-chips__more'
            aria-label={__('Show more filters', 'subtleforms')}
            onClick={() => chipsRef.current?.scrollBy?.({ left: 200, behavior: 'smooth' })}>
            <Icon.Right size={16} aria-hidden='true' />
          </button>
        </div>
        {list.length ? (
          <Grid entries={list} onChanged={onChanged} />
        ) : searching ? (
          empty
        ) : (
          <p className='sf-ext-empty'>{__('No extensions match these filters.', 'subtleforms')}</p>
        )}
      </>
    );
  };

  const renderPlan = () => {
    if (!data?.hasAddon) {
      const included = entries.filter((e) => e.status === 'included');
      return (
        <div className='sf-ext-empty sf-ext-empty--plan'>
          <h2 className='sf-ext-section__title'>{__('You are using the free plugin.', 'subtleforms')}</h2>
          {included.length ? (
            <>
              <p>{__('These integrations are included:', 'subtleforms')}</p>
              <ul>
                {included.map((e) => (
                  <li key={e.slug}>{e.title}</li>
                ))}
              </ul>
            </>
          ) : null}
          <Button variant='primary' href={entries.find((e) => e.action?.kind === 'plans')?.action.url} target='_blank' rel='noopener noreferrer'>
            {__('See plans', 'subtleforms')}
          </Button>
        </div>
      );
    }
    if (searching && !found.length) {
      return empty;
    }
    // Installed but inactive extensions sit with the ones ready to install,
    // so their Activate button stays reachable.
    const groups = [
      [['active'], __('Active', 'subtleforms')],
      [['available', 'installed'], __('Ready to install', 'subtleforms')],
      [['update'], __('Updates', 'subtleforms')],
    ];
    const shown = groups
      .map(([statuses, label]) => [label, sortEntries(found.filter((e) => statuses.includes(e.status)))])
      .filter(([, list]) => list.length);
    if (!shown.length) {
      return <p className='sf-ext-empty'>{__('Nothing to show here yet.', 'subtleforms')}</p>;
    }
    return shown.map(([label, list]) => (
      <Section key={label} title={`${label} (${list.length})`}>
        <Grid entries={list} onChanged={onChanged} />
      </Section>
    ));
  };

  const tabs = [
    { key: 'discover', label: __('Discover', 'subtleforms') },
    { key: 'all', label: __('All extensions', 'subtleforms') },
    { key: 'plan', label: __('My plan', 'subtleforms') },
  ];

  let body;
  if (searching && !found.length && tab !== 'plan') {
    body = empty;
  } else if (tab === 'all') {
    body = renderAll();
  } else if (tab === 'plan') {
    body = renderPlan();
  } else {
    body = renderDiscover();
  }

  return (
    <AdminShell
      title={__('Extensions', 'subtleforms')}
      description={__('Add what this site needs to SubtleForms.', 'subtleforms')}
      actions={
        <div className='sf-ext-search'>
          <SearchControl
            value={query}
            onChange={setQuery}
            placeholder={__('Search extensions', 'subtleforms')}
            label={__('Search extensions', 'subtleforms')}
            __nextHasNoMarginBottom
            size='compact'
          />
        </div>
      }
      actionBarLeft={<TabBar tabs={tabs} activeTab={tab} onTabChange={setTab} />}
      isLoading={isLoading}
      error={error ? error.message || __('Could not load the extensions.', 'subtleforms') : null}>
      <div className='sf-ext-page'>{body}</div>
    </AdminShell>
  );
}
