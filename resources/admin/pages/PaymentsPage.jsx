/**
 * Payments: gateway status at a glance and the coupon manager.
 *
 * Coupons are stored by SubtleForms itself, so they work with any gateway and
 * on forms that take payment offline. Codes are checked on the server both
 * when a visitor applies one and again when the form is submitted.
 */
import { useEffect, useMemo, useState, useCallback } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
  Button,
  Modal,
  TextControl,
  ToggleControl,
  FormTokenField,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
  Notice,
} from '@wordpress/components';
import { useNavigate } from 'react-router-dom';
import AdminShell from '../components/AdminShell';
import Icon from '../ui/Icon';
import { getPlanState } from '../data/proCatalog';
import { formatMoney } from '../../shared/pricing';
import './PaymentsPage.scss';

const NS = '/subtleforms/v1';

// The admin apiFetch middleware may already unwrap the { data } envelope.
const unwrap = (res) =>
  res && typeof res === 'object' && !Array.isArray(res) && 'data' in res ? res.data : res;

const errorText = (err, fallback) =>
  err?.error?.message || err?.message || fallback;

const EMPTY = {
  code: '',
  description: '',
  type: 'percent',
  amount: '',
  min_total: '',
  max_uses: '',
  per_customer: '',
  form_ids: [],
  starts_at: '',
  expires_at: '',
  status: 'active',
};

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

function couponState(c) {
  const now = Date.now();
  if (c.status !== 'active') return { label: __('Disabled', 'subtleforms'), tone: 'outline' };
  if (c.expires_at && new Date(`${c.expires_at.replace(' ', 'T')}Z`).getTime() < now)
    return { label: __('Expired', 'subtleforms'), tone: 'danger' };
  if (c.starts_at && new Date(`${c.starts_at.replace(' ', 'T')}Z`).getTime() > now)
    return { label: __('Scheduled', 'subtleforms'), tone: 'info' };
  if (c.max_uses > 0 && c.used >= c.max_uses) return { label: __('Used up', 'subtleforms'), tone: 'warning' };
  return { label: __('Active', 'subtleforms'), tone: 'success' };
}

function couponRangeError(draft) {
  if (draft.amount !== '' && draft.amount != null) {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return __('Enter a discount greater than zero.', 'subtleforms');
    }
    if (draft.type === 'percent' && amount > 100) {
      return __('A percentage discount cannot be more than 100.', 'subtleforms');
    }
  }
  if (draft.max_uses !== '' && draft.max_uses != null && Number(draft.max_uses) < 0) {
    return __('Total uses cannot be negative.', 'subtleforms');
  }
  if (draft.per_customer !== '' && draft.per_customer != null && Number(draft.per_customer) < 0) {
    return __('Uses per customer cannot be negative.', 'subtleforms');
  }
  return '';
}

/* ── Coupon editor ──────────────────────────────────────────────────────── */

