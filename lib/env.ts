const configuredAssetBase = (import.meta.env.VITE_ASSET_BASE_PATH as string | undefined)?.trim()

// Vizru serves production static files from /movies/dist/assets. Keep the
// local Vite paths unchanged while giving every deployed icon/image one base.
export const ASSET_PREFIX = (
  configuredAssetBase !== undefined
    ? configuredAssetBase
    : (import.meta.env.BASE_URL || "")
).replace(/\/$/, "")

export const assetPath = (path: string) =>
  `${ASSET_PREFIX}/assets/${path.replace(/^\/?assets\//, "").replace(/^\//, "")}`

export const ENV = {
  PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL as string | undefined,
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL as string | undefined,
  SOCKET_HANDSHAKE_TOKEN: import.meta.env.VITE_SOCKET_HANDSHAKE_TOKEN as string | undefined,
  TENANT_ID: import.meta.env.VITE_TENANT_ID as string | undefined,
}
