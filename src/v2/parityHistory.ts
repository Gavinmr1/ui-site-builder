const STORAGE_KEY = 'site-builder.v2.parity-history.v1';
const MAX_SNAPSHOTS = 60;

export interface ParitySnapshot {
  id: string;
  recordedAt: string;
  projectId: string;
  projectName: string;
  qualityScore: number;
  customFallbackCount: number;
  missingRequiredFieldCount: number;
  validationIssues: number;
  roundTripNodeDelta: number;
  totalNodes: number;
  source: 'export' | 'preview';
}

export function loadParityHistory(): ParitySnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ParitySnapshot[]) : [];
  } catch {
    return [];
  }
}

export function recordParitySnapshot(
  snapshot: Omit<ParitySnapshot, 'id' | 'recordedAt'>
): ParitySnapshot {
  const entry: ParitySnapshot = {
    ...snapshot,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recordedAt: new Date().toISOString(),
  };

  try {
    const existing = loadParityHistory();
    const next = [entry, ...existing].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }

  return entry;
}

export function clearParityHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/** Returns last N scores (oldest-first) for sparkline rendering */
export function getScoreTrend(limit = 20): { recordedAt: string; score: number }[] {
  return loadParityHistory()
    .slice(0, limit)
    .reverse()
    .map((s) => ({ recordedAt: s.recordedAt, score: s.qualityScore }));
}
