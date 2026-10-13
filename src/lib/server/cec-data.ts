import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CecRow } from "../cec";

interface CecFile {
  source: string;
  builtAt: string;
  rows: CecRow[];
}

let cache: Promise<CecFile> | null = null;

/** Loaded once per server process (2.5 MB). Rebuild with `npm run data:cec`. */
export function loadCecModules() {
  cache ??= readFile(path.join(process.cwd(), "src", "data", "cec-modules.json"), "utf8").then((t) => JSON.parse(t) as CecFile);
  return cache;
}
