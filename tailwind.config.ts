import type { Config } from 'tailwindcss'
// Values come from tokens.css custom properties, so replica-brand only edits tokens.json.
const v = (n: string) => `var(--color-${n})`
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), 'surface-sunken': v('surface-sunken'),
        'surface-raised': v('surface-raised'), border: v('border'), 'border-input': v('border-input'),
        text: v('text'), muted: v('text-muted'), accent: v('accent'), 'on-accent': v('on-accent'),
        ring: v('focus-ring'), overlay: v('overlay'), danger: v('danger'), success: v('success'), warning: v('warning'),
      },
      fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
      fontSize: {
        xs: ['var(--text-xs)', 'var(--text-xs-line)'], sm: ['var(--text-sm)', 'var(--text-sm-line)'],
        base: ['var(--text-base)', 'var(--text-base-line)'], lg: ['var(--text-lg)', 'var(--text-lg-line)'],
        xl: ['var(--text-xl)', 'var(--text-xl-line)'], micro: ['var(--text-micro)', 'var(--text-micro-line)'], display: ['var(--text-display)', 'var(--text-display-line)'],
      },
      borderRadius: { xs: 'var(--radius-xs)', sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)', mockup: 'var(--shadow-mockup)' },
      transitionDuration: { fast: 'var(--motion-fast)', base: 'var(--motion-base)' },
      width: { panel: 'var(--layout-panel-width)' },
      spacing: { tile: 'var(--layout-tile-gap)', seg: 'var(--layout-segment-pad)', 'mini-w': 'var(--layout-mini-preview-w)', 'mini-h': 'var(--layout-mini-preview-h)', 'modal-top': 'var(--layout-modal-top)' },
      maxWidth: { toast: 'var(--layout-toast-max)' },
      height: { sheet: 'var(--layout-sheet-height)', header: 'var(--layout-header-height)' },
    },
  },
} satisfies Config
