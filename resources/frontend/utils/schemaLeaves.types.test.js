import { collectLeafInputPaths } from './schemaLeaves';

describe('answers that reach the server (2.2.1 bugs 14 and 15)', () => {
  test.each(['toggle', 'scale', 'picture_choice', 'signature', 'calculation'])(
    '%s is sent with the submission',
    (type) => {
      expect(collectLeafInputPaths([{ key: 'k', type }])).toEqual(['k']);
    }
  );
});
