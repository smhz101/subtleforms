import { loadUntilFound } from './loadUntil';

describe('loadUntilFound', () => {
  it('keeps paging until the entry is in the buffer', async () => {
    const pages = [
      [{ id: 1 }],
      [{ id: 1 }, { id: 2 }],
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ];
    let index = 0;
    const found = await loadUntilFound({
      readingId: 3,
      getRows: () => pages[index],
      getTotal: () => 3,
      prefetch: async () => {
        index += 1;
        return pages[index];
      },
    });
    expect(found).toBe(true);
    expect(index).toBe(2);
  });

  it('stops when the next page does not grow', async () => {
    const rows = [{ id: 1 }];
    const found = await loadUntilFound({
      readingId: 9,
      getRows: () => rows,
      getTotal: () => 10,
      prefetch: async () => rows,
    });
    expect(found).toBe(false);
  });
});
