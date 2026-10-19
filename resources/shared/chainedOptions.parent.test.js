import { chainedSelectLevels } from './chainedOptions';

test('the second dropdown lists only the chosen make', () => {
  const rows = chainedSelectLevels(
    {
      levels: [
        { label: 'Make', options: [{ label: 'Ford', value: 'ford' }, { label: 'Honda', value: 'honda' }] },
        {
          label: 'Model',
          options: [
            { label: 'Focus', value: 'focus', parent: 'ford' },
            { label: 'Civic', value: 'civic', parent: 'honda' },
          ],
        },
      ],
    },
    ['ford']
  );
  expect(rows[0].label).toBe('Make');
  expect(rows[1].options.map((option) => option.value)).toEqual(['focus']);
});
