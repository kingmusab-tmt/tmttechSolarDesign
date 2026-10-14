import { requireAdmin } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { User } from "@/models/User";
import { Visit, utcDay } from "@/models/Visit";

const DAY = 86_400_000;

/** Visitor and user activity for the admin overview: totals for today / 7 / 30 days and a daily series. */
export const GET = handler(async (req, _ctx, session) => {
  await requireAdmin(session);
  const days = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 30));
  const now = Date.now();
  const since = (n: number) => utcDay(new Date(now - (n - 1) * DAY)); // n days including today
  const start = since(days);

  const window = async (n: number) => {
    const day = { $gte: since(n) };
    const [visitors, users, views] = await Promise.all([
      Visit.distinct("visitor", { day }),
      Visit.distinct("user", { day, user: { $ne: null } }),
      Visit.aggregate<{ n: number }>([{ $match: { day } }, { $group: { _id: null, n: { $sum: "$views" } } }]),
    ]);
    return { visitors: visitors.length, users: users.length, views: views[0]?.n ?? 0 };
  };

  const [today, week, month, daily, signups, totalUsers, signups7, signups30] = await Promise.all([
    window(1),
    window(7),
    window(30),
    Visit.aggregate<{ _id: string; visitors: number; users: number; views: number }>([
      { $match: { day: { $gte: start } } },
      { $group: { _id: "$day", visitors: { $sum: 1 }, userIds: { $addToSet: "$user" }, views: { $sum: "$views" } } },
      { $project: { visitors: 1, views: 1, users: { $size: { $setDifference: ["$userIds", [null]] } } } },
    ]),
    User.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: new Date(`${start}T00:00:00Z`) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]),
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: new Date(`${since(7)}T00:00:00Z`) } }),
    User.countDocuments({ createdAt: { $gte: new Date(`${since(30)}T00:00:00Z`) } }),
  ]);

  const byDay = new Map(daily.map((d) => [d._id, d]));
  const signupsByDay = new Map(signups.map((s) => [s._id, s.n]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = utcDay(new Date(now - (days - 1 - i) * DAY));
    const d = byDay.get(day);
    return { day, visitors: d?.visitors ?? 0, users: d?.users ?? 0, views: d?.views ?? 0, signups: signupsByDay.get(day) ?? 0 };
  });

  return json({ today, week, month, totalUsers, signups: { week: signups7, month: signups30 }, series, days });
});
