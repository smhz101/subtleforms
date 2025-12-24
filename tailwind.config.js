/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./resources/admin/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false, // Disable CSS reset to avoid conflicts with WordPress
  },
  important: '.subtleforms-admin', // Scope all Tailwind styles under this class
  theme: {
    // Enforce "Sharp" design by removing border radius
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      full: '0',
    },
    // Enforce "Flat" design by removing shadows
    boxShadow: {
      sm: 'none',
      DEFAULT: 'none',
      md: 'none',
      lg: 'none',
      xl: 'none',
      '2xl': 'none',
      inner: 'none',
      none: 'none',
    },
    extend: {
      colors: {
        // Restrained, high-contrast palette
        primary: {
          DEFAULT: '#111111', // High contrast black/dark gray for primary actions
          hover: '#333333',
          text: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f0f0f1', // WP Gray
          hover: '#dcdcde',
          text: '#1e1e1e',
        },
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f6f7f7',
        },
        border: {
          DEFAULT: '#dcdcde',
          focus: '#111111',
        },
        text: {
          primary: '#1e1e1e',
          secondary: '#50575e',
          tertiary: '#8c8f94',
        },
        // Status colors
        danger: '#d63638',
        success: '#00a32a',
        warning: '#dba617',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Modern font stack
      },
      zIndex: {
        'wp-admin': '160', // Above WordPress admin bar (z-index: 100)
        modal: '170',
        tooltip: '180',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
