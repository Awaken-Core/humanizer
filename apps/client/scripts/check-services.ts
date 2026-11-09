import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
let failed = false;
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`${name}: OK`); }
  catch { failed = true; console.error(`${name}: FAILED (check credentials, DNS and network access)`); }
}
async function main() {
await check("MongoDB ping", async () => {
  if (!process.env.MONGODB_URI) throw new Error();
  const mongo = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 1, serverSelectionTimeoutMS: 10000 });
  try { await mongo.connect(); await mongo.db().command({ ping: 1 }); }
  finally { await mongo.close(); }
});
await check("Upstash ping", async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error();
  const res = await fetch(`${url.replace(/\/$/, "")}/ping`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  const body = await res.json();
  if (!res.ok || body.result !== "PONG") throw new Error();
});
await check("DeepSeek model availability (no generation)", async () => {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error();
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` }, signal: AbortSignal.timeout(10000),
  });
  const body = await res.json();
  console.log(`DeepSeek models HTTP status: ${res.status}`);
  if (!res.ok) throw new Error();
  if (!body.data?.some((model: { id: string }) => model.id === (process.env.DEEPSEEK_MODEL || "deepseek-flash"))) {
    console.error("Configured DEEPSEEK_MODEL was not returned by the provider.");
    console.error("Available models:", body.data?.map((model: { id: string }) => model.id).join(", "));
    throw new Error();
  }
});
process.exitCode = failed ? 1 : 0;
}
void main();
