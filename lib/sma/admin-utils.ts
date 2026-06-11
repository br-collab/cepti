/**
 * lib/sma/admin-utils.ts
 *
 * Admin utilities for the SMA dashboard.
 * MVP shim: UUID → name mapping is hardcoded here.
 * TODO: Replace in Phase 2 with a name column in sma_admins table.
 */

/**
 * Map an sma_admins user UUID to the decided_by name field.
 * Currently hardcoded MVP mapping.
 *
 * @param approverUuid The user_id from sma_admins
 * @returns 'bill' | 'francisco'
 */
export function getDecidedByName(approverUuid: string): 'bill' | 'francisco' {
  // Bill's UUID (the first SMA admin)
  if (approverUuid === '1a99a4ad-a4b3-4637-88d4-4637196d2cf1') {
    return 'bill'
  }
  // All other admins are Francisco for now
  return 'francisco'
}
