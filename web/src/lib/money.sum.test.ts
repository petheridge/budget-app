import { describe, expect, it } from 'vitest'
import { evaluateAmount, isSum } from './money'

const pence = (input: string) => {
  const result = evaluateAmount(input)
  return result?.ok ? result.pence : result
}

describe('evaluateAmount', () => {
  it('reads plain amounts like parsePence', () => {
    expect(pence('12')).toBe(1200)
    expect(pence('12.5')).toBe(1250)
    expect(pence('£1,234.56')).toBe(123456)
    expect(pence('.5')).toBe(50)
    expect(pence('7.')).toBe(700)
    expect(pence('0')).toBe(0)
    expect(evaluateAmount('')).toBeNull()
    expect(evaluateAmount('  ')).toBeNull()
  })

  it('adds and subtracts amounts', () => {
    expect(pence('12400+250')).toBe(1265000)
    expect(pence('12400.00 + 250.50')).toBe(1265050)
    expect(pence('180000−450')).toBe(17955000)
    expect(pence('45+30-5.25')).toBe(6975)
  })

  it('multiplies and divides by plain numbers, before adding', () => {
    expect(pence('1200÷12')).toBe(10000)
    expect(pence('48×12')).toBe(57600)
    expect(pence('10+2*3')).toBe(1600)
    expect(pence('100/3')).toBe(3333)
    expect(pence('200/3')).toBe(6667)
    expect(pence('2.50x1.5')).toBe(375)
  })

  it('rounds each part to the nearest penny, halves up', () => {
    expect(pence('0.05/2')).toBe(3)
    expect(pence('0.01/2')).toBe(1)
    expect(pence('0.01/3')).toBe(0)
  })

  it('ignores a trailing operator', () => {
    expect(pence('12+')).toBe(1200)
    expect(pence('12×')).toBe(1200)
    expect(evaluateAmount('+')).toBeNull()
  })

  it('explains problems instead of guessing', () => {
    expect(evaluateAmount('12.345')).toEqual({ ok: false, error: 'Use up to 2 decimal places for amounts' })
    expect(evaluateAmount('5÷0')).toEqual({ ok: false, error: "Can't divide by zero" })
    expect(evaluateAmount('10-20')).toEqual({ ok: false, error: "Can't be less than £ 0.00" })
    expect(evaluateAmount('-5')).toEqual({ ok: false, error: "Can't be less than £ 0.00" })
    expect(evaluateAmount('1..2')?.ok).toBe(false)
    expect(evaluateAmount('12abc')?.ok).toBe(false)
    expect(evaluateAmount('12++3')?.ok).toBe(false)
  })

  it('allows more decimals in a multiplier than in an amount', () => {
    expect(pence('100×1.125')).toBe(11250)
  })
})

describe('isSum', () => {
  it('tells sums from single amounts', () => {
    expect(isSum('12400+250')).toBe(true)
    expect(isSum('1200 ÷ 12')).toBe(true)
    expect(isSum('12400')).toBe(false)
    expect(isSum('12+')).toBe(false)
    expect(isSum('1,234.56')).toBe(false)
  })
})
