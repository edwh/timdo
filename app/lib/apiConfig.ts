/**
 * Helper for retrieving the Cloudflare Worker base URL.
 * We prefer the public env var so the value is safe on both server and client.
 */
export function getWorkerApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_WORKER_API_BASE_URL ?? process.env.WORKER_API_BASE_URL;

  if (!url) {
    throw new Error(
      'Missing Worker API base URL. Set NEXT_PUBLIC_WORKER_API_BASE_URL in your environment.'
    );
  }

  return url.replace(/\/$/, '');
}
