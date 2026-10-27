import {
  headerProblem,
  headersToRows,
  rowsToHeaders,
  rowsToJson,
  parseHeadersJson,
  rowProblems,
  collectPayloadFields,
  applicableGroups,
  defaultSelection,
  fullSelection,
  cleanSelection,
  buildPreview,
  sampleEntry,
  selectionToTemplate,
  templateToSelection,
  renderTemplate,
  buildFullPreview,
  LABELS_OPTION,
} from './webhookModel';
import { registerPayloadGroup } from '../../../../shared/extend';

// An add-on's extra data group (P1-01: this plugin has none of its own).
registerPayloadGroup('example', {
  title: 'Example',
  keys: [
    { key: 'example_amount', label: 'Amount', sample: 49.99 },
    { key: 'example_currency', label: 'Currency', sample: 'USD' },
    { key: 'example_status', label: 'Status', sample: 'paid' },
  ],
  appliesTo: (nodes) => JSON.stringify(nodes).includes('example_product'),
});

const schemaFields = [
  { type: 'text', key: 'name', label: 'Name' },
  { type: 'email', key: 'email', label: 'Email' },
  { type: 'password', key: 'pass', label: 'Password' },
  { type: 'signature', key: 'sign', label: 'Signature' },
  { type: 'checkbox', key: 'topics', label: 'Topics' },
  { type: 'html', key: 'intro', label: 'Intro' },
  {
    type: 'section',
    key: 'sec',
    fields: [{ type: 'text', key: 'city', label: 'City' }],
  },
  {
    type: 'repeat_container',
    key: 'offices',
    label: 'Offices',
    children: [{ type: 'text', key: 'office_city', label: 'Office city' }],
  },
];

describe('header rows', () => {
  test('rows to headers and back keep names and values', () => {
    const rows = headersToRows({ 'X-Source': 'subtleforms', Authorization: 'Bearer abc' });
    expect(rows.map((r) => [r.name, r.value])).toEqual([
      ['X-Source', 'subtleforms'],
      ['Authorization', 'Bearer abc'],
    ]);
    expect(rowsToHeaders(rows)).toEqual({ 'X-Source': 'subtleforms', Authorization: 'Bearer abc' });
    expect(JSON.parse(rowsToJson(rows))).toEqual(rowsToHeaders(rows));
  });

  test('rows to JSON and back', () => {
    const rows = headersToRows({ 'X-A': '1', 'X-B': '2' });
    const parsed = parseHeadersJson(rowsToJson(rows));
    expect(parsed.ok).toBe(true);
    expect(rowsToHeaders(parsed.rows)).toEqual({ 'X-A': '1', 'X-B': '2' });
  });

  test('mirrors the server rules', () => {
    expect(headerProblem('X-Source', 'ok')).toBe('');
    expect(headerProblem('Bad Name', 'x')).toBe('invalid_name');
    expect(headerProblem('X:Y', 'x')).toBe('invalid_name');
    expect(headerProblem('', 'x')).toBe('invalid_name');
    expect(headerProblem('Host', 'x')).toBe('blocked');
    expect(headerProblem('CONTENT-LENGTH', '1')).toBe('blocked');
    expect(headerProblem('X-SubtleForms-Signature', 'x')).toBe('blocked');
    expect(headerProblem('X-A', 'a\nb')).toBe('invalid_value');
  });

  test('invalid and repeated rows are not saved, valid ones are', () => {
    const rows = [
      { id: 'a', name: 'X-One', value: '1' },
      { id: 'b', name: 'Host', value: 'evil' },
      { id: 'c', name: 'x-one', value: '2' },
      { id: 'd', name: '', value: '' },
      { id: 'e', name: 'X-Two', value: '' },
    ];
    expect(rowProblems(rows)).toEqual(['', 'blocked', 'duplicate', '', '']);
    expect(rowsToHeaders(rows)).toEqual({ 'X-One': '1', 'X-Two': '' });
  });

  test('JSON errors say what is wrong and do not throw', () => {
    expect(parseHeadersJson('{"X-A": ').ok).toBe(false);
    expect(parseHeadersJson('[1]').error).toMatch(/object/);
    expect(parseHeadersJson('{"X-A": {"b": 1}}').error).toMatch(/text/);
    expect(parseHeadersJson('').ok).toBe(true);
  });
});

describe('payload fields', () => {
  test('lists answers in form order, one entry for a repeater, none for secrets or layout', () => {
    const fields = collectPayloadFields(schemaFields);
    expect(fields.map((f) => f.key)).toEqual(['name', 'email', 'topics', 'city', 'offices']);
    expect(fields.find((f) => f.key === 'offices').children.map((c) => c.key)).toEqual(['office_city']);
  });

  test('lists the add-on groups that apply to the form', () => {
    expect(applicableGroups(schemaFields)).toEqual([]);
    expect(applicableGroups([{ type: 'section', fields: [{ type: 'example_product', key: 'p' }] }]).map((g) => g.id)).toEqual(['example']);
  });
});

