const {
  colors: designColors,
  spacing: tokenSpacing,
  shadows: tokenShadows,
  transitions: tokenTransitions,
} = require('./src/lib/constants/designTokens.js');

/** @type {import('tailwindcss').Config}*/
const config = {
  content: [
    "./src/**/*.{html,js,svelte,ts}",
    "./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}"
  ],
  theme: {
    extend: {
      colors: {
        background: designColors.background,
        surface: designColors.surface,
        elevated: designColors.elevated,
        overlay: designColors.overlay,
        scrim: designColors.scrim,
        text: {
          primary: designColors.textPrimary,
          secondary: designColors.textSecondary,
          muted: designColors.textMuted,
        },
        border: {
          subtle: designColors.borderSubtle,
          strong: designColors.borderStrong,
        },
        accent: {
          DEFAULT: designColors.accentPrimary,
          primary: designColors.accentPrimary,
          secondary: designColors.accentSecondary,
          tertiary: designColors.accentTertiary,
        },
        success: designColors.success,
        warning: designColors.warning,
        danger: designColors.danger,
        focus: designColors.focusRing,
        primary: {
          DEFAULT: designColors.accentPrimary,
          50: '#0b1a26',
          100: '#123048',
          200: '#18466a',
          300: '#1f5b8d',
          400: '#2563a8',
          500: designColors.accentPrimary,
          600: '#3f94e0',
          700: '#3276ba',
          800: '#255794',
          900: '#173a61',
        },
      },
      spacing: {
        ...tokenSpacing,
        'ratio-16-9': '56.25%',
        'ratio-9-16': '177.78%',
      },
      aspectRatio: {
        cinematic: '16 / 9',
        portrait: '9 / 16',
      },
      height: {
        '1/2-screen': '50vh',
        '2/3-screen': '66vh',
        '1/3-screen': '33vh',
        '1/4-screen': '25vh',
        '1/5-screen': '20vh',
        '1/6-screen': '16.5vh',
        '1/25-screen': '40vh',
      },
      boxShadow: {
        focus: tokenShadows.focus,
        surface: tokenShadows.sm,
        elevated: tokenShadows.md,
        overlay: tokenShadows.lg,
      },
      ringColor: {
        focus: designColors.focusRing,
      },
      ringWidth: {
        focus: '3px',
      },
      transitionDuration: {
        immediate: tokenTransitions.duration.immediate,
        subtle: tokenTransitions.duration.subtle,
        slow: tokenTransitions.duration.slow,
        deliberate: tokenTransitions.duration.deliberate,
      },
      transitionTimingFunction: {
        DEFAULT: tokenTransitions.easing.standard,
        cinematic: tokenTransitions.easing.standard,
        entrance: tokenTransitions.easing.entrance,
        exit: tokenTransitions.easing.exit,
      },
      keyframes: {
        'fade-soft': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'cross-dissolve': {
          '0%': { opacity: '0', filter: 'blur(4px)' },
          '40%': { opacity: '1', filter: 'blur(0px)' },
          '100%': { opacity: '1', filter: 'blur(0px)' },
        },
      },
      animation: {
        'fade-soft': `fade-soft ${tokenTransitions.duration.slow} ${tokenTransitions.easing.standard} forwards`,
        'cross-dissolve': `cross-dissolve ${tokenTransitions.duration.deliberate} ${tokenTransitions.easing.entrance} forwards`,
      },
    },
  },

  plugins: [
    require('flowbite/plugin')
  ],

  darkMode: 'class',
};

module.exports = config;
