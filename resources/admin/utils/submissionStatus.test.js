/**
 * PAY-22: an entry whose payment failed reads "Payment failed" everywhere.
 */
import fs from 'fs';
import path from 'path';
import { submissionStatus } from './submissionStatus';

describe('PAY-22 entry status labels', () => {
  it('labels payment_failed as Payment failed', () => {
    expect(submissionStatus('payment_failed')).toEqual({ label: 'Payment failed', cls: 'sf-pill--danger' });
    expect(submissionStatus('payment_pending').label).toBe('Awaiting payment');
    expect(submissionStatus('unread').label).toBe('Received');
  });

  it.each([
    '../components/SubmissionsTable.jsx',
    '../pages/DashboardPage.jsx',
    '../pages/SubmissionDetailPage.jsx',
  ])('%s uses the shared labels', (file) => {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    expect(src).toMatch(/submissionStatus\(/);
  });
});

describe('FF-14 preview entries', () => {
  it('labels a preview entry Preview', () => {
    expect(submissionStatus('preview').label).toBe('Preview');
  });
});
