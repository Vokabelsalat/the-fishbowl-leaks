import { getContributionCount } from "@/lib/contributions/database";
import { isOpenSea } from "@/lib/collective/tankCompartments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The state of the shared tank that visitors' phones need: whether it has become the open sea yet. */
export async function GET() {
  const creatureCount = getContributionCount();
  return Response.json(
    { creatureCount, openSea: isOpenSea(creatureCount) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
