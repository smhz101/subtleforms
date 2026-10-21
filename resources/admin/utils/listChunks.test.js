import { chunkPagesFor, MAX_API_PAGE_SIZE } from './listChunks';

describe('chunkPagesFor', () => {
  test.each([
    [10, 5],
    [20, 5],
    [50, 2],
    [100, 1],
  ])('%d rows a page fetches %d pages at once, never over the API limit', (perPage, pages) => {
    expect(chunkPagesFor(perPage, 5)).toBe(pages);
    expect(perPage * chunkPagesFor(perPage, 5)).toBeLessThanOrEqual(MAX_API_PAGE_SIZE);
  });

  test('a bad value still fetches one page', () => {
    expect(chunkPagesFor(0, 5)).toBeGreaterThanOrEqual(1);
    expect(chunkPagesFor('x', 5)).toBeGreaterThanOrEqual(1);
  });
});
