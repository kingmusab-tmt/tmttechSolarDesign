import { searchModules } from "@/lib/cec";
import { HttpError, handler, json } from "@/lib/server/api";
import { loadCecModules } from "@/lib/server/cec-data";

/** Search the bundled CEC module list (California Energy Commission, via NREL SAM). */
export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const minW = Number(sp.get("minW")) || undefined;
  const maxW = Number(sp.get("maxW")) || undefined;
  if (q.length < 2 && !minW && !maxW) throw new HttpError(400, "Type at least 2 characters or set a wattage range");
  const data = await loadCecModules();
  const result = searchModules(data.rows, q, { minW, maxW, limit: Number(sp.get("limit")) || 30 });
  return json({ ...result, source: data.source, builtAt: data.builtAt });
});
