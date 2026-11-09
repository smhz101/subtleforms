/**
 * The HubSpot service key steps: real HubSpot pages, the scopes the code
 * calls, the legacy note, and the writing rules.
 */
import { hubspotSteps, HUBSPOT_SCOPES, HUBSPOT_APP, HUBSPOT_SERVICE_KEYS_GUIDE } from './hubspotSteps';
import { isSafeHref } from '../ConnectionSteps';
import { hrefsOf } from '../ConnectionSteps.fixture';

describe('hubspotSteps', () => {
  const guide = hubspotSteps();
  const text = [guide.intro, guide.note, ...guide.steps.map((s) => s.text)].join('\n');

  test('every address is https and non-empty', () => {
    const hrefs = hrefsOf(guide.steps);
    expect(hrefs).toEqual(expect.arrayContaining([HUBSPOT_APP, HUBSPOT_SERVICE_KEYS_GUIDE]));
    hrefs.forEach((href) => expect(isSafeHref(href)).toBe(true));
    expect(HUBSPOT_APP).toBe('https://app.hubspot.com/');
  });

  test('names the menu path, the buttons and the scopes the free plugin calls', () => {
    expect(text).toContain('Development');
    expect(text).toContain('Service keys');
    expect(text).toContain('"Create service key"');
    expect(text).toContain('"Add new scope"');
    expect(text).toContain('"Show"');
    expect(text).toContain('"Save and connect"');
    expect(HUBSPOT_SCOPES).toEqual(['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.schemas.contacts.read']);
    expect(guide.steps.find((s) => s.code).code).toBe(HUBSPOT_SCOPES.join('\n'));
  });

  test('says a legacy private app token still works and what rotation means', () => {
    expect(guide.note).toContain('legacy private app access token also works');
    expect(guide.note).toContain('Legacy apps');
    expect(guide.note).toContain('rotates');
  });

  test('a caller can list more scopes (the Pro extras)', () => {
    const more = hubspotSteps({ scopes: [...HUBSPOT_SCOPES, 'crm.objects.deals.write'] });
    expect(more.steps.find((s) => s.code).code).toContain('crm.objects.deals.write');
  });

  test('follows the writing rules', () => {
    expect(text).not.toMatch(/\u2014|\u2013/);
    expect(text).not.toMatch(/\b(simply|just|easily)\b/i);
  });
});
