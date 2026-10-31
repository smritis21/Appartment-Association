export const FLAT_STATUS = {
  OCCUPIED:    "occupied",
  VACANT:      "vacant",
  MAINTENANCE: "maintenance",
  RESERVED:    "reserved",
};

// 30 flats - mix of statuses, wings, floors
export const mockFlats = [
  { id: "FLAT-A101", wing: "A", flat: "101", floor: 1, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-001", tenantId: null,      householdId: "HH-001" },
  { id: "FLAT-A103", wing: "A", flat: "103", floor: 1, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-008", tenantId: "RES-009", householdId: "HH-002" },
  { id: "FLAT-A104", wing: "A", flat: "104", floor: 1, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-016", tenantId: "RES-017", householdId: "HH-003" },
  { id: "FLAT-A201", wing: "A", flat: "201", floor: 2, status: FLAT_STATUS.VACANT,      ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-A202", wing: "A", flat: "202", floor: 2, status: FLAT_STATUS.RESERVED,    ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-B204", wing: "B", flat: "204", floor: 2, status: FLAT_STATUS.OCCUPIED,    ownerId: null,      tenantId: "RES-002", householdId: "HH-004" },
  { id: "FLAT-B206", wing: "B", flat: "206", floor: 2, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-010", tenantId: "RES-011", householdId: "HH-005" },
  { id: "FLAT-B207", wing: "B", flat: "207", floor: 2, status: FLAT_STATUS.VACANT,      ownerId: "RES-018", tenantId: null,      householdId: null },
  { id: "FLAT-B301", wing: "B", flat: "301", floor: 3, status: FLAT_STATUS.MAINTENANCE, ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-C301", wing: "C", flat: "301", floor: 3, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-003", tenantId: null,      householdId: "HH-006" },
  { id: "FLAT-C308", wing: "C", flat: "308", floor: 3, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-010", tenantId: "RES-011", householdId: "HH-007" },
  { id: "FLAT-C309", wing: "C", flat: "309", floor: 3, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-018", tenantId: "RES-019", householdId: "HH-008" },
  { id: "FLAT-C401", wing: "C", flat: "401", floor: 4, status: FLAT_STATUS.VACANT,      ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-D402", wing: "D", flat: "402", floor: 4, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-004", tenantId: null,      householdId: "HH-009" },
  { id: "FLAT-D404", wing: "D", flat: "404", floor: 4, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-012", tenantId: "RES-013", householdId: "HH-010" },
  { id: "FLAT-D405", wing: "D", flat: "405", floor: 4, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-020", tenantId: null,      householdId: "HH-011" },
  { id: "FLAT-D501", wing: "D", flat: "501", floor: 5, status: FLAT_STATUS.RESERVED,    ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-E505", wing: "E", flat: "505", floor: 5, status: FLAT_STATUS.OCCUPIED,    ownerId: null,      tenantId: "RES-005", householdId: "HH-012" },
  { id: "FLAT-E507", wing: "E", flat: "507", floor: 5, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-012", tenantId: "RES-013", householdId: "HH-013" },
  { id: "FLAT-E601", wing: "E", flat: "601", floor: 6, status: FLAT_STATUS.VACANT,      ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-F601", wing: "F", flat: "601", floor: 6, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-006", tenantId: null,      householdId: "HH-014" },
  { id: "FLAT-F603", wing: "F", flat: "603", floor: 6, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-014", tenantId: "RES-015", householdId: "HH-015" },
  { id: "FLAT-F701", wing: "F", flat: "701", floor: 7, status: FLAT_STATUS.MAINTENANCE, ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-G702", wing: "G", flat: "702", floor: 7, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-006", tenantId: "RES-007", householdId: "HH-016" },
  { id: "FLAT-G705", wing: "G", flat: "705", floor: 7, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-014", tenantId: "RES-015", householdId: "HH-017" },
  { id: "FLAT-G801", wing: "G", flat: "801", floor: 8, status: FLAT_STATUS.VACANT,      ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-H803", wing: "H", flat: "803", floor: 8, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-008", tenantId: null,      householdId: "HH-018" },
  { id: "FLAT-H805", wing: "H", flat: "805", floor: 8, status: FLAT_STATUS.OCCUPIED,    ownerId: "RES-016", tenantId: null,      householdId: "HH-019" },
  { id: "FLAT-H901", wing: "H", flat: "901", floor: 9, status: FLAT_STATUS.RESERVED,    ownerId: null,      tenantId: null,      householdId: null },
  { id: "FLAT-H902", wing: "H", flat: "902", floor: 9, status: FLAT_STATUS.VACANT,      ownerId: null,      tenantId: null,      householdId: null },
];

export function getFlatById(id) {
  return mockFlats.find((f) => f.id === id) ?? null;
}

