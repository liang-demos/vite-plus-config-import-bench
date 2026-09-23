# Vite+ config import benchmark

```sh
pnpm install --frozen-lockfile
pnpm bench
```

Apple M5 Pro · Node 26.4.0 · Vite+ 1.0.0-rc.0 · 15 fresh-process samples after 2 warmup rounds. Cases rotate; all children use the same Node. Raw results: `results-warm.json`.

## One configuration-loading process

`worker.mjs`: start Node → import `vite-plus` → call `resolveConfig()` on a plain config → exit.

| Work | Time | Share of import + resolve |
| --- | ---: | ---: |
| Import `vite-plus` to obtain `resolveConfig` | **38.4 ms** | **76.8%** |
| Call `resolveConfig()` | **11.6 ms** | **23.2%** |
| **Configuration-loading subtotal** | **50.0 ms** | **100%** |
| Other: process startup/exit, worker setup, output and spawn overhead | 26.7 ms | Excluded |
| Full process total | 76.7 ms | — |

**Considering only import + resolve, reducing `resolveConfig()` to 0 ms saves at most 23.2%: 50.0 → 38.4 ms.** Import remains the larger cost at **76.8%**. These percentages exclude process lifecycle and other overhead; they are not whole-command speedups.

Other is the remainder of the medians, not a separately profiled phase, and is outside this comparison's optimization scope.

## Actual tools, same input file

Unmodified tools; JSON uses native tool mode, while Vite config enables `VP_VERSION`. The plain Vite config contains no imports or plugins.

| Tool          | JSON config | Plain Vite config | Extra time | Increase |
| ------------- | ----------: | ----------------: | ---------: | -------: |
| Oxfmt 0.70.0  |     31.8 ms |           79.9 ms |   +48.1 ms |  +151.3% |
| Oxlint 1.85.0 |     33.9 ms |           86.7 ms |   +52.8 ms |  +155.8% |

Tool phases are not instrumented; their extra time includes the whole config pipeline. The script also tests `defineConfig` imports.

Each sample starts a new process and imports modules again. Node's compilation cache is warmed: it can reuse compiled code, not already initialized modules. This measures small-file config overhead, not large-project lint cost or a PR speedup.
