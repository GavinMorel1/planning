import { describe, it, expect } from 'vitest'
import { rmdAmount, rmdDivisor, rmdStartAge } from './rmd'

describe('RMD start age (SECURE 2.0)', () => {
  it('72 for 1950 and earlier, 73 for 1951-1959, 75 for 1960 and later', () => {
    expect(rmdStartAge(1949)).toBe(72)
    expect(rmdStartAge(1950)).toBe(72)
    expect(rmdStartAge(1951)).toBe(73)
    expect(rmdStartAge(1959)).toBe(73)
    expect(rmdStartAge(1960)).toBe(75)
    expect(rmdStartAge(1985)).toBe(75)
  })
})

describe('RMD amount', () => {
  it('is zero before the start age', () => {
    expect(rmdAmount(74, 1966, 1_000_000)).toBe(0)
    expect(rmdAmount(72, 1952, 1_000_000)).toBe(0)
  })
  it('divides the prior year-end balance by the Uniform Lifetime divisor', () => {
    expect(rmdAmount(75, 1966, 1_000_000)).toBeCloseTo(1_000_000 / 24.6, 6) // 40,650.41
    expect(rmdAmount(73, 1952, 1_000_000)).toBeCloseTo(1_000_000 / 26.5, 6)
    expect(rmdAmount(72, 1950, 274_000)).toBeCloseTo(10_000, 6) // 274,000 / 27.4
    expect(rmdAmount(90, 1966, 500_000)).toBeCloseTo(500_000 / 12.2, 6)
  })
  it('uses the last divisor for ages past 120 and returns 0 for an empty account', () => {
    expect(rmdDivisor(121)).toBe(2)
    expect(rmdDivisor(120)).toBe(2)
    expect(rmdDivisor(70)).toBeNull()
    expect(rmdAmount(80, 1940, 0)).toBe(0)
  })
  it('the percentage withdrawn rises with age', () => {
    let prev = 0
    for (let age = 75; age <= 110; age++) { const x = rmdAmount(age, 1960, 1); expect(x).toBeGreaterThan(prev); prev = x }
  })
})
