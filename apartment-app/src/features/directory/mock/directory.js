// directory.js - builds directory rows from flat + resident data
// The actual resident data comes from ResidentContext at runtime.
// This file provides static helpers and the flat registry.

export { mockFlats, FLAT_STATUS, getFlatById } from "./flats";
export { mockHouseholds, getHouseholdById } from "./households";

export const DIRECTORY_WINGS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Build a directory row for a flat given live residents array.
 * Returns { flat, owner, tenant, residents, status }
 */
export function buildDirectoryRow(flatEntry, residents) {
  // Always resolve by wing+flat from live residents so newly approved residents appear immediately.
  // Static ownerId/tenantId in mockFlats are only used as a last resort if no wing+flat match exists.
  const byFlat = residents.filter(
    (r) => r.wing === flatEntry.wing && r.flat === flatEntry.flat
  );

  let owner  = byFlat.find((r) => r.role === "owner")  ?? null;
  let tenant = byFlat.find((r) => r.role === "tenant") ?? null;

  // Fall back to ID-based lookup only if no wing+flat match found
  if (!owner && flatEntry.ownerId) {
    owner = residents.find((r) => r.id === flatEntry.ownerId) ?? null;
  }
  if (!tenant && flatEntry.tenantId) {
    tenant = residents.find((r) => r.id === flatEntry.tenantId) ?? null;
  }

  return { flat: flatEntry, owner, tenant, residentCount: (owner ? 1 : 0) + (tenant ? 1 : 0) };
}

/**
 * Build synthetic flat entries for residents whose wing+flat doesn't exist in mockFlats at all.
 */
export function buildDynamicRows(mockFlatsList, residents) {
  const coveredFlats = new Set(mockFlatsList.map((f) => `${f.wing}-${f.flat}`));

  const grouped = {};
  for (const r of residents) {
    if (!r.wing || !r.flat) continue;
    const key = `${r.wing}-${r.flat}`;
    if (coveredFlats.has(key)) continue; // already handled by a static flat row
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return Object.entries(grouped).map(([key, members]) => {
    const owner  = members.find((r) => r.role === "owner")  ?? null;
    const tenant = members.find((r) => r.role === "tenant") ?? null;
    const rep    = owner ?? tenant;
    const syntheticFlat = {
      id:          `DYN-${key}`,
      wing:        rep.wing,
      flat:        rep.flat,
      floor:       Math.ceil(parseInt(rep.flat, 10) / 100) || 1,
      status:      FLAT_STATUS.OCCUPIED,
      ownerId:     owner?.id  ?? null,
      tenantId:    tenant?.id ?? null,
      householdId: null,
      dynamic:     true,
    };
    return { flat: syntheticFlat, owner, tenant, residentCount: members.length };
  });
}

