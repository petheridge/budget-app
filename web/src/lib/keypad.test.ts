import { describe, expect, it } from 'vitest'
import { pressKey, type PadKey, type PadState } from './keypad'

const type = (start: PadState, keys: PadKey[]) => keys.reduce(pressKey, start).text
const blank = { text: '', fresh: false }

describe('pressKey', () => {
  it('types amounts', () => {
    expect(type(blank, ['1', '2', '.', '5', '0'])).toBe('12.50')
    expect(type(blank, ['.', '5'])).toBe('0.5')
    expect(type(blank, ['0', '7'])).toBe('7')
  })

  it('allows one decimal point per number', () => {
    expect(type(blank, ['1', '.', '2', '.', '3'])).toBe('1.23')
    expect(type(blank, ['1', '.', '5', '+', '2', '.', '5'])).toBe('1.5+2.5')
  })

  it('replaces a saved value when a digit is typed first', () => {
    expect(type({ text: '12400.00', fresh: true }, ['9', '9'])).toBe('99')
  })

  it('carries on from a saved value when an operator is typed first', () => {
    expect(type({ text: '12400.00', fresh: true }, ['+', '2', '5', '0'])).toBe('12400.00+250')
    expect(type({ text: '180000.00', fresh: true }, ['−', '4', '5', '0'])).toBe('180000.00−450')
  })

  it('swaps a repeated operator and ignores one with nothing before it', () => {
    expect(type(blank, ['1', '2', '+', '×', '3'])).toBe('12×3')
    expect(type(blank, ['+', '5'])).toBe('5')
  })

  it('deletes one character at a time', () => {
    expect(type(blank, ['1', '2', '+', 'back', 'back'])).toBe('1')
    expect(type({ text: '12.00', fresh: true }, ['back'])).toBe('12.0')
    expect(type(blank, ['back'])).toBe('')
  })
})
