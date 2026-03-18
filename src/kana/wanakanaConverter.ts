import { toKatakana } from 'wanakana';
import type { KanaConverter } from './converter';

export const wanakanaConverter: KanaConverter = {
  toKatakana(input: string): string {
    return toKatakana(input, { IMEMode: true });
  },
};
