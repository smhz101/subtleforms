import {
  collectFieldKeys,
  fieldKeyProblem,
  renameFieldKey,
  renameKeyInText,
  tidyFieldKey,
  FIELD_KEY_MAX,
} from './fieldKeys';

describe('field ID rules (2.4.1)', () => {
  const used = new Set(['email', 'name_x']);

  test('accepts lower case letters, numbers, _ and -, starting with a letter', () => {
    expect(fieldKeyProblem('customer_email', used)).toBe('');
    expect(fieldKeyProblem('crm-id-2', used)).toBe('');
  });

  test('explains each problem', () => {
    expect(fieldKeyProblem('', used)).toBe('empty');
    expect(fieldKeyProblem('2nd', used)).toBe('start');
    expect(fieldKeyProblem('_x', used)).toBe('start');
    expect(fieldKeyProblem('first name', used)).toBe('characters');
    expect(fieldKeyProblem('First', used)).toBe('start');
    expect(fieldKeyProblem('a.b', used)).toBe('characters');
    expect(fieldKeyProblem('a'.repeat(FIELD_KEY_MAX + 1), used)).toBe('long');
    expect(fieldKeyProblem('email', used)).toBe('taken');
    expect(fieldKeyProblem('form_rendered_at', used)).toBe('reserved');
    expect(fieldKeyProblem('date', used)).toBe('reserved');
  });

  test('tidies typing: lower case, spaces to underscores', () => {
    expect(tidyFieldKey('First Name')).toBe('first_name');
  });

  test('collects IDs inside steps, columns, containers and repeaters', () => {
    const keys = collectFieldKeys([
      { type: 'step', key: 'step_1', children: [{ type: 'text', key: 'a' }] },
      { type: 'columns', key: 'cols', columns: [[{ type: 'text', key: 'b' }], { children: [{ type: 'text', key: 'c' }] }] },
      { type: 'repeat_container', key: 'r', children: [{ type: 'text', key: 'd' }] },
      { type: 'container', config: { key: 'e', children: [{ type: 'text', key: 'f' }] } },
    ]);
    expect([...keys].sort()).toEqual(['a', 'b', 'c', 'cols', 'd', 'e', 'f', 'r', 'step_1']);
  });
});

describe('renameKeyInText', () => {
  test('renames every tag form and leaves longer IDs alone', () => {
    const { text, count } = renameKeyInText(
      'Hi {email}, {{email}}, {{ email }}, {field:email}, {{field:email}}, {email.first}, {email_2}, email',
      'email',
      'contact'
    );
    expect(text).toBe(
      'Hi {contact}, {{contact}}, {{ contact }}, {field:contact}, {{field:contact}}, {contact.first}, {email_2}, email'
    );
    expect(count).toBe(6);
  });

  test('renames inside formulas', () => {
    expect(renameKeyInText('{qty} * {price} + {qty_extra}', 'qty', 'quantity').text).toBe(
      '{quantity} * {price} + {qty_extra}'
    );
  });
});

describe('renameFieldKey', () => {
  const schema = {
    metadata: {
      title: 'Order',
      confirmation: { message: 'Thanks {name}', redirect: 'https://example.com/?e={{field:email}}' },
      integrations: {
        email_marketing: { fields: { email: 'email', first_name: 'name' }, merge_fields: [{ field: 'email', tag: 'EMAIL' }], consent_field: 'email' },
        crm: { properties: [{ field: 'email', property: 'email' }] },
      },
      payment: { amountField: 'email', billing: { email: 'email', phone: 'phone' } },
    },
    fields: [
      { id: 'n1', type: 'email', key: 'email', label: 'Email' },
      {
        id: 'n2',
        type: 'step',
        key: 'step_1',
        children: [
          {
            id: 'n3',
            type: 'text',
            key: 'name',
            label: 'Name for {email}',
            logic: { action: 'show', groups: [{ match: 'all', rules: [{ field: 'email', operator: 'filled', value: '' }] }] },
            conditions: [{ sourceField: 'email', operator: 'equals', value: 'email', effect: 'show' }],
          },
          { id: 'n4', type: 'calculation', key: 'total', formula: '{email} + 1' },
          { id: 'n5', type: 'dropdown', key: 'pick', options: [{ label: 'Email', value: 'email' }] },
        ],
      },
    ],
    actions: [
      { id: 'a1', type: 'email', settings: { to: '{email}', subject: 'New {form_title}', message: '{all_fields}' } },
      { id: 'a2', type: 'webhook', settings: { url: 'https://x.test', custom_payload: '{"e":"{{email}}"}' } },
    ],
  };

  const { schema: out, references } = renameFieldKey(schema, 'email', 'customer_email');

  test('renames the field itself', () => {
    expect(out.fields[0].key).toBe('customer_email');
    expect(out.fields[0].id).toBe('n1');
  });

  test('updates logic, legacy conditions, formulas and labels', () => {
    const step = out.fields[1].children;
    expect(step[0].logic.groups[0].rules[0].field).toBe('customer_email');
    expect(step[0].conditions[0].sourceField).toBe('customer_email');
    expect(step[0].label).toBe('Name for {customer_email}');
    expect(step[1].formula).toBe('{customer_email} + 1');
  });

  test('never changes answers or choice values that happen to match', () => {
    const step = out.fields[1].children;
    expect(step[0].conditions[0].value).toBe('email');
    expect(step[2].options[0].value).toBe('email');
    expect(out.metadata.integrations.crm.properties[0].property).toBe('email');
    expect(out.metadata.integrations.email_marketing.merge_fields[0].tag).toBe('EMAIL');
  });

  test('updates emails, webhooks, confirmations, integrations and payment settings', () => {
    expect(out.actions[0].settings.to).toBe('{customer_email}');
    expect(out.actions[1].settings.custom_payload).toBe('{"e":"{{customer_email}}"}');
    expect(out.metadata.confirmation.redirect).toBe('https://example.com/?e={{field:customer_email}}');
    expect(out.metadata.integrations.email_marketing.fields.email).toBe('customer_email');
    expect(out.metadata.integrations.email_marketing.fields.first_name).toBe('name');
    expect(out.metadata.integrations.email_marketing.merge_fields[0].field).toBe('customer_email');
    expect(out.metadata.integrations.email_marketing.consent_field).toBe('customer_email');
    expect(out.metadata.integrations.crm.properties[0].field).toBe('customer_email');
    expect(out.metadata.payment.amountField).toBe('customer_email');
    expect(out.metadata.payment.billing.email).toBe('customer_email');
    expect(out.metadata.payment.billing.phone).toBe('phone');
  });

  test('counts the references it updated, and keeps untouched parts as they were', () => {
    expect(references).toBe(13);
    expect(out.fields[1].children[2]).toBe(schema.fields[1].children[2]);
    expect(schema.fields[0].key).toBe('email');
  });

  test('renaming back restores the schema', () => {
    expect(renameFieldKey(out, 'customer_email', 'email').schema).toEqual(schema);
  });
});
