import { tokenAge, createSpamTokenSource } from './spamToken';
import { restFetch } from './restFetch';

jest.mock('./restFetch', () => ({ restFetch: jest.fn() }));

const ticket = 't1.1700000000.9.abcdefabcdefabcdefabcdefabcdefab';
const ok = (token) => ({ ok: true, json: async () => ({ data: { spam_token: token } }) });

beforeEach(() => restFetch.mockReset());

test('reads the age from a ticket or a token', () => {
  expect(tokenAge(ticket, 1700000100)).toBe(100);
  expect(tokenAge('s1.1700000000.9.aaaaaaaaaaaaaaaa.bbbb', 1700000100)).toBe(100);
  expect(tokenAge('nope')).toBeNull();
});

test('the ticket is traded once on first interaction, not on every focus', async () => {
  restFetch.mockResolvedValue(ok('s1.1700000000.9.aaaaaaaaaaaaaaaa.x'));
  const source = createSpamTokenSource(9);
  source.prime(ticket);
  source.prime(ticket);
  expect(restFetch).toHaveBeenCalledTimes(1);
  expect(restFetch).toHaveBeenCalledWith('/forms/9/spam-token', { method: 'POST', body: { token: ticket } });
  await expect(source.take(ticket, 1700000100)).resolves.toBe('s1.1700000000.9.aaaaaaaaaaaaaaaa.x');
  expect(restFetch).toHaveBeenCalledTimes(1);
});

test('a submit without an earlier interaction trades the ticket then', async () => {
  restFetch.mockResolvedValue(ok('s1.1700000000.9.bbbbbbbbbbbbbbbb.x'));
  await expect(createSpamTokenSource(9).take(ticket, 1700000100)).resolves.toBe('s1.1700000000.9.bbbbbbbbbbbbbbbb.x');
});

test('each submit gets its own token', async () => {
  restFetch.mockResolvedValueOnce(ok('s1.1700000000.9.aaaaaaaaaaaaaaaa.x')).mockResolvedValueOnce(ok('s1.1700000000.9.cccccccccccccccc.x'));
  const source = createSpamTokenSource(9);
  source.prime(ticket);
  const first = await source.take(ticket, 1700000100);
  const second = await source.take(ticket, 1700000100);
  expect(first).not.toBe(second);
});

test('a failed trade is retried once at submit', async () => {
  restFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(ok('s1.1700000000.9.dddddddddddddddd.x'));
  const source = createSpamTokenSource(9);
  source.prime(ticket);
  await expect(source.take(ticket, 1700000100)).resolves.toBe('s1.1700000000.9.dddddddddddddddd.x');
  expect(restFetch).toHaveBeenCalledTimes(2);
});

test('when every trade fails the ticket is sent and the server answers', async () => {
  restFetch.mockRejectedValue(new Error('offline'));
  await expect(createSpamTokenSource(9).take(ticket, 1700000100)).resolves.toBe(ticket);
  expect(restFetch).toHaveBeenCalledTimes(2);
});

test('a token held for over an hour is traded again', async () => {
  restFetch.mockResolvedValueOnce(ok('s1.1700000000.9.aaaaaaaaaaaaaaaa.x')).mockResolvedValueOnce(ok('s2.1700009999.9.eeeeeeeeeeeeeeee.x'));
  const source = createSpamTokenSource(9);
  source.prime(ticket);
  await expect(source.take(ticket, 1700009999)).resolves.toBe('s2.1700009999.9.eeeeeeeeeeeeeeee.x');
});
