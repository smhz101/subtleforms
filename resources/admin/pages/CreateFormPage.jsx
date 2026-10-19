import { useState, useCallback, useMemo, useRef, useEffect } from '@wordpress/element';
import { Button, Modal, TextControl, TextareaControl } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useCreateForm, useTemplates } from '../data';
import { useNotice } from '../ui/feedback';
import Icon from '../ui/Icon';
import AdminShell from '../components/AdminShell';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';
import { createInitialSchema } from '../utils/initialSchema';
import { schemaFromTemplate } from '../utils/templateSchema';
import { TEMPLATE_CATEGORIES } from '../templates';
import { requirePro } from '../utils/featureGate';

/** Templates SubtleForms Pro adds. */
const PRO_TEMPLATE_COUNT = 47;
import './CreateFormPage.scss';

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateDefaultTitle() {
  try {
    const next = parseInt(localStorage.getItem('sf_form_seq') || '0', 10) + 1;
    localStorage.setItem('sf_form_seq', String(next));
    /* translators: %d: sequence number */
    return sprintf(__('Untitled form %d', 'subtleforms'), next);
  } catch (_e) {
    return __('Untitled form', 'subtleforms');
  }
}

const TYPE_LABELS = {
  'multi-step': __('Multi-step', 'subtleforms'),
  multistep: __('Multi-step', 'subtleforms'),
  sectioned: __('Multi-step', 'subtleforms'),
  conversational: __('Conversational', 'subtleforms'),
  payment: __('Payment', 'subtleforms'),
};

/** Flatten a template schema to its input fields, in order. */
function flattenFields(fields = []) {
  const out = [];
  const walk = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((f) => {
      if (!f || typeof f !== 'object') return;
      walk(f.fields);
      walk(f.children);
      if (Array.isArray(f.columns)) {
        f.columns.forEach((c) => walk(Array.isArray(c) ? c : c?.fields || c?.children));
      }
      if (f.type && !['section', 'container', 'columns', 'group', 'form_step', 'page_break'].includes(f.type)) {
        out.push(f);
      }
    });
  };
  walk(fields);
  return out;
}

const CHOICE = ['radio', 'multiple_choice', 'checkbox', 'checkboxes', 'consent', 'picture_choice'];
const TALL = ['textarea', 'rich_text', 'signature', 'file', 'file_upload'];

/**
 * A wireframe of the template's first fields — shows the shape of a form at
 * a glance without rendering it.
 */
function Wireframe({ fields }) {
  const shown = fields.slice(0, 4);
  return (
    <div className='sf-wire' aria-hidden='true'>
      {shown.map((f, i) => {
        const type = f.type || 'text';
        if (CHOICE.includes(type)) {
          return (
            <div key={i} className='sf-wire__row'>
              <span className='sf-wire__label' style={{ width: `${40 + ((i * 17) % 30)}%` }} />
              <span className='sf-wire__choices'>
                <i /> <i /> <i />
              </span>
            </div>
          );
        }
        if (type === 'rating' || type === 'nps' || type === 'scale') {
          return (
            <div key={i} className='sf-wire__row'>
              <span className='sf-wire__label' style={{ width: '45%' }} />
              <span className='sf-wire__scale'>
                {Array.from({ length: 5 }).map((_, k) => (
                  <i key={k} />
                ))}
              </span>
            </div>
          );
        }
        return (
          <div key={i} className='sf-wire__row'>
            <span className='sf-wire__label' style={{ width: `${30 + ((i * 23) % 35)}%` }} />
            <span className={clsx('sf-wire__input', TALL.includes(type) && 'is-tall')} />
          </div>
        );
      })}
      <span className='sf-wire__button' />
    </div>
  );
}

