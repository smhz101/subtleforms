import vectors from '../../tests/fixtures/date-limit-vectors.json';
import { dateLimitMessage, timeLimitMessage } from './dateLimits';

const noon = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0);
};

describe('date limits match the shared vectors', () => {
  test.each(vectors.date.map((v, i) => [i, v]))('date vector %i', (_i, v) => {
    expect(dateLimitMessage(v.value, v.config, 'date', noon(v.today))).toBe(v.message);
  });

  test.each(vectors.datetime.map((v, i) => [i, v]))('datetime vector %i', (_i, v) => {
    expect(dateLimitMessage(v.value, v.config, 'datetime', noon(v.today))).toBe(v.message);
  });

  test.each(vectors.time.map((v, i) => [i, v]))('time vector %i', (_i, v) => {
    expect(timeLimitMessage(v.value, v.config, v.mode)).toBe(v.message);
  });
});
