/**
 * Minimal runtime stand-in for the `obsidian` module, used by Vitest only.
 *
 * The real `obsidian` npm package ships types only (`"main": ""`), so any
 * runtime value imported from it (here, {@link normalizePath}) has no
 * implementation under Vitest. This stub is wired in via a `resolve.alias` in
 * `vitest.config.ts`. Production builds keep `obsidian` external (provided by
 * the Obsidian app at runtime), so this file never ships.
 */

/**
 * Faithful re-implementation of Obsidian's `normalizePath`: convert backslashes
 * to forward slashes, collapse repeated slashes, strip leading/trailing
 * slashes, and apply Unicode NFC normalization. Returns `'/'` for an otherwise
 * empty path, matching Obsidian's behavior.
 *
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
  let normalized = path.replace(/\\/g, '/');
  normalized = normalized.replace(/\/{2,}/g, '/');
  normalized = normalized.replace(/(^\/+)|(\/+$)/g, '');
  normalized = normalized.normalize('NFC');
  return normalized === '' ? '/' : normalized;
}
