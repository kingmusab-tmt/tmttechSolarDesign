import type { Schedules } from "@/lib/calc/schedule";

/** Tagged cable schedule: route, type, size, length and protection for every cable. */
export function CableScheduleTable({ s }: { s: Schedules }) {
  return (
    <table className="table min-w-[980px] text-xs">
      <thead>
        <tr>
          <th className="w-16">Tag</th>
          <th>From</th>
          <th>To</th>
          <th>Cable type</th>
          <th>Size</th>
          <th className="text-right">Length</th>
          <th>Protection at origin</th>
        </tr>
      </thead>
      <tbody>
        {s.cables.map((c) => (
          <tr key={c.tag}>
            <td className="font-mono font-semibold">{c.tag}</td>
            <td>{c.from}</td>
            <td>{c.to}</td>
            <td>{c.type}</td>
            <td className="whitespace-nowrap">{c.size}</td>
            <td className="num text-right">{c.lengthM ? `${c.lengthM} m` : "site"}</td>
            <td>{c.protection}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Which modules make up each string and where each string connects. */
export function StringPlanTable({ s }: { s: Schedules }) {
  return (
    <table className="table min-w-[760px] text-xs">
      <thead>
        <tr>
          <th className="w-14">String</th>
          <th className="text-right">Modules</th>
          <th>Position on the array</th>
          <th>Connects to</th>
          <th>String fuse</th>
          <th>Cable</th>
        </tr>
      </thead>
      <tbody>
        {s.strings.map((r) => (
          <tr key={r.key}>
            <td className="font-semibold">{r.key}</td>
            <td className="num text-right">{r.modules}</td>
            <td>{r.positions}</td>
            <td>{r.input}</td>
            <td>{r.fuse}</td>
            <td className="font-mono">{r.homeRun}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
