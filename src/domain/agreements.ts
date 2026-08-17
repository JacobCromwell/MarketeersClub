export type AgreementStatus =
  | 'proposed'
  | 'changes_requested'
  | 'approved'
  | 'reported'
  | 'settled'
  | 'cancelled'

export interface SettlementSummary {
  grossCents: number
  commissionCents: number
  ownerPayoutCents: number
  unsoldQuantity: number
}

export function calculateSettlement(
  quantity: number,
  soldQuantity: number,
  unitPriceCents: number,
  commissionPerItemCents: number,
): SettlementSummary {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a positive whole number.')
  }

  if (!Number.isInteger(soldQuantity) || soldQuantity < 0 || soldQuantity > quantity) {
    throw new Error('Sold quantity must be a whole number within the agreed quantity.')
  }

  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('Unit price must be a non-negative whole number of cents.')
  }

  if (
    !Number.isInteger(commissionPerItemCents) ||
    commissionPerItemCents < 0 ||
    commissionPerItemCents > unitPriceCents
  ) {
    throw new Error('Commission must be between zero and the unit price.')
  }

  const grossCents = soldQuantity * unitPriceCents
  const commissionCents = soldQuantity * commissionPerItemCents

  return {
    grossCents,
    commissionCents,
    ownerPayoutCents: grossCents - commissionCents,
    unsoldQuantity: quantity - soldQuantity,
  }
}