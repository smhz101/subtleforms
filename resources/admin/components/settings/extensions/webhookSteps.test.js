/**
 * The webhook steps: no outside service, so every link is an admin page of
 * this site, and the sample body is valid JSON with the keys a webhook sends.
 */
import { webhookSteps, SAMPLE_PAYLOAD } from './webhookSteps';
import { isSafeHref } from '../../integrations/ConnectionSteps';
import { hrefsOf } from '../../integrations/ConnectionSteps.fixture';

describe('webhookSteps', () => {
  const guide = webhookSteps();
  const text = [guide.intro, guide.note, ...guide.steps.map((s) => s.text)].join('\n');

  test('links are non-empty and safe', () => {
    const hrefs = hrefsOf(guide.steps);
    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach((href) => expect(isSafeHref(href)).toBe(true));
    expect(hrefs.some((href) => href.includes('page=subtleforms-forms'))).toBe(true);
    expect(hrefs.some((href) => href.includes('page=subtleforms-settings#tab=extensions&ext=webhooks'))).toBe(true);
  });

  test('the sample body is JSON with the keys a webhook sends', () => {
    const body = JSON.parse(SAMPLE_PAYLOAD);
    expect(Object.keys(body)).toEqual(expect.arrayContaining(['event', 'form_id', 'submission_id', 'entry_url', 'fields', 'answers']));
    expect(guide.steps.find((s) => s.code).code).toBe(SAMPLE_PAYLOAD);
  });

  test('names the buttons and follows the writing rules', () => {
    expect(text).toContain('"Send to webhook"');
    expect(text).toContain('"Webhook URL"');
    expect(text).toContain('"Send test request"');
    expect(text).not.toMatch(/\u2014|\u2013/);
    expect(text).not.toMatch(/\b(simply|just|easily)\b/i);
  });
});
