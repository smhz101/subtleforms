import { readInlineFormData, inlineDataId } from './inlineData';

const put = (id, text) => {
  document.body.innerHTML = `<script type="application/json" id="${inlineDataId(id)}"></script>`;
  document.getElementById(inlineDataId(id)).textContent = text;
};

test('reads the schema, the signed load time and the version', () => {
  put(5, JSON.stringify({ form: { id: 5 }, schema: { fields: [] }, version: 3, spam_token: 'v1.1.5.x' }));
  expect(readInlineFormData(5)).toEqual({ schema: { fields: [] }, spamToken: 'v1.1.5.x', version: 3 });
});

test('reads data the server escaped for a script tag', () => {
  // wp_json_encode with JSON_HEX_TAG, AMP, APOS and QUOT.
  put(6, '{"schema":{"fields":[{"label":"\\u003C\\/script\\u003E \\u0026 \\u0027Hi\\u0027 \\u0022"}]}}');
  const data = readInlineFormData(6);
  expect(data.schema.fields[0].label).toBe('</script> & \'Hi\' "');
  expect(data.spamToken).toBe('');
});

test('is null without the tag, for another form, or when it cannot be read', () => {
  document.body.innerHTML = '';
  expect(readInlineFormData(5)).toBeNull();
  put(5, '{"schema":{}}');
  expect(readInlineFormData(7)).toBeNull();
  put(5, 'not json');
  expect(readInlineFormData(5)).toBeNull();
  put(5, '{"schema":null}');
  expect(readInlineFormData(5)).toBeNull();
  put(5, '{"schema":[1]}');
  expect(readInlineFormData(5)).toBeNull();
  expect(readInlineFormData(0)).toBeNull();
});
