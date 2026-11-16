/**
 * The block icon keeps a margin around the mark, so it is no larger than the
 * core block icons next to it in the inserter.
 */
import icon from './icon.jsx';

test('the mark sits inside a padded view box', () => {
  expect(icon.props.viewBox).toBe('-64 -64 640 640');
});
