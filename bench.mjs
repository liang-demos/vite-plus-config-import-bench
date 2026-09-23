import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const vpPath = require.resolve("vite-plus/package.json");
const vpRequire = createRequire(vpPath);
const vp = JSON.parse(readFileSync(vpPath, "utf8"));
const samples = Number(process.env.SAMPLES ?? 15);
const warmup = Number(process.env.WARMUP ?? 2);
const cacheMode = process.env.CACHE ?? "warm";
if (!Number.isInteger(samples) || samples < 3 || !Number.isInteger(warmup) || warmup < 1) {
  throw new Error("Use SAMPLES >= 3 and WARMUP >= 1");
}
if (!["warm", "off"].includes(cacheMode)) throw new Error("Use CACHE=warm or CACHE=off");

const cacheDir = mkdtempSync(join(tmpdir(), "vp-import-bench-"));
const env = { ...process.env };
// Pin every child to this Node and isolate ambient runtime/config settings.
for (const key of Object.keys(env)) {
  if (
    key.startsWith("VP_") ||
    key === "NODE_OPTIONS" ||
    key === "NODE_COMPILE_CACHE" ||
    key === "NODE_DISABLE_COMPILE_CACHE"
  ) {
    delete env[key];
  }
}
if (cacheMode === "off") env.NODE_DISABLE_COMPILE_CACHE = "1";
else env.NODE_COMPILE_CACHE = cacheDir;

const plain = join(root, "fixtures/plain/vite.config.ts");
const defined = join(root, "fixtures/define-config/vite.config.ts");
const worker = join(root, "worker.mjs");
const cases = [
  { name: "Node only", args: [worker, "empty"], worker: true },
  { name: "import vite-plus", args: [worker, "import"], worker: true },
  { name: "resolve plain", args: [worker, "resolve", plain], worker: true },
  { name: "resolve defineConfig", args: [worker, "resolve", defined], worker: true },
];
const versions = { "vite-plus": vp.version };

for (const tool of ["oxfmt", "oxlint"]) {
  const packagePath = vpRequire.resolve(`${tool}/package.json`);
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  versions[tool] = pkg.version;
  const bin = join(dirname(packagePath), typeof pkg.bin === "string" ? pkg.bin : pkg.bin[tool]);
  for (const [config, path] of [
    ["JSON", join(root, `fixtures/json/${tool}.json`)],
    ["plain", plain],
    ["defineConfig", defined],
  ]) {
    cases.push({
      name: `${tool} ${config}`,
      args: [
        bin,
        ...(tool === "oxfmt" ? ["--check"] : []),
        "-c",
        path,
        join(root, "fixtures/input.ts"),
      ],
      env:
        config === "JSON"
          ? {}
          : { VP_VERSION: vp.version, VP_COMMAND: tool === "oxfmt" ? "fmt" : "lint" },
    });
  }
}

const results = cases.map(({ name }) => ({ name, samples: [] }));
try {
  // Rotate cases each round; never overlap processes or mutate tool implementations.
  for (let round = 0; round < warmup + samples; round++) {
    for (let offset = 0; offset < cases.length; offset++) {
      const index = (round + offset) % cases.length;
      const item = cases[index];
      const start = performance.now();
      const child = spawnSync(process.execPath, item.args, {
        cwd: root,
        env: { ...env, ...item.env },
        encoding: "utf8",
        timeout: 30_000,
      });
      const totalMs = performance.now() - start;
      if (child.error || child.status !== 0) {
        throw new Error(`${item.name}: ${child.error ?? child.stderr + child.stdout}`);
      }
      const phases = item.worker ? JSON.parse(child.stdout) : {};
      if (round >= warmup) results[index].samples.push({ totalMs, ...phases });
    }
    process.stderr.write(`\rRound ${round + 1}/${warmup + samples}`);
  }
  process.stderr.write("\n");

  for (const result of results) {
    result.median = {};
    for (const key of Object.keys(result.samples[0])) {
      const values = result.samples.map((sample) => sample[key]).sort((a, b) => a - b);
      const middle = Math.floor(values.length / 2);
      result.median[key] =
        values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    }
  }
  const metadata = {
    node: process.version,
    executable: process.execPath,
    platform: `${process.platform}/${process.arch}`,
    cpu: cpus()[0]?.model,
    versions,
    cacheMode,
    samples,
    warmup,
  };
  console.log(metadata);
  console.table(
    results.map(({ name, median }) => ({
      case: name,
      "total ms": median.totalMs.toFixed(1),
      "import ms": median.importMs?.toFixed(1) ?? "-",
      "resolve ms": median.resolveMs?.toFixed(1) ?? "-",
      "other ms":
        median.importMs === undefined
          ? "-"
          : (median.totalMs - median.importMs - median.resolveMs).toFixed(1),
    })),
  );
  const output = join(root, `results-${cacheMode}.json`);
  writeFileSync(output, `${JSON.stringify({ metadata, results }, null, 2)}\n`);
  console.log(`Raw samples: ${output}`);
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}
