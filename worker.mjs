const [mode, configFile] = process.argv.slice(2);
const start = performance.now();
let importMs = 0;
let resolveMs = 0;

if (mode !== "empty") {
  const { resolveConfig } = await import("vite-plus");
  importMs = performance.now() - start;
  if (mode === "resolve") {
    const resolveStart = performance.now();
    const config = await resolveConfig({ configFile }, "build");
    resolveMs = performance.now() - resolveStart;
    if (!config.lint || !config.fmt) throw new Error("Fixture metadata was not resolved");
  }
}

console.log(JSON.stringify({ importMs, resolveMs }));
