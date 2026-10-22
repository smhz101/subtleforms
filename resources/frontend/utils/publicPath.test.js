import { chunkBase } from './publicPath';

describe('chunkBase', () => {
  const assets = 'https://example.com/wp-content/plugins/subtleforms/build/frontend/';

  test('keeps the automatic folder when the main script is where it was built', () => {
    expect(chunkBase(`${assets}frontend.js?ver=1`, assets)).toBe('');
    expect(chunkBase('https://cdn.example.com/p/subtleforms/build/frontend/frontend.js', assets)).toBe('');
  });

  test('uses the plugin folder when a speed plugin combined or moved the script', () => {
    expect(chunkBase('https://example.com/wp-content/cache/min/all.js', assets)).toBe(assets);
    expect(chunkBase('', assets)).toBe(assets);
    expect(chunkBase('', 'https://example.com/x/build/frontend')).toBe('https://example.com/x/build/frontend/');
  });

  test('changes nothing without a plugin folder', () => {
    expect(chunkBase('https://example.com/wp-content/cache/min/all.js', '')).toBe('');
    expect(chunkBase('', undefined)).toBe('');
  });
});
