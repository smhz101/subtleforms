// @ts-check
/**
 * A condition sent on a notification through the API (logic on the action,
 * the issue 137 shape) is kept under settings.logic, not dropped.
 */
const { test, expect } = require('@playwright/test');
const { adminApi } = require('./helpers');

const LOGIC = {
  action: 'show',
  groups: [{ match: 'all', rules: [{ field: 'dept', operator: 'equals', value: 'sales' }] }],
};

test('logic sent on an action is stored under settings.logic', async () => {
  const client = await adminApi();
  const created = await client.call('POST', '/forms', {
    title: 'Action conditions API',
    schema: {
      schema_version: 1,
      metadata: { type: 'regular', name: 'Action conditions API' },
      fields: [{ key: 'dept', type: 'text', label: 'Department' }],
      actions: [
        {
          id: 'sales_mail',
          type: 'email',
          enabled: true,
          settings: { to: 'sales@example.com', subject: 'Sales lead', message: 'Hello' },
          logic: LOGIC,
        },
      ],
    },
  });
  expect(created.status).toBeLessThan(300);
  const id = created.body?.data?.id ?? created.body?.data?.form?.id ?? created.body?.id;
  expect(id).toBeTruthy();

  try {
    const res = await client.call('GET', `/forms/${id}/schema?context=builder`);
    expect(res.status).toBe(200);
    const body = res.body?.data ?? res.body;
    const schema = body.schema ?? body;
    const action = schema.actions.find((a) => a.id === 'sales_mail');
    expect(action).toBeTruthy();
    expect(action.logic).toBeUndefined();
    expect(action.settings.logic).toEqual(LOGIC);
  } finally {
    await client.call('DELETE', `/forms/${id}?force=true`);
  }
});
