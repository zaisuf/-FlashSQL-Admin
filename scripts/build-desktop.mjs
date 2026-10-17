import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = process.env.NEXT_DIST_DIR || ".next-build";
const standalone = path.join(root, distDir, "standalone");
const npx = "npx";

function run(label, args, env) {
  console.log(`\n[desktop] ${label}\n[desktop] $ ${npx} ${args.join(" ")}`);
  const result = spawnSync(npx, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status})`);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  return true;
}

console.log(`[desktop] Building Flash SQL Studio (distDir: ${distDir})`);

fs.rmSync(path.join(root, distDir), { recursive: true, force: true });
fs.rmSync(path.join(root, "release"), { recursive: true, force: true });

run("1/4 Next production build", ["next", "build"], { NEXT_DIST_DIR: distDir });

if (!fs.existsSync(standalone)) {
  throw new Error(`Standalone output not found at ${standalone}. Is output:"standalone" set in next.config.ts?`);
}

console.log("\n[desktop] 2/4 Copying static assets + public into standalone");
copyDir(path.join(root, distDir, "static"), path.join(standalone, distDir, "static"));
copyDir(path.join(root, "public"), path.join(standalone, "public"));

fs.rmSync(path.join(standalone, ".data"), { recursive: true, force: true });
fs.rmSync(path.join(standalone, ".next"), { recursive: true, force: true });
fs.rmSync(path.join(standalone, distDir, "cache"), { recursive: true, force: true });
fs.rmSync(path.join(standalone, distDir, "trace"), { force: true });

console.log("\n[desktop] 3/4 Verifying native modules load inside Electron");
try {
  const require_ = createRequire(import.meta.url);
  const electronBinary = require_("electron");
  const sqlitePath = path.join(standalone, "node_modules", "better-sqlite3");
  const probe = [
    `const D = require(${JSON.stringify(sqlitePath)});`,
    `const db = new D(${JSON.stringify(path.join(root, distDir, "probe.sqlite"))});`,
    `db.exec("create table t (n integer)");`,
    `db.prepare("insert into t (n) values (1)").run();`,
    `const row = db.prepare("select count(*) as c from t").get();`,
    `db.close();`,
    `console.log("[desktop] better-sqlite3 OK inside Electron -> rows=" + row.c);`,
  ].join("\n");
  const result = spawnSync(electronBinary, ["-e", probe], {
    cwd: standalone,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  fs.rmSync(path.join(root, distDir, "probe.sqlite"), { force: true });
  if (result.status !== 0) throw new Error(`probe exited ${result.status}`);
} catch (error) {
  console.warn("\n[desktop] WARNING: SQLite did not load inside Electron.");
  console.warn(`[desktop] ${error.message}`);
  console.warn("[desktop] SQLite connections may fail in the packaged app (Postgres/MySQL/SQL Server are unaffected).\n");
}

console.log("\n[desktop] 4/4 Packaging with electron-builder");
run("electron-builder", ["electron-builder", "--publish", "never"]);

console.log(`\n[desktop] Done. Installers are in ${path.join(root, "release")}`);
