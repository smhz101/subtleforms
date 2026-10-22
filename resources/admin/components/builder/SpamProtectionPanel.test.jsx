/**
 * A form's spam protection settings (2.6.0): the switches show what the
 * server does, a change writes metadata.spam, and the form's 30-day count.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import SpamProtectionPanel from './SpamProtectionPanel';

const mockUseSpamStats = jest.fn(() => ({ data: undefined }));
jest.mock('../../data', () => ({ useSpamStats: (...args) => mockUseSpamStats(...args) }));

global.IS_REACT_ACT_ENVIRONMENT = true;

function mount(props) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SpamProtectionPanel onMetadata={() => {}} {...props} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

const toggles = (container) => [...container.querySelectorAll('input[type="checkbox"]')];

describe('SpamProtectionPanel', () => {
  test('a new form shows both switches on and writes the change', () => {
    const onMetadata = jest.fn();
    const { container, unmount } = mount({
      onMetadata,
      schema: { metadata: { spam: { honeypot: true, timeTrap: true } } },
      stats: { total: 0, reasons: {}, fallback: { honeypot: true, timeTrap: false }, min_seconds: 3 },
    });

    const [honeypot, timeTrap] = toggles(container);
    expect(honeypot.checked).toBe(true);
    expect(timeTrap.checked).toBe(true);
    expect(container.textContent).toContain('Hidden trap field');
    expect(container.textContent).toContain('Too-fast check');
    expect(container.textContent).toContain('No spam blocked yet.');

    act(() => timeTrap.click());
    expect(onMetadata).toHaveBeenCalledWith('spam', { honeypot: true, timeTrap: false });
    unmount();
  });

  test('an older form without its own choice shows what the server does', () => {
    const { container, unmount } = mount({
      schema: { metadata: {} },
      stats: { total: 0, reasons: {}, fallback: { honeypot: true, timeTrap: false }, min_seconds: 3 },
    });
    const [honeypot, timeTrap] = toggles(container);
    expect(honeypot.checked).toBe(true);
    expect(timeTrap.checked).toBe(false);
    unmount();
  });

  test("shows this form's 30-day count by reason", () => {
    const { container, unmount } = mount({
      schema: { metadata: {} },
      stats: { total: 12, reasons: { honeypot: 9, time_trap: 3 }, fallback: { honeypot: true, timeTrap: true }, min_seconds: 3 },
    });
    expect(container.textContent).toContain('12 spam messages blocked on this form in the last 30 days.');
    expect(container.textContent).toContain('Hidden trap field: 9');
    expect(container.textContent).toContain('Sent too fast: 3');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    unmount();
  });

  test('asks the server for this form', () => {
    mockUseSpamStats.mockClear();
    const { unmount } = mount({ schema: { metadata: {} }, formId: 12 });
    expect(mockUseSpamStats).toHaveBeenCalledWith({ days: 30, formId: 12 }, { enabled: true });
    unmount();
  });
});
