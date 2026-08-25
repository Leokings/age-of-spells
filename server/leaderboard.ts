import {DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS} from "../src/contract-config";
import {projectStudionetLeaderboard} from "../src/leaderboard-projection";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        {error: "Method not allowed"},
        {status: 405, headers: {Allow: "GET, HEAD"}},
      );
    }

    try {
      const entries = await projectStudionetLeaderboard();
      const headers = {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      };
      if (request.method === "HEAD") {
        return new Response(null, {status: 200, headers});
      }
      const body = {
        entries,
        contract: DEFAULT_AGE_OF_SPELLS_PVP_CONTRACT_ADDRESS,
        source: "finalized-studionet-projection",
        generatedAt: new Date().toISOString(),
      };
      return Response.json(body, {headers});
    } catch (cause) {
      console.error("Leaderboard projection failed", cause);
      return Response.json(
        {error: "The finalized leaderboard is temporarily unavailable"},
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "60",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
  },
};
