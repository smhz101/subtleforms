import { deletesPermanently } from './deleteBehavior';

describe('deletesPermanently', () => {
  it('follows the saved behavior and the trash tab', () => {
    expect(deletesPermanently('soft', false)).toBe(false);
    expect(deletesPermanently('hard', false)).toBe(true);
    expect(deletesPermanently('soft', true)).toBe(true);
  });
});
