import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ResumeSnapshot {
  id: string;
  resumeId: string;
  timestamp: string;
  label: string;
  data: Record<string, unknown>;
}

interface HistoryStore {
  /** resumeId → snapshots (newest first) */
  snapshots: Record<string, ResumeSnapshot[]>;

  addSnapshot: (resumeId: string, data: Record<string, unknown>, label: string) => void;
  restoreSnapshot: (snapshotId: string, resumeId: string) => Record<string, unknown> | null;
  deleteSnapshot: (snapshotId: string, resumeId: string) => void;
  getSnapshots: (resumeId: string) => ResumeSnapshot[];
  clearHistory: (resumeId: string) => void;
}

const MAX_SNAPSHOTS = 50;

/** Strip UI-only fields to reduce storage size */
function stripUIState(data: Record<string, unknown>): Record<string, unknown> {
  const { activeSection, draggingProjectId, ...rest } = data;
  return rest;
}

/** Check if two snapshots have meaningfully different content */
function hasChanged(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const stripA = stripUIState(a);
  const stripB = stripUIState(b);
  return JSON.stringify(stripA) !== JSON.stringify(stripB);
}

let counter = 0;
function generateSnapshotId(): string {
  counter += 1;
  return `snap_${Date.now()}_${counter}`;
}

export const useHistoryStore = create(
  persist<HistoryStore>(
    (set, get) => ({
      snapshots: {},

      addSnapshot: (resumeId, data, label) => {
        const existing = get().snapshots[resumeId] || [];

        // Skip if content is identical to the most recent snapshot
        if (existing.length > 0 && !hasChanged(data, existing[0].data)) {
          return;
        }

        const snapshot: ResumeSnapshot = {
          id: generateSnapshotId(),
          resumeId,
          timestamp: new Date().toISOString(),
          label,
          data: stripUIState(data),
        };

        const updated = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);

        set((state) => ({
          snapshots: {
            ...state.snapshots,
            [resumeId]: updated,
          },
        }));
      },

      restoreSnapshot: (snapshotId, resumeId) => {
        const snapshots = get().snapshots[resumeId] || [];
        const snapshot = snapshots.find((s) => s.id === snapshotId);
        return snapshot?.data ?? null;
      },

      deleteSnapshot: (snapshotId, resumeId) => {
        set((state) => ({
          snapshots: {
            ...state.snapshots,
            [resumeId]: (state.snapshots[resumeId] || []).filter(
              (s) => s.id !== snapshotId
            ),
          },
        }));
      },

      getSnapshots: (resumeId) => {
        return get().snapshots[resumeId] || [];
      },

      clearHistory: (resumeId) => {
        set((state) => ({
          snapshots: {
            ...state.snapshots,
            [resumeId]: [],
          },
        }));
      },
    }),
    {
      name: "resume-history-storage",
    }
  )
);

// --- Auto-snapshot manager ---
let autoSnapshotTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SNAPSHOT_DELAY = 30_000; // 30 seconds of inactivity

/**
 * Call this whenever the resume is updated. After 30 seconds of inactivity
 * following an update, an auto-snapshot will be created.
 */
export function scheduleAutoSnapshot(resumeId: string, data: Record<string, unknown>) {
  if (autoSnapshotTimer) {
    clearTimeout(autoSnapshotTimer);
  }
  autoSnapshotTimer = setTimeout(() => {
    useHistoryStore.getState().addSnapshot(resumeId, data, "auto");
    autoSnapshotTimer = null;
  }, AUTO_SNAPSHOT_DELAY);
}

/**
 * Create an immediate snapshot (for major actions like AI polish, template change).
 */
export function createImmediateSnapshot(
  resumeId: string,
  data: Record<string, unknown>,
  label: string
) {
  // Cancel any pending auto-snapshot since we're saving explicitly
  if (autoSnapshotTimer) {
    clearTimeout(autoSnapshotTimer);
    autoSnapshotTimer = null;
  }
  useHistoryStore.getState().addSnapshot(resumeId, data, label);
}
