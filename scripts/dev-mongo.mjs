// Starts an in-memory MongoDB for local testing without installing MongoDB.
// Usage: node scripts/dev-mongo.mjs   → prints the URI; keep it running.
import { MongoMemoryServer } from "mongodb-memory-server";

const server = await MongoMemoryServer.create({ instance: { port: 27017, dbName: "solar_design" } });
console.log(`In-memory MongoDB running at ${server.getUri()}solar_design`);
const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
