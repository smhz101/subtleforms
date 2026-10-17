import { formsEmptyState } from './formsEmptyState';

describe('formsEmptyState (QA-19)', () => {
  it('keeps the search message ahead of the tab', () => {
    const state = formsEmptyState('invoice', 'trash');
    expect(state.title).toBe('No forms match your search');
    expect(state.text).toBe('Try a different name, or clear the search.');
    expect(state.showCreate).toBe(false);
  });

  it('uses a different message for trash, draft, published, and an empty All list', () => {
    const trash = formsEmptyState('', 'trash');
    const draft = formsEmptyState('', 'draft');
    const published = formsEmptyState('', 'published');
    const all = formsEmptyState('', 'all');

    expect(trash.title).toBe('The trash is empty');
    expect(draft.title).toBe('No draft forms');
    expect(published.title).toBe('No published forms');
    expect(all.title).toBe('Create your first form');
    expect(all.text).toBe('Start from a template or a blank canvas. You can switch layouts any time.');
    expect(all.showCreate).toBe(true);
    expect(trash.showCreate).toBe(false);
    expect(draft.showCreate).toBe(false);
    expect(published.showCreate).toBe(false);

    const titles = [trash.title, draft.title, published.title, all.title];
    expect(new Set(titles).size).toBe(4);
  });
});
