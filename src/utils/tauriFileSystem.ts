import { ResumeData } from "@/types/resume";

// Detect if running in Tauri desktop app
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const RESUMES_DIR = "MagicResume";

async function getResumesDir(): Promise<string> {
  const { documentDir, join } = await import("@tauri-apps/api/path");
  const docDir = await documentDir();
  return await join(docDir, RESUMES_DIR);
}

async function ensureResumesDir(): Promise<string> {
  const { mkdir, exists } = await import("@tauri-apps/plugin-fs");
  const dir = await getResumesDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

function resumeFileName(resume: ResumeData): string {
  // Use id as filename to avoid issues with special characters in titles
  return `${resume.id}.json`;
}

/**
 * Save a resume to ~/Documents/MagicResume/{id}.json
 */
export async function saveResumeToFile(resume: ResumeData): Promise<void> {
  if (!isTauri) return;
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const { join } = await import("@tauri-apps/api/path");
    const dir = await ensureResumesDir();
    const filePath = await join(dir, resumeFileName(resume));
    await writeTextFile(filePath, JSON.stringify(resume, null, 2));
  } catch (error) {
    console.error("[Tauri FS] Failed to save resume:", error);
  }
}

/**
 * Delete a resume file from disk
 */
export async function deleteResumeFile(resume: ResumeData): Promise<void> {
  if (!isTauri) return;
  try {
    const { remove, exists } = await import("@tauri-apps/plugin-fs");
    const { join } = await import("@tauri-apps/api/path");
    const dir = await getResumesDir();
    const filePath = await join(dir, resumeFileName(resume));
    if (await exists(filePath)) {
      await remove(filePath);
    }
  } catch (error) {
    console.error("[Tauri FS] Failed to delete resume:", error);
  }
}

/**
 * Load all resumes from ~/Documents/MagicResume/
 */
export async function loadResumesFromDisk(): Promise<ResumeData[]> {
  if (!isTauri) return [];
  try {
    const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
    const { join } = await import("@tauri-apps/api/path");
    const dir = await ensureResumesDir();
    const entries = await readDir(dir);
    const resumes: ResumeData[] = [];

    for (const entry of entries) {
      if (entry.name?.endsWith(".json")) {
        try {
          const filePath = await join(dir, entry.name);
          const content = await readTextFile(filePath);
          const data = JSON.parse(content) as ResumeData;
          if (data.id && data.title) {
            resumes.push(data);
          }
        } catch {
          // Skip invalid files
        }
      }
    }
    return resumes;
  } catch (error) {
    console.error("[Tauri FS] Failed to load resumes:", error);
    return [];
  }
}

/**
 * Debounced save - batches frequent writes into a single file write after 1.5s
 */
let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function debouncedSaveToFile(resume: ResumeData): void {
  if (!isTauri) return;
  const id = resume.id;
  if (saveTimers[id]) clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => {
    saveResumeToFile(resume);
    delete saveTimers[id];
  }, 1500);
}
