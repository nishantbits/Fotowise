// watcherService.ts — chokidar logic moved to external watcher-agent.js (project root)
// Kept as empty export so existing imports compile without changes.

export const activeWatchers = new Map<string, unknown>();

export function startWatcher(_folderPath: string): void {
  // no-op: watching is handled by watcher-agent.js (external process)
}

export function stopWatcher(_folderPath: string): void {
  // no-op: watching is handled by watcher-agent.js (external process)
}
