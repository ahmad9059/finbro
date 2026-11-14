import institutions from "./institutions.json";

type Institution = { keyword: string; host: string; label: string };

const MAP = institutions as Institution[];

/** Lowercase, punctuation-free, so "Bank AL Habib Ltd." matches "bank al habib". */
export function normalizeInstitution(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(limited|ltd|company|co|plc|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The website of the bank or asset manager behind a holding. Banks and AMCs
 * are matched by keyword, most specific first, so "Al Meezan …" is not
 * mistaken for "Meezan Bank".
 */
export function hostForInstitution(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = normalizeInstitution(name);
  if (!normalized) return null;
  const match = MAP.find((entry) => normalized.includes(entry.keyword));
  return match?.host ?? null;
}

export function institutionLabel(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = normalizeInstitution(name);
  const match = MAP.find((entry) => normalized.includes(entry.keyword));
  return match?.label ?? null;
}
