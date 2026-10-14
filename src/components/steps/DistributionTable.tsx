import type { DistributionResult } from "@/lib/calc/distribution";
import { fmt } from "@/lib/format";

/** Essential-loads board schedule: one row per final circuit. */
export function DistributionTable({ d }: { d: DistributionResult }) {
  return (
    <table className="table min-w-[860px]">
      <thead>
        <tr>
          <th className="w-12">Ref</th>
          <th>Circuit</th>
          <th className="text-right">Connected</th>
          <th className="text-right">Ib</th>
          <th>Protection</th>
          <th className="text-right">Cable</th>
          <th className="text-right">Drop</th>
        </tr>
      </thead>
      <tbody>
        {d.circuits.map((c) => (
          <tr key={c.ref}>
            <td className="font-semibold">{c.ref}</td>
            <td>
              <div className="font-medium">{c.name}</div>
              <div className="text-[11px] text-muted">{c.loads.join(", ")}</div>
            </td>
            <td className="num text-right">{fmt(c.connectedW)} W</td>
            <td className="num text-right">{fmt(c.designA, 1)} A</td>
            <td className="text-xs">{c.protection}</td>
            <td className="num text-right">{c.cableMm2} mm²</td>
            <td className="num text-right">{fmt(c.dropPct, 2)} %</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
