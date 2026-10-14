// Starts the production build against a LOCAL test database for the end-to-end scripts,
// regardless of MONGODB_URI in .env.local (process env takes precedence over .env files).
// Usage: npm run db:memory (terminal 1) · npm run build && npm run start:test (terminal 2)
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  MONGODB_URI: "mongodb://127.0.0.1:27017/solar_design_test",
  ADMIN_EMAILS: "admin@e2e.test",
  E2E_TEST_SERVER: "1",
};
console.log(`Test server on http://localhost:3100 using ${env.MONGODB_URI}`);
const child = spawn("npx", ["next", "start", "-p", "3100"], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
