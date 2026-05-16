/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        plum: 'var(--plum)',
        white: 'var(--white)',
        accent: 'var(--accent)',
        'accent-iris': 'var(--accent-iris)',
        'text-1': 'var(--text-1)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        hairline: 'var(--hairline)',
        'hairline-hi': 'var(--hairline-hi)',
        'hairline-bright': 'var(--hairline-bright)',
        ok: 'var(--ok)',
        teal: 'var(--teal)',
        warn: 'var(--warn)',
        err: 'var(--err)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
    },
  },
  plugins: [],
};
