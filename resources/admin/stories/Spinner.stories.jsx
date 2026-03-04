/**
 * Spinner Stories
 */
import { Spinner, InlineSpinner } from '../ui/loading/Spinner';

export default {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
};

export const Small = { args: { size: 'small' } };
export const Medium = { args: { size: 'medium' } };
export const Large = { args: { size: 'large' } };

export const AllSizes = () => (
  <div style={{ display: 'flex', gap: 32, alignItems: 'center', padding: 24 }}>
    <div style={{ textAlign: 'center' }}>
      <Spinner size="small" />
      <p style={{ fontSize: 12, marginTop: 8 }}>Small</p>
    </div>
    <div style={{ textAlign: 'center' }}>
      <Spinner size="medium" />
      <p style={{ fontSize: 12, marginTop: 8 }}>Medium</p>
    </div>
    <div style={{ textAlign: 'center' }}>
      <Spinner size="large" />
      <p style={{ fontSize: 12, marginTop: 8 }}>Large</p>
    </div>
  </div>
);

export const Inline = {
  render: () => (
    <div style={{ padding: 24 }}>
      <InlineSpinner text="Loading forms..." />
    </div>
  ),
};

export const InlineNoText = {
  render: () => (
    <div style={{ padding: 24 }}>
      <InlineSpinner />
    </div>
  ),
};
