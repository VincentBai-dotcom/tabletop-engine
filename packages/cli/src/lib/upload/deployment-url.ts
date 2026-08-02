/**
 * Builds the platform-web deployment dashboard URL that `tvk upload` hands off
 * to once a build has started. Contract:
 * `/studio/games/{gameId}/deployments/{buildId}?v={versionNumber}`, specified in
 * the platform repo's `docs/design/2026-08-01-web-deployment-status-dashboard.md`.
 * The `/studio` prefix is the owner-gated creator surface, kept distinct from
 * the public `/games/{gameId}` player page.
 *
 * The URL carries identifiers only — never the CLI's access token. The browser
 * authenticates through platform-web's own session cookie, so a token here
 * would only leak into history and `Referer` headers. `versionNumber` is
 * display-only ("Publishing v3"); the page omits it if absent.
 */
export function buildDeploymentUrl(input: {
  webBaseUrl: string;
  gameId: string;
  buildId: string;
  versionNumber: number;
}): string {
  const { webBaseUrl, gameId, buildId, versionNumber } = input;
  const gameSegment = encodeURIComponent(gameId);
  const buildSegment = encodeURIComponent(buildId);
  return `${webBaseUrl}/studio/games/${gameSegment}/deployments/${buildSegment}?v=${versionNumber}`;
}
