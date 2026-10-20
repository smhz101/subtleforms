/**
 * @jest-environment jsdom
 */

import { askConfirm, subscribeConfirm } from './confirmDialog';

describe('askConfirm', () => {
  afterEach(() => {
    // Clear any leftover host.
    subscribeConfirm(() => {})();
  });

  it('resolves true when the host confirms', async () => {
    const unsub = subscribeConfirm((request) => {
      expect(request.message).toBe('Delete this?');
      request.resolve(true);
    });
    await expect(
      askConfirm({ message: 'Delete this?', confirmVariant: 'destructive' })
    ).resolves.toBe(true);
    unsub();
  });

  it('resolves false when the host cancels', async () => {
    const unsub = subscribeConfirm((request) => {
      request.resolve(false);
    });
    await expect(askConfirm({ message: 'Sure?' })).resolves.toBe(false);
    unsub();
  });
});