const STRUCTURES = [
  {
    id: 'standard',
    icon: Icon.FileText,
    title: __('Single page', 'subtleforms'),
    text: __('All fields on one page.', 'subtleforms'),
  },
  {
    id: 'multi-step',
    icon: Icon.Layers,
    title: __('Multi-step', 'subtleforms'),
    text: __('Split long forms into steps with a progress bar.', 'subtleforms'),
  },
  {
    id: 'conversational',
    icon: Icon.MessageCircle,
    title: __('Conversational', 'subtleforms'),
    text: __('One question at a time, full screen.', 'subtleforms'),
  },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function CreateFormPage() {
  const navigate = useNavigate();
  const { error: showError } = useNotice();
  const createFormMutation = useCreateForm();

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(null); // template object or { id: 'blank' }
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [structure, setStructure] = useState('standard');
  const searchRef = useRef(null);

  const { data: templatesResponse, isLoading } = useTemplates();

  const templates = useMemo(
    () =>
      templatesResponse?.success && templatesResponse?.templates
        ? Object.values(templatesResponse.templates).map((t) => ({
            ...t,
            _fields: flattenFields(t.schema?.fields),
          }))
        : [],
    [templatesResponse]
  );

  const counts = useMemo(() => {
    const c = { all: templates.length };
    templates.forEach((t) => {
      c[t.category] = (c[t.category] || 0) + 1;
    });
    return c;
  }, [templates]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(
      (t) =>
        (category === 'all' || t.category === category) &&
        (!q ||
          t.name?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q))
    );
  }, [templates, category, query]);

  // "/" focuses search, like the field library.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !chosen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chosen]);

  const choose = (tpl) => {
    if (tpl.is_locked) {
      requirePro('templates.pro', () => {}, { label: tpl.name });
      return;
    }
    setChosen(tpl);
    setTitle(tpl.id === 'blank' ? generateDefaultTitle() : tpl.name);
    setDescription('');
    setStructure('standard');
  };

  const handleCreate = useCallback(async () => {
    if (createFormMutation.isPending || !chosen) return;
    const safeTitle = title.trim() || generateDefaultTitle();
    let schema;

    if (chosen.id !== 'blank' && chosen.schema) {
      // Every part of the template: fields, settings, notifications, type.
      schema = schemaFromTemplate(chosen, { title: safeTitle, description });
    } else {
      const formType =
        structure === 'conversational' ? 'conversational' : structure === 'multi-step' ? 'multi-step' : 'regular';
      schema = enrichSchemaWithProMarkers(
        createInitialSchema({ title: safeTitle, description, formType, startingPoint: 'blank' })
      );
      schema.metadata = { ...schema.metadata, template: 'blank' };
    }

    schema.schema_version = 1;
    if (!Array.isArray(schema.fields)) schema.fields = [];

    try {
      const result = await createFormMutation.mutateAsync({ title: safeTitle, schema });
      if (result?.id) {
        try {
          sessionStorage.setItem('sf_new_form_id', String(result.id));
        } catch (_) {
          /* no-op */
        }
        const url = new URL(window.location.href);
        url.searchParams.set('form_id', String(result.id));
        window.history.replaceState(null, '', url.toString());
        navigate('/forms/' + result.id);
      }
    } catch (error) {
      showError(error);
    }
  }, [chosen, title, description, structure, createFormMutation, navigate, showError]);

  const categories = TEMPLATE_CATEGORIES.filter((c) => c.id === 'all' || counts[c.id]);
  // Without SubtleForms Pro, one card says how many more templates Pro adds.
  const showProTemplatesCard =
    category === 'all' &&
    !query.trim() &&
    !window.subtleformsAdmin?.hasProPlugin &&
    !templates.some((t) => t.is_pro);

  return (
    <AdminShell
      title={__('New form', 'subtleforms')}
      description={
        templates.length
          ? sprintf(
              /* translators: %d: number of templates */
              __('Start from a blank canvas or one of %d ready-made templates. You can change everything later.', 'subtleforms'),
              templates.length
            )
          : __('Start from a blank canvas or a ready-made template.', 'subtleforms')
      }
      actions={
        <Button variant='tertiary' onClick={() => navigate('/forms')}>
          {__('Cancel', 'subtleforms')}
        </Button>
      }>
      <div className='sf-new-form'>
        <aside className='sf-new-form__side' aria-label={__('Template categories', 'subtleforms')}>
          <div className='sf-new-form__search'>
            <Icon.Search size={16} aria-hidden='true' />
            <input
              ref={searchRef}
              type='search'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={__('Search templates', 'subtleforms')}
              aria-label={__('Search templates', 'subtleforms')}
            />
            <kbd aria-hidden='true'>/</kbd>
          </div>
          <ul className='sf-new-form__cats'>
            {categories.map((cat) => (
              <li key={cat.id}>
                <button
                  type='button'
                  className={clsx('sf-new-form__cat', category === cat.id && 'is-active')}
                  aria-current={category === cat.id ? 'true' : undefined}
                  onClick={() => setCategory(cat.id)}>
                  <span>{cat.label}</span>
                  <span className='sf-new-form__cat-count'>{counts[cat.id] ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className='sf-new-form__main'>
          {isLoading ? (
            <div className='sf-tpl-grid'>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className='sf-tpl sf-tpl--skeleton' />
              ))}
            </div>
          ) : (
            <div className='sf-tpl-grid'>
              {category === 'all' && !query.trim() && (
                <button type='button' className='sf-tpl sf-tpl--blank' onClick={() => choose({ id: 'blank' })}>
                  <span className='sf-tpl__preview'>
                    <span className='sf-tpl__blank-icon' aria-hidden='true'>
                      <Icon.Plus size={24} />
                    </span>
                  </span>
                  <span className='sf-tpl__meta'>
                    <span className='sf-tpl__name'>{__('Blank form', 'subtleforms')}</span>
                    <span className='sf-tpl__desc'>{__('Build from scratch with drag and drop.', 'subtleforms')}</span>
                  </span>
                </button>
              )}

              {visible.map((tpl) => {
                const type = TYPE_LABELS[tpl.schema?.metadata?.type];
                return (
                  <button
                    key={tpl.id}
                    type='button'
                    className={clsx('sf-tpl', tpl.is_locked && 'is-locked')}
                    onClick={() => choose(tpl)}>
                    <span className='sf-tpl__preview'>
                      <Wireframe fields={tpl._fields} />
                      <span className='sf-tpl__tags'>
                        {type && <span className='sf-tpl__tag'>{type}</span>}
                        {tpl.is_pro && (
                          <span className='sf-tpl__tag sf-tpl__tag--pro'>
                            {tpl.is_locked && <Icon.Lock size={10} aria-hidden='true' />}
                            {__('Pro', 'subtleforms')}
                          </span>
                        )}
                      </span>
                      <span className='sf-tpl__hover' aria-hidden='true'>
                        {tpl.is_locked ? __('Preview', 'subtleforms') : __('Use template', 'subtleforms')}
                      </span>
                    </span>
                    <span className='sf-tpl__meta'>
                      <span className='sf-tpl__name'>{tpl.name}</span>
                      <span className='sf-tpl__desc'>{tpl.description}</span>
                    </span>
                  </button>
                );
              })}

              {showProTemplatesCard && (
                <a
                  className='sf-tpl sf-tpl--more'
                  href='https://subtleforms.com/templates/'
                  target='_blank'
                  rel='noopener noreferrer'>
                  <span className='sf-tpl__meta'>
                    <span className='sf-tpl__name'>
                      {sprintf(
                        /* translators: %d: number of templates */
                        __('%d more templates in SubtleForms Pro', 'subtleforms'),
                        PRO_TEMPLATE_COUNT
                      )}
                    </span>
                    <span className='sf-tpl__desc'>
                      {__('Event registration, job applications, payments and more. Opens subtleforms.com.', 'subtleforms')}
                    </span>
                  </span>
                </a>
              )}

              {visible.length === 0 && (
                <div className='sf-empty sf-tpl-grid__empty'>
                  <span className='sf-empty__icon' aria-hidden='true'>
                    <Icon.Search size={20} />
                  </span>
                  <p className='sf-empty__title'>{__('No templates found', 'subtleforms')}</p>
                  <p className='sf-empty__text'>
                    {__('Try another word, or start with a blank form.', 'subtleforms')}
                  </p>
                  <div className='sf-empty__actions'>
                    <Button variant='secondary' onClick={() => choose({ id: 'blank' })}>
                      {__('Start blank', 'subtleforms')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {chosen && (
        <Modal
          title={chosen.id === 'blank' ? __('New blank form', 'subtleforms') : chosen.name}
          onRequestClose={() => !createFormMutation.isPending && setChosen(null)}
          className='sf-create-modal'
          size='medium'>
          <form
            className='sf-create-modal__body'
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}>
            <TextControl
              __nextHasNoMarginBottom
              __next40pxDefaultSize
              label={__('Form name', 'subtleforms')}
              value={title}
              onChange={setTitle}
              autoFocus
              onFocus={(e) => e.target.select()}
              help={__('Only you see this. You can show a different title on the page.', 'subtleforms')}
            />

            {chosen.id === 'blank' ? (
              <fieldset className='sf-structure'>
                <legend className='sf-structure__legend'>{__('Layout', 'subtleforms')}</legend>
                <div className='sf-structure__grid' role='radiogroup'>
                  {STRUCTURES.map(({ id, icon: SIcon, title: sTitle, text }) => (
                    <button
                      key={id}
                      type='button'
                      role='radio'
                      aria-checked={structure === id}
                      className={clsx('sf-structure__option', structure === id && 'is-selected')}
                      onClick={() => setStructure(id)}>
                      <SIcon size={20} aria-hidden='true' />
                      <strong>{sTitle}</strong>
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <div className='sf-create-modal__fields'>
                <p className='sf-overline'>
                  {sprintf(
                    /* translators: %d: number of fields */
                    _n('%d field included', '%d fields included', chosen._fields.length, 'subtleforms'),
                    chosen._fields.length
                  )}
                </p>
                <ul>
                  {chosen._fields.slice(0, 10).map((f, i) => (
                    <li key={i}>
                      <span>{f.label || f.type}</span>
                      {f.required && <span className='sf-create-modal__req'>{__('Required', 'subtleforms')}</span>}
                    </li>
                  ))}
                  {chosen._fields.length > 10 && (
                    <li className='is-more'>
                      {sprintf(
                        /* translators: %d: remaining field count */
                        __('and %d more', 'subtleforms'),
                        chosen._fields.length - 10
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <TextareaControl
              __nextHasNoMarginBottom
              label={__('Description (optional)', 'subtleforms')}
              value={description}
              onChange={setDescription}
              rows={2}
            />

            <div className='sf-create-modal__footer'>
              <Button variant='tertiary' onClick={() => setChosen(null)} disabled={createFormMutation.isPending}>
                {__('Back', 'subtleforms')}
              </Button>
              <Button
                variant='primary'
                type='submit'
                isBusy={createFormMutation.isPending}
                disabled={createFormMutation.isPending || !title.trim()}
                accessibleWhenDisabled>
                {createFormMutation.isPending ? __('Creating…', 'subtleforms') : __('Create form', 'subtleforms')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AdminShell>
  );
}
