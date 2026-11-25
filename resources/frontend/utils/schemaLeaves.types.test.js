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

describe('password confirmation (issue 190)', () => {
  test('is sent with the answers when the field requires it, flat or under config', () => {
    expect(collectLeafInputPaths([{ key: 'pw', type: 'password', requireConfirmation: true }])).toEqual(['pw', 'pw_confirm']);
    expect(collectLeafInputPaths([{ key: 'pw', type: 'password', config: { requireConfirmation: true } }])).toEqual(['pw', 'pw_confirm']);
  });

  test('is not sent when the setting is off', () => {
    expect(collectLeafInputPaths([{ key: 'pw', type: 'password' }])).toEqual(['pw']);
  });
});
