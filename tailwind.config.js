/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./resources/admin/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false, // Disable CSS reset to avoid conflicts with WordPress
  },
  important: '.subtleforms-admin', // Scope all Tailwind styles under this class
  theme: {
    extend: {
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
