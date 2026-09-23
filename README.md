# Vite+ config import benchmark

```sh
pnpm install --frozen-lockfile
pnpm bench
CACHE=off pnpm bench
```

Fresh Node processes; 2 warmup rounds, 15 samples, rotating case order. `CACHE=warm` uses an isolated compile cache. All children use the same Node. Raw samples and versions: `results-*.json`. Override with `SAMPLES=30`.

`worker.mjs` separates `import('vite-plus')` from the subsequent `resolveConfig()` call. Unmodified Oxlint/Oxfmt then process the same file with JSON, plain Vite, and `defineConfig` configs. JSON is a control using native tool mode; Vite cases enable `VP_VERSION`.

Example medians (ms): Apple M5 Pro, Node 26.4.0, Vite+ 1.0.0-rc.0, Oxfmt 0.70.0, Oxlint 1.85.0:

| Compile cache | Import / resolve, plain config | Oxfmt JSON → Vite | Oxlint JSON → Vite |
| ------------- | ------------------------------ | ----------------- | ------------------ |
| Warm          | 38.4 / 11.6                    | 31.8 → 79.9       | 33.9 → 86.7        |
| Off           | 49.4 / 10.6                    | 31.1 → 89.9       | 33.3 → 97.3        |

Here, import accounts for 77–82% of import + resolve time. Warm filesystem, trivial input, no user plugins; this isolates config overhead, not large-project lint cost or a PR speedup.
