/**
 * UpgradePrompt Stories
 */
import UpgradePrompt from '../components/ui/UpgradePrompt';

export default {
  title: 'Components/UpgradePrompt',
  component: UpgradePrompt,
  tags: ['autodocs'],
  argTypes: {
    onUpgrade: { action: 'upgrade clicked' },
  },
};

export const Inline = {
  args: {
    variant: 'inline',
    feature: 'Conditional Logic',
    benefits: [
      'Show or hide fields based on user input',
      'Multi-path form flows',
      'Real-time field validation',
    ],
  },
};

export const Card = {
  args: {
    variant: 'card',
    feature: 'Advanced Analytics',
    benefits: [
      'Track form conversion rates',
      'Export submission data as CSV',
      'View per-field completion rates',
      'Real-time response charts',
    ],
  },
};

export const Banner = {
  args: {
    variant: 'banner',
    feature: 'Spam Protection',
    benefits: ['reCAPTCHA integration', 'Honeypot fields', 'IP rate limiting'],
    ctaText: 'Unlock Pro Features',
  },
};

export const NoIcon = {
  args: {
    variant: 'inline',
    feature: 'Multi-step Forms',
    showIcon: false,
    benefits: ['Break long forms into steps', 'Progress indicators', 'Step validation'],
  },
};

export const NoBenefits = {
  args: {
    variant: 'inline',
    feature: 'Email Notifications',
  },
};
