import { getInferenceRuntimeInfo } from "@intentvault/providers";

/**
 * GET /api/health/inference
 * Reports whether private inference will use SolRouter or mock (no API calls, no secrets).
 */
export async function GET() {
  const body = getInferenceRuntimeInfo();
  return Response.json(body, {
    headers: { "cache-control": "no-store" }
  });
}
