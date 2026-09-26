// E2E helper (dev database only - never production): force a known answer "ABCDE" for a captcha id
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const BACKEND = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../backend",
);
process.chdir(BACKEND);
process.env.NODE_ENV = "development";
const crypto = await import("node:crypto");
const { default: env } = await import(
  pathToFileURL(path.join(BACKEND, "src/config/env.js")).href
);
const pg = (
  await import(
    pathToFileURL(path.join(BACKEND, "node_modules/pg/lib/index.js")).href
  )
).default;
const src = (await import("node:fs")).readFileSync(
  "src/services/captcha.service.js",
  "utf8",
);
const body = src.match(/const hashAnswer = \(answer\) =>\s*([\s\S]*?);\n/)[1];
const hashAnswer = new Function(
  "crypto",
  "env",
  "answer",
  `return ${body}`,
).bind(null, crypto.default, env);
const c = new pg.Client({
  connectionString: env.databaseUrl || process.env.DATABASE_URL,
});
await c.connect();
const r = await c.query("UPDATE captchas SET answer_hash = $1 WHERE id = $2", [
  hashAnswer("ABCDE"),
  process.argv[2],
]);
console.log("updated", r.rowCount);
await c.end();
