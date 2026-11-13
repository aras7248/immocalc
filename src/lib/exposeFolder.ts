export type FolderFile = { name: string; size: number; lastModified: number; webkitRelativePath?: string };
export const isFolderExpose = (file: FolderFile) => /\.(pdf|docx|txt|html?)$/i.test(file.name) && !file.name.startsWith('.');
export const folderFileKey = (file: FolderFile) => JSON.stringify([file.webkitRelativePath || file.name, file.size, file.lastModified]);
/** Stable order and per-file revisions avoid dropped files with equal timestamps. */
export function unseenFolderFiles<T extends FolderFile>(files: T[], seen: Set<string>): T[] {
  return files.filter(isFolderExpose).filter(file => !seen.has(folderFileKey(file)))
    .sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name));
}
