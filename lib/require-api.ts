/** Shared API-mode guard for hooks (NEXT_PUBLIC_API_URL must be set). */
export const HAS_API = Boolean(process.env.NEXT_PUBLIC_API_URL);

export function requireApi(feature = 'This operation'): void {
  if (!HAS_API) {
    throw new Error(`${feature} requires API connection (set NEXT_PUBLIC_API_URL)`);
  }
}
