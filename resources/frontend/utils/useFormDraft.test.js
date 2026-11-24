import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { draftKeeper, clearDraft } from './useFormDraft';
import { draftKey } from './formDraft';

global.IS_REACT_ACT_ENVIRONMENT = true;

const schema = {
  fields: [
    { type: 'text', key: 'a' },
    { type: 'password', key: 'pw' },
    { type: 'file_upload', key: 'doc' },
    { type: 'signature', key: 'sig' },
    { type: 'payment_product', key: 'pay' },
    { type: 'turnstile', key: 'cap' },
  ],
};
const KEY = draftKey(5, 1);

function Probe({ props, out }) {
  out.current = { clear: () => clearDraft(5, 1) };
  return draftKeeper({ enabled: true, formId: 5, instance: 1, schema, stepCount: 3, step: 1, setValues: () => {}, setStep: () => {}, values: {}, ...props });

}

async function run(props) {
  const out = { current: null };
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Probe props={props} out={out} />));
  await act(async () => { await import('./formDraft'); });
  await act(async () => {});
  return { out, root };
}

const wait = (ms) => act(async () => { jest.advanceTimersByTime(ms); });
const stored = () => JSON.parse(window.sessionStorage.getItem(KEY));

beforeEach(() => {
  jest.useFakeTimers();
  window.sessionStorage.clear();
});
afterEach(() => jest.useRealTimers());

it('saves after a change, 400 ms later', async () => {
  await run({ values: { a: 'x' }, step: 1 });
  expect(stored()).toBeNull();
  await wait(400);
  expect(stored()).toMatchObject({ v: 1, step: 1, values: { a: 'x' } });
});

it('restores values and step', async () => {
  window.sessionStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), step: 2, values: { a: 'y' } }));
  const setValues = jest.fn(); const setStep = jest.fn(); const setView = jest.fn();
  await run({ setValues, setStep, setView });
  expect(setStep).toHaveBeenCalledWith(2);
  expect(setView).toHaveBeenCalledWith('questions');
  expect(setValues.mock.calls[0][0]({})).toEqual({ a: 'y' });
});

it('never writes excluded types', async () => {
  await run({ values: { a: '1', pw: 'p', doc: 'd', sig: 's', pay: 'p', cap: 'c' } });
  await wait(400);
  expect(stored().values).toEqual({ a: '1' });
});

it('ignores a 25 hour old draft and a wrong version', async () => {
  const setValues = jest.fn(); const setStep = jest.fn(); const setView = jest.fn();
  window.sessionStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now() - 25 * 3600 * 1000, step: 1, values: { a: 'y' } }));
  await run({ setValues, setStep, setView });
  window.sessionStorage.setItem(KEY, JSON.stringify({ v: 2, savedAt: Date.now(), step: 1, values: { a: 'y' } }));
  await run({ setValues, setStep, setView });
  expect(setStep).not.toHaveBeenCalled();
});

it('drops unknown keys and clamps the step', async () => {
  window.sessionStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), step: 9, values: { a: 'y', gone: 'z', pw: 'p' } }));
  const setValues = jest.fn(); const setStep = jest.fn(); const setView = jest.fn();
  await run({ setValues, setStep, setView });
  expect(setStep).toHaveBeenCalledWith(2);
  expect(setView).toHaveBeenCalledWith('questions');
  expect(setValues.mock.calls[0][0]({})).toEqual({ a: 'y' });
});

it('clear removes the draft', async () => {
  const { out } = await run({ values: { a: 'x' } });
  await wait(400);
  expect(stored()).not.toBeNull();
  out.current.clear();
  await act(async () => {});
  expect(stored()).toBeNull();
});

it('does not crash when storage throws', async () => {
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const rm = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  const { out } = await run({ values: { a: 'x' } });
  await wait(400);
  expect(() => out.current.clear()).not.toThrow();
  await act(async () => {});
  get.mockRestore(); set.mockRestore(); rm.mockRestore();
});
