import { describe, expect, it } from 'vitest'
import { calculateSettlement } from './agreements'

describe('calculateSettlement', () => {
  it('matches the Ann and Bob example', () => {
    expect(calculateSettlement(10, 5, 5_000, 500)).toEqual({
      grossCents: 25_000,
      commissionCents: 2_500,
      ownerPayoutCents: 22_500,
      unsoldQuantity: 5,
    })
  })

  it('rejects selling more than the agreed quantity', () => {
    expect(() => calculateSettlement(10, 11, 5_000, 500)).toThrow(
      'Sold quantity must be a whole number within the agreed quantity.',
    )
  })

  it('rejects commission above the sale price', () => {
    expect(() => calculateSettlement(2, 1, 500, 501)).toThrow(
      'Commission must be between zero and the unit price.',
    )
  })
})