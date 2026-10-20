/**
 * UX2-10: every confirmation and error notice in the admin uses ConfirmModal.
 */
jest.mock('../modals/ConfirmModal.scss', () => ({}));
import { act } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import fs from 'fs';
import path from 'path';
import { confirmDialog, noticeDialog } from './confirmDialog';

describe('confirmDialog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('resolves true when the primary button is pressed', async () => {
    let promise;
    await act(async () => {
      promise = confirmDialog({ message: 'Delete coupon SAVE10?', confirmText: 'Delete coupon', destructive: true });
    });
    expect(screen.getByText('Delete coupon SAVE10?')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete coupon' }));
    });
    await expect(promise).resolves.toBe(true);
    await waitFor(() => expect(document.querySelector('.subtleforms-dialog-host')).toBeNull());
  });

  test('resolves false on Cancel', async () => {
    let promise;
    await act(async () => {
      promise = confirmDialog({ message: 'Discard changes?' });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    await expect(promise).resolves.toBe(false);
  });

  test('a notice has one OK button', async () => {
    let promise;
    await act(async () => {
      promise = noticeDialog({ message: 'Failed to export submissions' });
    });
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    });
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('no native dialogs in the admin', () => {
  test('window.confirm and window.alert are not used', () => {
    const root = path.resolve(__dirname, '..');
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(jsx?|tsx?)$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (/(^|[^.\w])(window\.)?(confirm|alert)\(/m.test(src.replace(/confirmDialog\(|noticeDialog\(/g, ''))) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
