import type { ProjectFile } from '../types';
import { validateProjectFile } from './projectValidation';

const STORAGE_KEY = 'site-builder.current-project.v1';

export function saveProjectToLocalStorage(project: ProjectFile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function loadProjectFromLocalStorage(): ProjectFile | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return validateProjectFile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSavedProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function downloadProjectJson(project: ProjectFile): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '-').toLowerCase() || 'project'}.sitebuilder.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readProjectJsonFile(file: File): Promise<ProjectFile> {
  const text = await file.text();
  return validateProjectFile(JSON.parse(text));
}
