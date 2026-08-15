const configuredBase = import.meta.env.BASE_URL || "/"

export const ASSET_PREFIX = configuredBase === "/" ? "" : configuredBase.replace(/\/$/, "")

export const ENV = {
  PUBLIC_API_URL: import.meta.env.VITE_PUBLIC_API_URL as string | undefined,
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL as string | undefined,
  SOCKET_HANDSHAKE_TOKEN: import.meta.env.VITE_SOCKET_HANDSHAKE_TOKEN as string | undefined,
  TENANT_ID: import.meta.env.VITE_TENANT_ID as string | undefined,
}
