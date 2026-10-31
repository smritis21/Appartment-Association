// Households group a flat + its residents (owner, tenant, family)
export const mockHouseholds = [
  {
    id: "HH-001", flatId: "FLAT-A101", wing: "A", flat: "101",
    ownerId: "RES-001", tenantId: null,
    familyMemberIds: ["FM-001", "FM-002"],
    memberCount: 3,
  },
  {
    id: "HH-002", flatId: "FLAT-A103", wing: "A", flat: "103",
    ownerId: "RES-008", tenantId: "RES-009",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-003", flatId: "FLAT-A104", wing: "A", flat: "104",
    ownerId: "RES-016", tenantId: "RES-017",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-004", flatId: "FLAT-B204", wing: "B", flat: "204",
    ownerId: null, tenantId: "RES-002",
    familyMemberIds: [],
    memberCount: 1,
  },
  {
    id: "HH-005", flatId: "FLAT-B206", wing: "B", flat: "206",
    ownerId: "RES-010", tenantId: "RES-011",
    familyMemberIds: ["FM-010"],
    memberCount: 3,
  },
  {
    id: "HH-006", flatId: "FLAT-C301", wing: "C", flat: "301",
    ownerId: "RES-003", tenantId: null,
    familyMemberIds: ["FM-003", "FM-004"],
    memberCount: 3,
  },
  {
    id: "HH-007", flatId: "FLAT-C308", wing: "C", flat: "308",
    ownerId: "RES-010", tenantId: "RES-011",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-008", flatId: "FLAT-C309", wing: "C", flat: "309",
    ownerId: "RES-018", tenantId: "RES-019",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-009", flatId: "FLAT-D402", wing: "D", flat: "402",
    ownerId: "RES-004", tenantId: null,
    familyMemberIds: ["FM-005", "FM-006"],
    memberCount: 3,
  },
  {
    id: "HH-010", flatId: "FLAT-D404", wing: "D", flat: "404",
    ownerId: "RES-012", tenantId: "RES-013",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-011", flatId: "FLAT-D405", wing: "D", flat: "405",
    ownerId: "RES-020", tenantId: null,
    familyMemberIds: [],
    memberCount: 1,
  },
  {
    id: "HH-012", flatId: "FLAT-E505", wing: "E", flat: "505",
    ownerId: null, tenantId: "RES-005",
    familyMemberIds: [],
    memberCount: 1,
  },
  {
    id: "HH-013", flatId: "FLAT-E507", wing: "E", flat: "507",
    ownerId: "RES-012", tenantId: "RES-013",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-014", flatId: "FLAT-F601", wing: "F", flat: "601",
    ownerId: "RES-006", tenantId: null,
    familyMemberIds: ["FM-007", "FM-008", "FM-009"],
    memberCount: 4,
  },
  {
    id: "HH-015", flatId: "FLAT-F603", wing: "F", flat: "603",
    ownerId: "RES-014", tenantId: "RES-015",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-016", flatId: "FLAT-G702", wing: "G", flat: "702",
    ownerId: "RES-006", tenantId: "RES-007",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-017", flatId: "FLAT-G705", wing: "G", flat: "705",
    ownerId: "RES-014", tenantId: "RES-015",
    familyMemberIds: [],
    memberCount: 2,
  },
  {
    id: "HH-018", flatId: "FLAT-H803", wing: "H", flat: "803",
    ownerId: "RES-008", tenantId: null,
    familyMemberIds: [],
    memberCount: 1,
  },
  {
    id: "HH-019", flatId: "FLAT-H805", wing: "H", flat: "805",
    ownerId: "RES-016", tenantId: null,
    familyMemberIds: [],
    memberCount: 1,
  },
  {
    id: "HH-020", flatId: "FLAT-B207", wing: "B", flat: "207",
    ownerId: "RES-018", tenantId: null,
    familyMemberIds: [],
    memberCount: 1,
  },
];

export function getHouseholdById(id) {
  return mockHouseholds.find((h) => h.id === id) ?? null;
}
