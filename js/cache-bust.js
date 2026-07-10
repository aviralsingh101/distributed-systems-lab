/** Build/deploy version — bump on releases. Combined with session id for cache busting. */
export const BUILD_ID = "20260710";

/**
 * Session-scoped cache key: new browser tab/session fetches fresh modules.
 * Persists for the tab lifetime so in-app navigation does not re-fetch everything.
 */
export function getCacheBust() {
  if (typeof sessionStorage === "undefined") return BUILD_ID;
  let bust = sessionStorage.getItem("dsl_bust");
  if (!bust) {
    bust = `${BUILD_ID}-${Date.now()}`;
    sessionStorage.setItem("dsl_bust", bust);
  }
  return bust;
}

/** Append cache-bust query param to module/asset URLs. */
export function bustUrl(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(getCacheBust())}`;
}
