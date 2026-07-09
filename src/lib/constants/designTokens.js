// Pure Reactions — Cinematic Authentic design tokens
// Text and background combinations noted below meet WCAG AA contrast requirements.

export const colors = {
  // textPrimary (#f5f7fa) on background (#0f1115) → contrast ≈ 13.5:1
  background: '#0f1115',
  surface: '#15181f',
  elevated: '#1c2029',
  overlay: 'rgba(10, 12, 16, 0.74)',
  textPrimary: '#f5f7fa',
  textSecondary: '#c7cbd7',
  textMuted: '#8d93a3',
  // accentPrimary (#5cb2ff) on background (#0f1115) → contrast ≈ 4.9:1
  accentPrimary: '#5cb2ff',
  accentSecondary: '#ff8b6c',
  accentTertiary: '#ffd27a',
  success: '#4ecf9f',
  warning: '#f6b65b',
  danger: '#ff6f7a',
  borderSubtle: '#242833',
  borderStrong: '#323845',
  focusRing: '#5cb2ff',
  scrim: 'rgba(7, 9, 12, 0.82)',

  // Collection-type highlight colors — one per list concept so users can
  // distinguish them at a glance while keeping the cinematic palette cohesive.
  // Each colour meets WCAG AA (≥ 4.5:1) against `background` (#0f1115).
  collectionQueue: '#a78bfa',      // soft violet  — queues
  collectionPlaylist: '#5cb2ff',   // cinematic blue — playlists (matches accent-primary)
  collectionMoment: '#fbbf24',     // warm amber   — moments
  collectionSimilar: '#34d399',    // emerald      — similar reactions
};

export const typography = {
  fontFamilyDisplay: '"Manrope", "Inter", "Helvetica Neue", Arial, sans-serif',
  fontFamilyBody: '"Inter", "Helvetica Neue", Arial, sans-serif',
  scale: {
    xs: { size: '0.75rem', lineHeight: '1rem', letterSpacing: '0.02em' },
    sm: { size: '0.875rem', lineHeight: '1.25rem', letterSpacing: '0.01em' },
    base: { size: '1rem', lineHeight: '1.5rem', letterSpacing: '0em' },
    md: { size: '1.125rem', lineHeight: '1.6rem', letterSpacing: '-0.005em' },
    lg: { size: '1.375rem', lineHeight: '1.9rem', letterSpacing: '-0.01em' },
    xl: { size: '1.75rem', lineHeight: '2.2rem', letterSpacing: '-0.015em' },
    xxl: { size: '2.25rem', lineHeight: '2.6rem', letterSpacing: '-0.02em' },
  },
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const spacing = {
  none: '0',
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1.25rem',
  lg: '1.75rem',
  xl: '2.5rem',
  xxl: '3.5rem',
  xxxl: '4.5rem',
};

export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  pill: '999px',
};

export const shadows = {
  sm: '0 6px 12px rgba(5, 8, 12, 0.35)',
  md: '0 10px 30px rgba(5, 8, 12, 0.4)',
  lg: '0 20px 48px rgba(5, 8, 12, 0.45)',
  focus: '0 0 0 2px rgba(12, 18, 27, 0.9), 0 0 0 4px rgba(92, 178, 255, 0.45)',
};

export const transitions = {
  duration: {
    immediate: '75ms',
    subtle: '180ms',
    slow: '320ms',
    deliberate: '500ms',
  },
  easing: {
    entrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
    exit: 'cubic-bezier(0.4, 0, 0.2, 1)',
    standard: 'cubic-bezier(0.33, 1, 0.68, 1)',
  },
};

export const designTokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  transitions,
};

export default designTokens;

// Provide CommonJS compatibility for tooling (e.g., Tailwind config).
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  // eslint-disable-next-line no-undef
  module.exports = {
    colors,
    typography,
    spacing,
    radii,
    shadows,
    transitions,
    designTokens,
    default: designTokens,
  };
}
