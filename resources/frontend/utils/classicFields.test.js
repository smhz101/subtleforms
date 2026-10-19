import { classicFieldInputs } from './classicFields';

describe('classicFieldInputs', () => {
  it('sends choices and repeater rows as nested fields', () => {
    expect(classicFieldInputs({
      topics: ['a', 'b'],
      items: [{ name: 'Ada' }],
      email: 'a@b.co',
    })).toEqual([
      ['data[topics][]', 'a'],
      ['data[topics][]', 'b'],
      ['data[items][0][name]', 'Ada'],
      ['data[email]', 'a@b.co'],
    ]);
  });
});
