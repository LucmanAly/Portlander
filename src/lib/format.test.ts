import { describe, expect, it } from 'vitest'
import { formatCompactMoney, formatEps, formatSignedPct } from '@/lib/format'

describe('formatSignedPct', () => {
  it('prefixes a + on positive values', () => {
    expect(formatSignedPct(4.2)).toBe('+4.2%')
  })

  it('keeps the - on negative values without doubling it', () => {
    expect(formatSignedPct(-1.8)).toBe('-1.8%')
  })

  it('does not prefix a + on exactly 0.0%', () => {
    expect(formatSignedPct(0)).toBe('0.0%')
  })

  it('returns an em dash for undefined', () => {
    expect(formatSignedPct(undefined)).toBe('—')
  })
})

describe('formatCompactMoney', () => {
  it('formats large numbers compactly', () => {
    expect(formatCompactMoney(96_200_000_000)).toBe('$96.2B')
  })

  it('formats negative numbers compactly', () => {
    expect(formatCompactMoney(-700_000_000)).toBe('-$700M')
  })

  it('returns an em dash for undefined', () => {
    expect(formatCompactMoney(undefined)).toBe('—')
  })
})

describe('formatEps', () => {
  it('always shows 2 decimals', () => {
    expect(formatEps(1.5)).toBe('$1.50')
  })

  it('puts the sign before the dollar sign for negative values', () => {
    expect(formatEps(-0.42)).toBe('-$0.42')
  })

  it('returns an em dash for undefined', () => {
    expect(formatEps(undefined)).toBe('—')
  })
})
