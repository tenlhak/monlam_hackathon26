/**
 * Tibetan numerals — shared by Level 1 §5 (reading them) and Level 2 §4
 * (hearing and saying them), so the digit set is defined once.
 */

export interface Numeral {
  /** Arabic value */
  value: number
  /** Tibetan digit glyph, e.g. ༧ */
  digits: string
  /** Spelled-out Tibetan word */
  word: string
  roman: string
}

export const DIGITS: Numeral[] = [
  { value: 0, digits: '༠', word: 'ཀླད་ཀོར', roman: 'le kor' },
  { value: 1, digits: '༡', word: 'གཅིག', roman: 'chik' },
  { value: 2, digits: '༢', word: 'གཉིས', roman: 'nyi' },
  { value: 3, digits: '༣', word: 'གསུམ', roman: 'sum' },
  { value: 4, digits: '༤', word: 'བཞི', roman: 'shi' },
  { value: 5, digits: '༥', word: 'ལྔ', roman: 'nga' },
  { value: 6, digits: '༦', word: 'དྲུག', roman: 'druk' },
  { value: 7, digits: '༧', word: 'བདུན', roman: 'dün' },
  { value: 8, digits: '༨', word: 'བརྒྱད', roman: 'gyä' },
  { value: 9, digits: '༩', word: 'དགུ', roman: 'gu' },
]

export const TENS: Numeral[] = [
  { value: 10, digits: '༡༠', word: 'བཅུ', roman: 'chu' },
  { value: 20, digits: '༢༠', word: 'ཉི་ཤུ', roman: 'nyi shu' },
  { value: 30, digits: '༣༠', word: 'སུམ་ཅུ', roman: 'sum chu' },
  { value: 40, digits: '༤༠', word: 'བཞི་བཅུ', roman: 'shi chu' },
  { value: 50, digits: '༥༠', word: 'ལྔ་བཅུ', roman: 'nga chu' },
  { value: 60, digits: '༦༠', word: 'དྲུག་ཅུ', roman: 'druk chu' },
  { value: 70, digits: '༧༠', word: 'བདུན་ཅུ', roman: 'dün chu' },
  { value: 80, digits: '༨༠', word: 'བརྒྱད་ཅུ', roman: 'gyä chu' },
  { value: 90, digits: '༩༠', word: 'དགུ་བཅུ', roman: 'gu chu' },
  { value: 100, digits: '༡༠༠', word: 'བརྒྱ', roman: 'gya' },
]

/** Digits and tens together — the pool the Level 2 speech drills draw from. */
export const NUMERALS: Numeral[] = [...DIGITS, ...TENS]

const TIBETAN_ZERO = 0x0f20

/** 27 → ༢༧ */
export function toTibetanDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => String.fromCodePoint(TIBETAN_ZERO + Number(d)))
    .join('')
}

/** ༢༧ → 27. Returns NaN if the string holds anything but Tibetan digits. */
export function fromTibetanDigits(text: string): number {
  let out = ''
  for (const char of text) {
    const offset = char.codePointAt(0)! - TIBETAN_ZERO
    if (offset < 0 || offset > 9) return NaN
    out += String(offset)
  }
  return out ? Number(out) : NaN
}

/**
 * Multi-digit numbers for the Level 1 reading drill. Composed from the digits
 * above rather than authored, so there is no new Tibetan to verify — reading
 * ༢༤༧ is a place-value exercise, not a vocabulary one.
 */
export const READING_NUMBERS = [
  12, 27, 40, 58, 90, 106, 249, 375, 480, 592, 703, 861,
]
