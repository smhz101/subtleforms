import { nextReviewStatus } from './entryStatus';

describe('nextReviewStatus', () => {
  it('unflags with none instead of completed', () => {
    expect(nextReviewStatus(true)).toBe('none');
    expect(nextReviewStatus(false)).toBe('flagged');
  });
});
