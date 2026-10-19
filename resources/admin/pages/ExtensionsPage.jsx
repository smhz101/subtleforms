import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import AdminShell from '../components/AdminShell';
import { requirePro } from '../utils/featureGate';
import {
  PRO_URL,
  PRO_PILLARS,
  EXTENSIONS,
  EXTENSION_GROUPS,
  getPlanState,
} from '../data/proCatalog';
import './ExtensionsPage.scss';

/**
 * Status pill for an extension row.
 */
function StatusPill({ ext }) {
  if (!ext.available) {
    return (
      <span className='sf-pill sf-pill--outline sf-ext-row__pro'>
        {__('In SubtleForms Pro', 'subtleforms')}
      </span>
    );
  }
  if (ext.enabled && ext.configured) {
    return <span className='sf-pill sf-pill--dot sf-pill--success'>{__('Active', 'subtleforms')}</span>;
  }
  if (ext.enabled) {
    return <span className='sf-pill sf-pill--dot sf-pill--warning'>{__('Needs setup', 'subtleforms')}</span>;
  }
  return <span className='sf-pill sf-pill--dot'>{__('Off', 'subtleforms')}</span>;
}

/**
 * One extension as a list row: what it is, what it does, one action.
 */
function ExtensionRow({ ext, onOpen }) {
  const meta = EXTENSIONS[ext.slug] || { icon: Icon.Puzzle };
  const RowIcon = meta.icon;
  const locked = !ext.available;

  return (
    <li className={`sf-ext-row ${locked ? 'is-locked' : ''} ${ext.enabled && !locked ? 'is-on' : ''}`}>
      <span className='sf-ext-row__icon' aria-hidden='true'>
        <RowIcon size={20} />
      </span>
      <div className='sf-ext-row__text'>
        <div className='sf-ext-row__title'>
          <h3>{ext.label}</h3>
          <StatusPill ext={ext} />
        </div>
        <p>{meta.outcome || ext.description}</p>
      </div>
      <div className='sf-ext-row__action'>
        {locked ? (
          <Button
            variant='tertiary'
            size='compact'
            onClick={() => requirePro(`extensions.${ext.slug}`, () => {}, { label: ext.label })}>
            {__('Learn more', 'subtleforms')}
          </Button>
        ) : (
          <Button variant='secondary' size='compact' onClick={() => onOpen(ext.slug)}>
            {ext.enabled ? __('Configure', 'subtleforms') : __('Set up', 'subtleforms')}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Pro introduction, shown in place of an ad banner: what you get, in four
 * plain sentences, and one way to get it.
 */
function ProHero({ hasProPlugin, onActivate }) {
  return (
    <section className='sf-pro-hero' aria-labelledby='sf-pro-hero-title'>
      <div className='sf-pro-hero__intro'>
        <span className='sf-pro-hero__eyebrow'>
          <Icon.Crown size={14} aria-hidden='true' />
          {__('SubtleForms Pro', 'subtleforms')}
        </span>
        <h2 id='sf-pro-hero-title' className='sf-pro-hero__title'>
          {__('More integrations with SubtleForms Pro', 'subtleforms')}
        </h2>
        <p className='sf-pro-hero__text'>
          {__(
            'SubtleForms Pro is a separate plugin that adds Stripe payments, marketing and CRM integrations, entry PDFs, translation and more templates to the forms you already have.',
            'subtleforms'
          )}
        </p>
        <div className='sf-pro-hero__actions'>
          {hasProPlugin ? (
            <Button variant='primary' onClick={onActivate}>
              {__('Activate your license', 'subtleforms')}
            </Button>
          ) : (
            <Button variant='primary' href={PRO_URL} target='_blank' rel='noreferrer'>
              {__('Get SubtleForms Pro', 'subtleforms')}
              <Icon.ArrowUpRight size={16} aria-hidden='true' />
            </Button>
          )}
          <Button variant='tertiary' href={`${PRO_URL}#compare`} target='_blank' rel='noreferrer'>
            {__('Compare plans', 'subtleforms')}
          </Button>
        </div>
      </div>
      <ul className='sf-pro-hero__pillars'>
        {PRO_PILLARS.map(({ key, icon: PillarIcon, title, text }) => (
          <li key={key} className='sf-pro-hero__pillar'>
            <span className='sf-pro-hero__pillar-icon' aria-hidden='true'>
              <PillarIcon size={18} />
            </span>
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Extensions — the Pro hub. Every extension is listed whether or not it is
 * unlocked, so free users see exactly what Pro adds and Pro users get one
 * place to switch things on.
 */
export default function ExtensionsPage() {
  const navigate = useNavigate();
  const raw = window.subtleformsAdmin?.extensions ?? {};
  const { hasProPlugin, licensed, plan } = getPlanState();

  const all = Object.values(raw);
  const activeCount = all.filter((e) => e.available && e.enabled).length;
  const unlockedCount = all.filter((e) => e.available).length;

  const openSettings = (slug) => {
    window.location.hash = slug ? `tab=extensions&ext=${slug}` : 'tab=extensions';
    navigate('/settings');
  };
  const openLicense = () => {
    window.location.hash = 'tab=license';
    navigate('/settings');
  };

  const grouped = EXTENSION_GROUPS.map((group) => ({
    ...group,
    items: all.filter((ext) => (EXTENSIONS[ext.slug]?.group || 'insights') === group.key),
  })).filter((g) => g.items.length > 0);

  const description = licensed
    ? sprintf(
        /* translators: 1: active count, 2: total count */
        __('%1$d of %2$d extensions are switched on.', 'subtleforms'),
        activeCount,
        all.length
      )
    : __('Connect your forms to payments, marketing tools and reporting.', 'subtleforms');

  return (
    <AdminShell
      title={__('Extensions', 'subtleforms')}
      description={description}
      actions={
        licensed ? (
          <Button variant='secondary' onClick={openLicense} icon={<Icon.Crown size={16} aria-hidden='true' />}>
            {sprintf(
              /* translators: %s: plan name */
              __('%s license', 'subtleforms'),
              plan.charAt(0).toUpperCase() + plan.slice(1)
            )}
          </Button>
        ) : null
      }>
      <div className='sf-extensions'>
        {!licensed && <ProHero hasProPlugin={hasProPlugin} onActivate={openLicense} />}

        {all.length === 0 ? (
          <div className='sf-empty'>
            <span className='sf-empty__icon' aria-hidden='true'>
              <Icon.Puzzle size={20} />
            </span>
            <p className='sf-empty__title'>{__('No extensions found', 'subtleforms')}</p>
            <p className='sf-empty__text'>
              {__('Reinstall SubtleForms if this keeps happening.', 'subtleforms')}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.key} className='sf-ext-group'>
              <header className='sf-ext-group__header'>
                <h2 className='sf-ext-group__title'>{group.title}</h2>
                <span className='sf-ext-group__count'>
                  {sprintf(
                    /* translators: %d: number of extensions */
                    __('%d extensions', 'subtleforms'),
                    group.items.length
                  )}
                </span>
              </header>
              <ul className='sf-ext-list'>
                {group.items.map((ext) => (
                  <ExtensionRow key={ext.slug} ext={ext} onOpen={openSettings} />
                ))}
              </ul>
            </section>
          ))
        )}

        {licensed && unlockedCount < all.length && (
          <p className='sf-extensions__footnote'>
            {__('Some extensions need a higher plan.', 'subtleforms')}{' '}
            <a href={`${PRO_URL}#compare`} target='_blank' rel='noreferrer'>
              {__('Compare plans', 'subtleforms')}
            </a>
          </p>
        )}
      </div>
    </AdminShell>
  );
}
