/**
 * PHASE design tokens. Single committed dark "booth" palette.
 * Two signal colors carry meaning everywhere:
 *   key   (cyan)  -> musical key / harmonic matching
 *   energy(amber) -> energy rating / tempo
 *   violet        -> remix / collaboration
 */

export const colors = {
  bg: '#0A0B0F',
  bg2: '#0E1017',
  surface: '#161922',
  surface2: '#1D2130',
  line: '#262B3B',
  lineSoft: '#1E2230',

  text: '#EDEFF5',
  muted: '#868DA6',
  muted2: '#5C6178',

  key: '#35E8D0',
  keyDim: '#12463F',
  energy: '#FF7A45',
  energyDim: '#4A2617',
  violet: '#8B7BFF',

  onAccent: '#04120F',
  waveIdle: 'rgba(255,255,255,0.14)',
} as const;

export const fonts = {
  display: 'ChakraPetch_700Bold',
  displaySemi: 'ChakraPetch_600SemiBold',
  displayMed: 'ChakraPetch_500Medium',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
  body: 'Archivo_400Regular',
  bodyMed: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
  bodyBold: 'Archivo_700Bold',
} as const;

export const radius = {
  sm: 8,
  md: 13,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
} as const;

export const type = {
  h1: 30,
  h2: 22,
  h3: 17,
  body: 15,
  small: 13,
  micro: 11,
  eyebrow: 10.5,
} as const;
