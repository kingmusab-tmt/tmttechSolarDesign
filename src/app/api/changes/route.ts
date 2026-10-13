import { handler, json } from "@/lib/server/api";
import { serializeChanges } from "@/lib/server/changes";
import { ChangeRequest, type ChangeRequestDoc } from "@/models/ChangeRequest";

/**
 * Change requests across all projects and shared equipment.
 * scope=inbox: waiting for my approval · scope=mine: proposed by me · scope=history: recently decided.
 */
export const GET = handler(async (req, _ctx, session) => {
  const scope = new URL(req.url).searchParams.get("scope") ?? "inbox";
  const filter: Record<string, unknown> =
    scope === "mine"
      ? { proposedBy: session.userId }
      : scope === "history"
        ? { $or: [{ approvers: session.userId }, { proposedBy: session.userId }], status: { $ne: "pending" } }
        : { approvers: session.userId, status: "pending", proposedBy: { $ne: session.userId } };
  const docs = await ChangeRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean<ChangeRequestDoc[]>();
  return json({ changes: await serializeChanges(docs, session.userId) });
});
