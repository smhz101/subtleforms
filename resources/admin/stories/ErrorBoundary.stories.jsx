/**
 * ErrorBoundary Stories
 */
import { ErrorBoundary } from '../ui/feedback/ErrorBoundary';
import { PageErrorBoundary } from '../components/PageErrorBoundary';

// A component that intentionally throws
function ThrowingComponent({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Simulated render error for Storybook demo');
  }
  return (
    <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 6, border: '1px solid #86efac' }}>
      ✅ Component rendered successfully. Toggle "shouldThrow" to simulate an error.
    </div>
  );
}

export default {
  title: 'Components/ErrorBoundary',
  tags: ['autodocs'],
};

export const NoError = {
  render: () => (
    <ErrorBoundary>
      <ThrowingComponent shouldThrow={false} />
    </ErrorBoundary>
  ),
};

export const WithError = {
  render: () => (
    <ErrorBoundary>
      <ThrowingComponent shouldThrow={true} />
    </ErrorBoundary>
  ),
};

export const PageBoundaryNoError = {
  render: () => (
    <PageErrorBoundary pageName="Forms">
      <ThrowingComponent shouldThrow={false} />
    </PageErrorBoundary>
  ),
};

export const PageBoundaryWithError = {
  render: () => (
    <PageErrorBoundary pageName="Forms">
      <ThrowingComponent shouldThrow={true} />
    </PageErrorBoundary>
  ),
};
