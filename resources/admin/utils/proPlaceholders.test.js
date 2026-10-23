import { withProPlaceholders } from './proPlaceholders';

describe('Pro placeholders in the field library', () => {
  const groups = { basic: [{ type: 'text', label: 'Text' }], choices: [{ type: 'radio', label: 'Radio' }] };

  test('lists Picture Choice as a locked Pro tile that opens the upgrade modal', () => {
    const out = withProPlaceholders(groups);
    const tile = out.choices.find((f) => f.type === 'picture_choice');
    expect(tile).toMatchObject({
      label: 'Picture Choice',
      is_pro: true,
      pro_placeholder: true,
      upgrade_key: 'fields.picture_choice',
    });
  });

  test('lists the four payment fields as locked Pro tiles in the Payments group', () => {
    const out = withProPlaceholders(groups);
    expect(out.payment.map((f) => f.type)).toEqual(['payment_amount', 'payment_summary', 'payment_coupon', 'payment_hidden_price']);
    out.payment.forEach((tile) => {
      expect(tile).toMatchObject({ is_pro: true, pro_placeholder: true, upgrade_key: 'fields.payments', category: 'payment' });
    });
  });

  test('has nothing behind it: no definition, settings or default', () => {
    const tile = withProPlaceholders(groups).choices.find((f) => f.type === 'picture_choice');
    expect(Object.keys(tile).sort()).toEqual(
      ['category', 'enabled', 'icon', 'is_pro', 'kind', 'label', 'meta', 'pro_placeholder', 'type', 'upgrade_key']
    );
  });

  test('does not touch the groups it was given', () => {
    const copy = JSON.stringify(groups);
    withProPlaceholders(groups);
    expect(JSON.stringify(groups)).toBe(copy);
  });

  test('is not shown when the real field is registered', () => {
    const real = { ...groups, choices: [...groups.choices, { type: 'picture_choice', label: 'Picture Choice', pro_placeholder: false }] };
    const out = withProPlaceholders(real);
    expect(out.choices.filter((f) => f.type === 'picture_choice')).toHaveLength(1);
    expect(out.choices.find((f) => f.type === 'picture_choice').pro_placeholder).toBe(false);
  });

  test('creates the choices group when the library has none', () => {
    expect(Object.keys(withProPlaceholders({ basic: [] }))).toEqual(['basic', 'choices', 'payment']);
  });
});