describe('payload selection', () => {
  const fields = collectPayloadFields(schemaFields);
  const entry = sampleEntry({ formId: 9, formTitle: 'Contact', siteUrl: 'https://example.com/' });

  test('the preview has only what is ticked, in the server order', () => {
    const body = buildPreview(['field:email', 'form_id', 'ip_address', 'example_currency'], fields, entry);
    expect(Object.keys(body)).toEqual(['event', 'form_id', 'ip_address', 'fields', 'example']);
    expect(body.form_id).toBe(9);
    expect(body.fields).toEqual({ email: 'name@example.com' });
    expect(body.example).toEqual({ currency: 'USD' });
  });

  test('labels are added only with the option, for ticked fields only', () => {
    const body = buildPreview(['field:name', LABELS_OPTION], fields, entry);
    expect(body.answers).toEqual([{ key: 'name', label: 'Name', value: body.fields.name }]);
    expect(buildPreview(['field:name'], fields, entry).answers).toBeUndefined();
  });

  test('unknown or removed keys are dropped', () => {
    expect(cleanSelection(['form_id', 'field:gone', 'nonsense', 'field:name'], fields, [])).toEqual(['form_id', 'field:name']);
  });

  test('selection to JSON and back gives the same ticks', () => {
    const selection = cleanSelection(
      ['form_id', 'form_title', 'submission_id', 'ip_address', 'field:name', 'field:topics', 'field:offices', LABELS_OPTION, 'example_amount', 'example_status'],
      fields
    );
    const text = selectionToTemplate(selection, fields);
    expect(JSON.parse(text).fields.name).toBe('{{field:name}}');
    expect(JSON.parse(text).fields.topics).toBe('{{raw:topics}}');
    expect(JSON.parse(text).ip_address).toBe('{{entry:ip_address}}');
    expect(templateToSelection(text, fields)).toEqual({ kind: 'selection', selection });
  });

  test('every default selection survives the round trip', () => {
    [defaultSelection(fields), fullSelection(fields), []].forEach((selection) => {
      const out = templateToSelection(selectionToTemplate(selection, fields), fields);
      expect(out.kind).toBe('selection');
      expect(out.selection).toEqual(selection);
    });
  });

  test('order and spacing in the JSON do not matter', () => {
    const out = templateToSelection('{"fields":{"name":"{{field:name}}"},"form_id":"{{entry:form_id}}","event":"submission.created"}', fields);
    expect(out).toEqual({ kind: 'selection', selection: ['form_id', 'field:name'] });
  });

  test('a body the checkboxes cannot show stays custom, with a reason', () => {
    const cases = [
      '{"name":"{{name}}"}',
      '{"event":"submission.created","extra":"x"}',
      '{"event":"submission.created","form_id":"7"}',
      '{"event":"submission.created","fields":{"ghost":"{{field:ghost}}"}}',
      '{"event":"submission.created","fields":{"name":"{{field:name}} !"}}',
      '{"event":"submission.created","fields":{"name":"{{field:name}}"},"answers":[]}',
      '{"event":"submission.created", ',
      '[]',
      '{"form_id":"{{entry:form_id}}"}',
    ];
    cases.forEach((text) => {
      const out = templateToSelection(text, fields);
      expect(out.kind).toBe('custom');
      expect(out.reason).toBeTruthy();
    });
  });
});

describe('custom body example', () => {
  const fields = collectPayloadFields(schemaFields);
  const entry = sampleEntry({ formId: 9, formTitle: 'Contact' });

  test('fills tags like the server: text for {{field:key}}, whole lists for {{raw:key}}', () => {
    const out = renderTemplate(
      '{"n":"{{name}}","t":"{form_title}","id":"{{entry_id}}","ip":"{{entry:ip_address}}","l":"{{field:topics}}","r":"{{raw:topics}}","x":"{{nope}}","y":"{nope}"}',
      fields,
      entry
    );
    expect(out.ok).toBe(true);
    expect(out.value).toEqual({
      n: 'Example text',
      t: 'Contact',
      id: '1024',
      ip: '203.0.113.10',
      l: '',
      r: ['Option 1', 'Option 2'],
      x: '',
      y: '{nope}',
    });
  });

  test('an invalid template gives an error, not an exception', () => {
    expect(renderTemplate('{"a":', fields, entry).ok).toBe(false);
  });

  test('the standard body keeps the site and entry links', () => {
    const body = buildFullPreview(fields, entry, 'https://example.com/');
    expect(Object.keys(body)).toEqual(['event', 'form_id', 'form_title', 'submission_id', 'created_at', 'site_url', 'entry_url', 'fields', 'answers']);
    expect(body.entry_url).toContain('submission_id=1024');
  });
});
