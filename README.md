# Vite+ config import benchmark

```sh
pnpm install --frozen-lockfile
pnpm bench
CACHE=off pnpm bench
```

Fresh Node processes; 2 warmup rounds, 15 samples, rotating case order. `CACHE=warm` uses an isolated compile cache. All children use the same Node. Raw samples and versions: `results-*.json`. Override with `SAMPLES=30`.

`worker.mjs` separates `import('vite-plus')` from the subsequent `resolveConfig()` call. Unmodified Oxlint/Oxfmt then process the same file with JSON, plain Vite, and `defineConfig` configs. JSON is a control using native tool mode; Vite cases enable `VP_VERSION`.

Example medians (ms): Apple M5 Pro, Node 26.4.0, Vite+ 1.0.0-rc.0, Oxfmt 0.70.0, Oxlint 1.85.0:

| Compile cache | Import / resolve, plain config | Import share | Oxfmt JSON → Vite | Oxlint JSON → Vite |
| --- | --- | --- | --- | --- |
| Warm | 38.4 / 11.6 | **76.8%** | 31.8 → 79.9 (**+151.3%**) | 33.9 → 86.7 (**+155.8%**) |
| Off | 49.4 / 10.6 | **82.3%** | 31.1 → 89.9 (**+189.1%**) | 33.3 → 97.3 (**+192.2%**) |

Import share = `import / (import + resolve)`; tool increase = `(Vite − JSON) / JSON`, calculated from the displayed medians. Import dominates config loading even with a warm compile cache; tool increases include the entire config pipeline, not just import.

Warm filesystem, trivial input, no user plugins; this isolates config overhead, not large-project lint cost or a PR speedup.
