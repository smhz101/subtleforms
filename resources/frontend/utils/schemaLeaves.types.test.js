import { collectLeafInputPaths } from './schemaLeaves';
import { registerFieldType } from '../../shared/extend';

describe('answers that reach the server (2.2.1 bugs 14 and 15)', () => {
  test.each(['toggle', 'scale', 'picture_choice'])(
    '%s is sent with the submission',
    (type) => {
      expect(collectLeafInputPaths([{ key: 'k', type }])).toEqual(['k']);
    }
  );

  test('an add-on field type is sent once its add-on registers it (2.3.9)', () => {
    expect(collectLeafInputPaths([{ key: 'k', type: 'qa_addon' }])).toEqual([]);
    registerFieldType('qa_addon', { component: () => null });
    expect(collectLeafInputPaths([{ key: 'k', type: 'qa_addon' }])).toEqual(['k']);
  });
});
