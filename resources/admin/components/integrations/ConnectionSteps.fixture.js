/**
 * A story-like fixture for ConnectionSteps: one of each kind of step, used by
 * the test and handy to paste into a story.
 */
export const STEPS_FIXTURE = {
  title: 'Connect Example',
  intro: 'You need an Example account and about two minutes.',
  steps: [
    { text: 'Open your Example account and sign in.', href: 'https://example.com/login', hrefLabel: 'Open Example' },
    { text: 'Press "Create key", give it a name and copy it.' },
    { text: 'Use this address as the endpoint.', code: 'https://example.com/wp-json/subtleforms/v1/hook' },
    { text: 'Paste the key below and press "Save and connect".' },
  ],
  note: 'The key is stored on this site and is never shown again.',
};

/** Every address in a list of steps. */
export const hrefsOf = (steps) => steps.filter((step) => step && step.href).map((step) => step.href);
