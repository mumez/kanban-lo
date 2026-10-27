/**
 * Shared WebDAV error policy for both WebDAV layers (web/src/services/webdav.ts
 * and the kbl CLI's webdavClient.ts). Kept apart from issue-format.ts, which is
 * pure issue logic with no WebDAV dependency.
 */

/**
 * Swallow only "not found" — the expected case for optional files/dirs such
 * as _order.json, _projects.json or a column with no issues — and rethrow
 * anything else (connection refused, TLS, 5xx, bad JSON) so it isn't mistaken
 * for an empty result. Relies on the `webdav` package attaching the HTTP
 * status to the errors it throws.
 */
export function rethrowUnlessNotFound(err: unknown): void {
  if ((err as { status?: unknown } | null)?.status !== 404) throw err;
}
