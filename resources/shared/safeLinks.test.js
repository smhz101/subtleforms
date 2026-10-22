import { safeHref, messageParts, messageParagraphs, isExternalHref } from './safeLinks';

describe('safeHref', () => {
  test.each([
    ['https://example.com/a?b=1#c', 'https://example.com/a?b=1#c'],
    ['http://example.com', 'http://example.com'],
    ['HTTPS://EXAMPLE.COM/x', 'HTTPS://EXAMPLE.COM/x'],
    ['/thank-you', '/thank-you'],
    ['/a/b?c=d', '/a/b?c=d'],
  ])('allows %s', (input, expected) => {
    expect(safeHref(input)).toBe(expected);
  });

  test.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\nscript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'mailto:a@example.com',
    '//evil.example.com/x',
    '/\\evil.example.com',
    'thank-you',
    '',
    'https://',
    'https://exa mple.com',
  ])('rejects %j', (input) => {
    expect(safeHref(input)).toBe('');
  });
});

describe('messageParts', () => {
  test('plain text stays one text part', () => {
    expect(messageParts('Thanks, we will be in touch.')).toEqual([{ type: 'text', text: 'Thanks, we will be in touch.' }]);
  });

  test('a markdown style link becomes a link part', () => {
    expect(messageParts('Read [our guide](https://example.com/guide) now.')).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', text: 'our guide', href: 'https://example.com/guide' },
      { type: 'text', text: ' now.' },
    ]);
  });

  test('a site-relative link is allowed', () => {
    expect(messageParts('[Your account](/my-account/)')).toEqual([{ type: 'link', text: 'Your account', href: '/my-account/' }]);
  });

  test('a bare address becomes a link and keeps the full stop outside it', () => {
    expect(messageParts('Visit https://example.com/pricing.')).toEqual([
      { type: 'text', text: 'Visit ' },
      { type: 'link', text: 'https://example.com/pricing', href: 'https://example.com/pricing' },
      { type: 'text', text: '.' },
    ]);
  });

  test('a javascript: address is rejected and stays plain text', () => {
    const parts = messageParts('Click [here](javascript:alert(1)) please');
    expect(parts.every((p) => p.type === 'text')).toBe(true);
    expect(parts.map((p) => p.text).join('')).toContain('here');
  });

  test('javascript: and data: addresses in link form never produce a link', () => {
    ['[x](javascript:alert(document.cookie))', '[x](JAVASCRIPT:alert(1))', '[x](data:text/html;base64,PHNjcmlwdD4=)', '[x](//evil.example)'].forEach((text) => {
      expect(messageParts(text).some((p) => p.type === 'link')).toBe(false);
    });
  });

  test('HTML in a message is only ever text', () => {
    const parts = messageParts('<img src=x onerror=alert(1)> <a href="javascript:alert(1)">x</a>');
    expect(parts).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)> <a href="javascript:alert(1)">x</a>' }]);
  });

  test('merge tags are filled after links are found, so an answer cannot make a link', () => {
    const answers = { name: '[click](https://evil.example)', code: 'a b' };
    const merge = (text, isAddress) =>
      text.replace(/\{(\w+)\}/g, (m, key) => (isAddress ? encodeURIComponent(answers[key]) : answers[key]));
    const parts = messageParts('Hi {name}. Track it at [your page](https://example.com/t?c={code})', merge);
    expect(parts.filter((p) => p.type === 'link')).toEqual([{ type: 'link', text: 'your page', href: 'https://example.com/t?c=a%20b' }]);
    expect(parts[0].text).toBe('Hi [click](https://evil.example). Track it at ');
  });

  test('an answer filled into an address cannot turn it into a javascript: address', () => {
    const merge = (text, isAddress) => text.replace('{u}', isAddress ? encodeURIComponent('javascript:alert(1)') : 'x');
    const parts = messageParts('[go]({u})', merge);
    expect(parts.some((p) => p.type === 'link')).toBe(false);
  });
});

describe('messageParagraphs', () => {
  test('a blank line starts a new paragraph', () => {
    const out = messageParagraphs('One\n\nTwo [x](/y)');
    expect(out).toHaveLength(2);
    expect(out[1][1]).toEqual({ type: 'link', text: 'x', href: '/y' });
  });
});

describe('isExternalHref', () => {
  test('tells another site from this one', () => {
    expect(isExternalHref('https://other.example/x', 'https://site.example')).toBe(true);
    expect(isExternalHref('https://site.example/x', 'https://site.example')).toBe(false);
    expect(isExternalHref('/x', 'https://site.example')).toBe(false);
  });
});
