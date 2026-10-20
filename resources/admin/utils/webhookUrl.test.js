import { normalizeWebhookUrl } from './webhookUrl';

describe('normalizeWebhookUrl (2.4.1)', () => {
  test('adds https:// when no scheme was typed', () => {
    expect(normalizeWebhookUrl('hooks.example.com/abc')).toBe('https://hooks.example.com/abc');
    expect(normalizeWebhookUrl('  //hooks.example.com/abc ')).toBe('https://hooks.example.com/abc');
  });

  test('keeps an address that has a scheme', () => {
    expect(normalizeWebhookUrl('http://127.0.0.1:5678/webhook')).toBe('http://127.0.0.1:5678/webhook');
    expect(normalizeWebhookUrl('HTTPS://Example.com')).toBe('HTTPS://Example.com');
  });

  test('leaves an empty value empty', () => {
    expect(normalizeWebhookUrl('')).toBe('');
    expect(normalizeWebhookUrl(undefined)).toBe('');
  });
});
