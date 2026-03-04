/**
 * EmptyState Stories
 */
import { EmptyState } from '../ui/loading/EmptyState';

export default {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    onAction: { action: 'action clicked' },
  },
};

export const Default = {
  args: {
    title: 'No forms yet',
    description: 'Create your first form to get started collecting responses.',
  },
};

export const WithAction = {
  args: {
    title: 'No submissions yet',
    description: 'Your submissions will appear here once users start filling out your forms.',
    action: true,
    actionLabel: 'Create your first form',
  },
};

export const WithIcon = {
  args: {
    icon: '📭',
    title: 'Nothing here yet',
    description: 'There are no items matching your current filters.',
    action: true,
    actionLabel: 'Clear filters',
  },
};

export const MinimalDescription = {
  args: {
    title: 'No results found',
  },
};

export const WithLongContent = {
  args: {
    icon: '🔭',
    title: 'We searched everywhere',
    description:
      'We searched high and low but couldn\'t find any forms matching "advanced multi-step payment form with conditional logic". Try a different search term or create a new form.',
    action: true,
    actionLabel: 'Browse Templates',
  },
};
