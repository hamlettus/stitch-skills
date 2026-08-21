/**
 * Camelot wheel harmonic-mixing logic.
 * A key is a number 1..12 plus a letter: A = minor (inner ring), B = major (outer ring).
 * Compatible mixes from a key: the same key, +/- 1 (same letter), and the relative
 * major/minor (same number, other letter).
 */

export type Letter = 'A' | 'B';

export interface CamelotKey {
  readonly num: number;
  readonly letter: Letter;
}

export const KEY_NAMES: Record<Letter, readonly string[]> = {
  A: ['', 'A♭ min', 'E♭ min', 'B♭ min', 'F min', 'C min', 'G min', 'D min', 'A min', 'E min', 'B min', 'F♯ min', 'D♭ min'],
  B: ['', 'B maj', 'F♯ maj', 'D♭ maj', 'A♭ maj', 'E♭ maj', 'B♭ maj', 'F maj', 'C maj', 'G maj', 'D maj', 'A maj', 'E maj'],
};

export function parseKey(code: string): CamelotKey {
  return { num: parseInt(code, 10), letter: code.slice(-1) as Letter };
}

export function keyCode(num: number, letter: Letter): string {
  return `${num}${letter}`;
}

export function keyName(code: string): string {
  const { num, letter } = parseKey(code);
  return KEY_NAMES[letter][num];
}

/** Even spread of the 12 numbers around the color wheel, offset so it reads well. */
export function keyColor(code: string): string {
  const { num, letter } = parseKey(code);
  const hue = ((num - 1) * 30 + 150) % 360;
  const sat = letter === 'A' ? 62 : 70;
  const light = letter === 'A' ? 52 : 60;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function compatibleKeys(code: string): string[] {
  const { num, letter } = parseKey(code);
  const up = (num % 12) + 1;
  const down = num === 1 ? 12 : num - 1;
  const relative: Letter = letter === 'A' ? 'B' : 'A';
  return [code, keyCode(up, letter), keyCode(down, letter), keyCode(num, relative)];
}

export function isCompatible(from: string, to: string): boolean {
  return compatibleKeys(from).includes(to);
}

/** Human label describing how `to` relates to `from`. */
export function relationLabel(from: string, to: string): string {
  if (from === to) return 'perfect';
  const a = parseKey(from);
  const b = parseKey(to);
  if (a.num === b.num && a.letter !== b.letter) return 'energy shift';
  if (a.letter === b.letter) return b.num > a.num || (a.num === 12 && b.num === 1) ? '+1 key' : '-1 key';
  return 'blend';
}
