import { tokenAge, freshSpamToken } from './spamToken';
import { restFetch } from './restFetch';

jest.mock('./restFetch', () => ({ restFetch: jest.fn() }));

const old = 'v1.1700000000.9.abcdefabcdefabcdefabcdefabcdefab';

beforeEach(() => restFetch.mockReset());

test('reads the age from the token', () => {
  expect(tokenAge(old, 1700000100)).toBe(100);
  expect(tokenAge('nope')).toBeNull();
});

test('a recent token is sent as it is, with no request', async () => {
  await expect(freshSpamToken(9, old, 1700000100)).resolves.toBe(old);
  expect(restFetch).not.toHaveBeenCalled();
});

test('an old token is exchanged for a fresh one', async () => {
  restFetch.mockResolvedValue({ ok: true, json: async () => ({ data: { spam_token: 'v2.1700009999.9.x' } }) });
  await expect(freshSpamToken(9, old, 1700009999)).resolves.toBe('v2.1700009999.9.x');
  expect(restFetch).toHaveBeenCalledWith('/forms/9/spam-token', { method: 'POST', body: { token: old } });
});

test('a failed exchange keeps the old token', async () => {
  restFetch.mockRejectedValue(new Error('offline'));
  await expect(freshSpamToken(9, old, 1700009999)).resolves.toBe(old);
});