function CouponModal({ coupon, forms, currency, onClose, onSaved }) {
  const [draft, setDraft] = useState(() =>
    coupon
      ? {
          ...EMPTY,
          ...coupon,
          amount: String(coupon.amount ?? ''),
          min_total: coupon.min_total ? String(coupon.min_total) : '',
          max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
          per_customer: coupon.per_customer ? String(coupon.per_customer) : '',
          starts_at: dateOnly(coupon.starts_at),
          expires_at: dateOnly(coupon.expires_at),
        }
      : { ...EMPTY, code: randomCode() }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rangeError = couponRangeError(draft);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const titleById = useMemo(() => Object.fromEntries(forms.map((f) => [f.id, f.title])), [forms]);
  const idByTitle = useMemo(() => Object.fromEntries(forms.map((f) => [f.title, f.id])), [forms]);

  const save = async () => {
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch({
        path: coupon ? `${NS}/coupons/${coupon.id}` : `${NS}/coupons`,
        method: coupon ? 'PUT' : 'POST',
        data: draft,
      });
      onSaved(unwrap(res));
    } catch (err) {
      setError(errorText(err, __('The coupon could not be saved.', 'subtleforms')));
    } finally {
      setSaving(false);
    }
  };

  const amountNum = Number(draft.amount) || 0;
  const preview =
    amountNum > 0
      ? draft.type === 'percent'
        ? sprintf(
            /* translators: %s: percentage */
            __('%s%% off the order', 'subtleforms'),
            amountNum
          )
        : sprintf(
            /* translators: %s: amount */
            __('%s off the order', 'subtleforms'),
            formatMoney(amountNum, currency)
          )
      : '';

  return (
    <Modal
      title={coupon ? __('Edit coupon', 'subtleforms') : __('New coupon', 'subtleforms')}
      onRequestClose={onClose}
      className='sf-coupon-modal'
      size='medium'>
      {(rangeError || error) && (
        <Notice status='error' isDismissible={false} className='sf-coupon-modal__error'>
          {rangeError || error}
        </Notice>
      )}

      <div className='sf-coupon-modal__grid'>
        <div className='sf-coupon-modal__code'>
          <TextControl
            __nextHasNoMarginBottom
            __next40pxDefaultSize
            label={__('Code', 'subtleforms')}
            value={draft.code}
            onChange={(v) => set({ code: v.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
            help={__('Letters, numbers, dashes. Not case sensitive for visitors.', 'subtleforms')}
          />
          <Button variant='secondary' __next40pxDefaultSize onClick={() => set({ code: randomCode() })}>
            {__('Generate', 'subtleforms')}
          </Button>
        </div>

        <ToggleGroupControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          isBlock
          label={__('Discount type', 'subtleforms')}
          value={draft.type}
          onChange={(v) => set({ type: v })}>
          <ToggleGroupControlOption value='percent' label={__('Percentage', 'subtleforms')} />
          <ToggleGroupControlOption value='fixed' label={__('Fixed amount', 'subtleforms')} />
        </ToggleGroupControl>

        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='number'
          min={draft.type === 'percent' ? 1 : 0}
          max={draft.type === 'percent' ? 100 : undefined}
          step={draft.type === 'percent' ? 1 : 0.01}
          label={draft.type === 'percent' ? __('Percent off', 'subtleforms') : sprintf(
            /* translators: %s: currency code */
            __('Amount off (%s)', 'subtleforms'),
            currency
          )}
          value={draft.amount}
          onChange={(v) => set({ amount: v })}
          help={preview}
        />

        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          label={__('Description', 'subtleforms')}
          value={draft.description}
          placeholder={__('Spring sale, partner code…', 'subtleforms')}
          onChange={(v) => set({ description: v })}
          help={__('Only you see this.', 'subtleforms')}
        />
      </div>

      <h3 className='sf-coupon-modal__section'>{__('Limits', 'subtleforms')}</h3>
      <div className='sf-coupon-modal__grid'>
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='number'
          min={0}
          step={0.01}
          label={__('Minimum order', 'subtleforms')}
          placeholder={__('No minimum', 'subtleforms')}
          value={draft.min_total}
          onChange={(v) => set({ min_total: v })}
        />
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='number'
          min={0}
          label={__('Total uses', 'subtleforms')}
          placeholder={__('Unlimited', 'subtleforms')}
          value={draft.max_uses}
          onChange={(v) => set({ max_uses: v })}
        />
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='date'
          label={__('Starts', 'subtleforms')}
          value={draft.starts_at}
          onChange={(v) => set({ starts_at: v })}
        />
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='date'
          label={__('Expires', 'subtleforms')}
          value={draft.expires_at}
          onChange={(v) => set({ expires_at: v })}
        />
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='number'
          min={0}
          label={__('Uses per customer', 'subtleforms')}
          placeholder={__('Unlimited', 'subtleforms')}
          value={draft.per_customer}
          onChange={(v) => set({ per_customer: v })}
          help={__('Customers are told apart by the email they enter, or their account when logged in.', 'subtleforms')}
        />
      </div>

      <FormTokenField
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        label={__('Only on these forms', 'subtleforms')}
        value={(draft.form_ids || []).map((id) => titleById[id] || `#${id}`)}
        suggestions={forms.map((f) => f.title)}
        onChange={(tokens) =>
          set({
            form_ids: tokens
              .map((t) => idByTitle[t] || Number(String(t).replace('#', '')))
              .filter(Boolean),
          })
        }
        __experimentalShowHowTo={false}
        placeholder={__('All payment forms', 'subtleforms')}
      />

      <div className='sf-coupon-modal__status'>
        <ToggleControl
          __nextHasNoMarginBottom
          label={__('Active', 'subtleforms')}
          checked={draft.status === 'active'}
          onChange={(on) => set({ status: on ? 'active' : 'disabled' })}
        />
      </div>

      <div className='sf-coupon-modal__footer'>
        <Button variant='tertiary' onClick={onClose}>
          {__('Cancel', 'subtleforms')}
        </Button>
        <Button variant='primary' isBusy={saving} disabled={saving || !draft.code || !draft.amount || Boolean(rangeError)} onClick={save}>
          {coupon ? __('Save coupon', 'subtleforms') : __('Create coupon', 'subtleforms')}
        </Button>
      </div>
    </Modal>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function PaymentsPage() {
  const navigate = useNavigate();
  const { licensed } = getPlanState();
  const [overview, setOverview] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, list, fl] = await Promise.all([
        apiFetch({ path: `${NS}/payments/overview` }),
        apiFetch({ path: `${NS}/coupons` }),
        apiFetch({ path: `${NS}/forms?per_page=100` }).catch(() => ({ data: [] })),
      ]);
      setOverview(unwrap(ov) || null);
      const couponList = unwrap(list);
      setCoupons(Array.isArray(couponList) ? couponList : []);
      const formList = unwrap(fl);
      const rawForms = Array.isArray(formList) ? formList : formList?.items || [];
      setForms(rawForms.map((f) => ({ id: Number(f.id), title: f.title || `#${f.id}` })));
    } catch (err) {
      setError(errorText(err, __('Payments could not be loaded.', 'subtleforms')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currency = overview?.currency || 'USD';
  const gateways = Object.entries(overview?.gateways || {});
  const ready = gateways.find(([, g]) => g.ready);

  const remove = async (c) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(sprintf(/* translators: %s: coupon code */ __('Delete coupon %s? Orders that used it keep their discount.', 'subtleforms'), c.code))) return;
    try {
      await apiFetch({ path: `${NS}/coupons/${c.id}`, method: 'DELETE' });
      setCoupons((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      setNotice(errorText(err, __('The coupon could not be deleted.', 'subtleforms')));
    }
  };

  const openPaymentSettings = () => {
    window.location.hash = 'tab=extensions&ext=payments';
    navigate('/settings');
  };

  const formTitle = (id) => forms.find((f) => f.id === id)?.title || `#${id}`;

  return (
    <AdminShell
      title={__('Payments', 'subtleforms')}
      description={__('Take payments on any form, with live order totals and discount codes.', 'subtleforms')}
      actions={
        <>
          <Button variant='secondary' onClick={openPaymentSettings}>
            <Icon.Settings size={16} aria-hidden='true' />
            {__('Gateway settings', 'subtleforms')}
          </Button>
          <Button variant='primary' onClick={() => setEditing(null)}>
            <Icon.Plus size={16} aria-hidden='true' />
            {__('New coupon', 'subtleforms')}
          </Button>
        </>
      }
      isLoading={loading}
      error={error}
      onRetry={load}>
      <div className='sf-pay'>
      {notice && (
        <Notice status='error' onRemove={() => setNotice('')}>
          {notice}
        </Notice>
      )}

      <div className='sf-pay-stats'>
        <div className='sf-pay-stat'>
          <span className='sf-pay-stat__icon'>
            <Icon.CreditCard size={18} />
          </span>
          <div>
            <span className='sf-pay-stat__label'>{__('Gateway', 'subtleforms')}</span>
            <strong className='sf-pay-stat__value'>
              {ready ? ready[1].label : __('Not connected', 'subtleforms')}
            </strong>
          </div>
          {ready ? (
            <span className={`sf-pill sf-pill--dot ${ready[1].mode === 'live' ? 'sf-pill--success' : 'sf-pill--warning'}`}>
              {ready[1].mode === 'live' ? __('Live', 'subtleforms') : __('Test mode', 'subtleforms')}
            </span>
          ) : (
            <span className='sf-pill sf-pill--outline'>{__('Offline only', 'subtleforms')}</span>
          )}
        </div>
        <div className='sf-pay-stat'>
          <span className='sf-pay-stat__icon'>
            <Icon.Receipt size={18} />
          </span>
          <div>
            <span className='sf-pay-stat__label'>{__('Currency', 'subtleforms')}</span>
            <strong className='sf-pay-stat__value'>{currency}</strong>
          </div>
        </div>
        <div className='sf-pay-stat'>
          <span className='sf-pay-stat__icon'>
            <Icon.Tag size={18} />
          </span>
          <div>
            <span className='sf-pay-stat__label'>{__('Active coupons', 'subtleforms')}</span>
            <strong className='sf-pay-stat__value'>
              {coupons.filter((c) => couponState(c).tone === 'success').length}
            </strong>
          </div>
        </div>
      </div>

      {/* SubtleForms Pro: WooCommerce Stripe account, Apple Pay and Google Pay
          domain, license warnings (2.2.1). */}
      {window.SubtleFormsPro?.PaymentsSetup && (() => {
        const ProSetup = window.SubtleFormsPro.PaymentsSetup;
        return <ProSetup overview={overview} onChange={load} />;
      })()}

      {!ready && (
        <section className='sf-panel sf-pay-setup'>
          <div className='sf-pay-setup__text'>
            <h2 className='sf-panel__title'>
              {licensed ? __('Connect Stripe to take card payments', 'subtleforms') : __('Card payments come with SubtleForms Pro', 'subtleforms')}
            </h2>
            <p>
              {licensed
                ? __('Add your Stripe keys in Gateway settings. Until then, payment forms still work: entries are saved as “Payment pending” so you can collect payment offline.', 'subtleforms')
                : __('Products, priced options, order summaries and coupons work on every plan. Pro adds Stripe card, Apple Pay and Google Pay checkout.', 'subtleforms')}
            </p>
          </div>
          <ol className='sf-pay-setup__steps'>
            <li><strong>{__('Add products', 'subtleforms')}</strong> {__('Product or Priced Options fields', 'subtleforms')}</li>
            <li><strong>{__('Show the total', 'subtleforms')}</strong> {__('Order Summary, with its coupon box', 'subtleforms')}</li>
            <li><strong>{__('Collect payment', 'subtleforms')}</strong> {__('Card Payment field', 'subtleforms')}</li>
          </ol>
        </section>
      )}

      {window.subtleformsAdmin?.woocommerce && (
        <div className='sf-pay-woo' role='note'>
          <span className='sf-pay-woo__icon' aria-hidden='true'>
            <Icon.Tag size={16} />
          </span>
          <p>
            {__('WooCommerce is active. Forms that check out through WooCommerce use WooCommerce coupons, not the coupons below.', 'subtleforms')}{' '}
            <a href={window.subtleformsAdmin.woocommerce.couponsUrl}>
              {__('Manage them in Marketing › Coupons', 'subtleforms')}
            </a>
          </p>
        </div>
      )}

      <section className='sf-panel'>
        <header className='sf-panel__header'>
          <div>
            <h2 className='sf-panel__title'>{__('Coupons', 'subtleforms')}</h2>
            <p className='sf-panel__subtitle'>
              {__('Visitors enter a code in the Order Summary or a Coupon field. Uses are counted only when an order goes through.', 'subtleforms')}
            </p>
          </div>
        </header>

        {coupons.length === 0 ? (
          <div className='sf-pay-empty'>
            <span className='sf-pay-empty__icon'>
              <Icon.Tag size={22} />
            </span>
            <h3>{__('No coupons yet', 'subtleforms')}</h3>
            <p>{__('Create a percentage or fixed discount, limit it by date, order size or number of uses.', 'subtleforms')}</p>
            <Button variant='primary' onClick={() => setEditing(null)}>
              {__('Create your first coupon', 'subtleforms')}
            </Button>
          </div>
        ) : (
          <div className='sf-pay-table-wrap'>
            <table className='sf-pay-table'>
              <thead>
                <tr>
                  <th>{__('Code', 'subtleforms')}</th>
                  <th>{__('Discount', 'subtleforms')}</th>
                  <th>{__('Applies to', 'subtleforms')}</th>
                  <th>{__('Used', 'subtleforms')}</th>
                  <th>{__('Valid', 'subtleforms')}</th>
                  <th>{__('Status', 'subtleforms')}</th>
                  <th aria-label={__('Actions', 'subtleforms')} />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => {
                  const st = couponState(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <button type='button' className='sf-pay-code' onClick={() => setEditing(c)}>
                          {c.code}
                        </button>
                        {c.description && <span className='sf-pay-muted'>{c.description}</span>}
                      </td>
                      <td>
                        {c.type === 'percent' ? `${c.amount}%` : formatMoney(c.amount, currency)}
                        {c.min_total > 0 && (
                          <span className='sf-pay-muted'>
                            {sprintf(
                              /* translators: %s: amount */
                              __('Orders over %s', 'subtleforms'),
                              formatMoney(c.min_total, currency)
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        {c.form_ids.length === 0
                          ? __('All forms', 'subtleforms')
                          : c.form_ids.map(formTitle).join(', ')}
                      </td>
                      <td className='sf-pay-num'>
                        {c.used}
                        <span className='sf-pay-muted'> / {c.max_uses > 0 ? c.max_uses : '∞'}</span>
                        {c.per_customer > 0 && (
                          <span className='sf-pay-muted sf-pay-muted--block'>
                            {sprintf(
                              /* translators: %d: uses allowed per customer */
                              _n('%d per customer', '%d per customer', c.per_customer, 'subtleforms'),
                              c.per_customer
                            )}
                          </span>
                        )}
                      </td>
                      <td className='sf-pay-dates'>
                        {c.starts_at || c.expires_at
                          ? c.starts_at && c.expires_at
                            ? `${dateOnly(c.starts_at)} → ${dateOnly(c.expires_at)}`
                            : c.expires_at
                            ? /* translators: %s: date */ sprintf(__('Until %s', 'subtleforms'), dateOnly(c.expires_at))
                            : /* translators: %s: date */ sprintf(__('From %s', 'subtleforms'), dateOnly(c.starts_at))
                          : __('Always', 'subtleforms')}
                      </td>
                      <td>
                        <span className={`sf-pill sf-pill--dot sf-pill--${st.tone}`}>{st.label}</span>
                      </td>
                      <td className='sf-pay-actions'>
                        <Button
                          size='small'
                          icon={<Icon.Edit size={14} />}
                          label={__('Edit', 'subtleforms')}
                          onClick={() => setEditing(c)}
                        />
                        <Button
                          size='small'
                          isDestructive
                          icon={<Icon.Trash size={14} />}
                          label={__('Delete', 'subtleforms')}
                          onClick={() => remove(c)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      </div>

      {editing !== undefined && (
        <CouponModal
          coupon={editing}
          forms={forms}
          currency={currency}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            if (saved) {
              setCoupons((list) => {
                const rest = list.filter((x) => x.id !== saved.id);
                return [saved, ...rest].sort((a, b) => b.id - a.id);
              });
            }
            setEditing(undefined);
          }}
        />
      )}
    </AdminShell>
  );
}
