import { chunkPages, MAX_ROWS_PER_REQUEST } from './listBatches';

describe('chunkPages (review of #47)', () => {
	test('never asks for more rows than one request allows', () => {
		[10, 20, 50, 100].forEach((perPage) => {
			expect(perPage * chunkPages(perPage)).toBeLessThanOrEqual(MAX_ROWS_PER_REQUEST);
		});
	});

	test('keeps five pages at a time when they fit', () => {
		expect(chunkPages(10)).toBe(5);
		expect(chunkPages(20)).toBe(5);
		expect(chunkPages(50)).toBe(2);
		expect(chunkPages(100)).toBe(1);
	});

	test('handles odd input', () => {
		expect(chunkPages(0)).toBe(5);
		expect(chunkPages('50')).toBe(2);
		expect(chunkPages(250)).toBe(1);
	});
});
