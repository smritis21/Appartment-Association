// All 256 flats across 8 wings (A–H), 32 flats each
export const WINGS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const FLATS_PER_WING = 32;
export const TOTAL_FLATS = 256;

export function generateFlatNumbers() {
  const flats = [];
  WINGS.forEach((wing) => {
    for (let i = 1; i <= FLATS_PER_WING; i++) {
      flats.push({ wing, flat: String(i).padStart(3, "0"), label: `${wing}-${String(i).padStart(3, "0")}` });
    }
  });
  return flats;
}
