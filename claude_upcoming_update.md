# Upcoming dependency updates

Status as of 2026-10-29. All dependencies have been updated to the latest
version within their existing semver ranges. The following **major** upgrades
are still pending, because each may need code changes and testing.

| Package                                  | Current  | Latest  | Notes |
| ---------------------------------------- | -------- | ------- | ----- |
| `react`, `react-dom`                     | 18.3.1   | 19.3.1  | Check `@r2wc/react-to-web-component`, `react-markdown`, `use-long-press`, `usehooks-ts` compatibility |
| `vite`                                   | 7.3.7    | 8.3.5   | Riskiest: `vite-plugin-top-level-await` may not support it |
| `@vitejs/plugin-react`                   | 5.2.0    | 6.1.2   | Upgrade together with Vite 8 |
| `vite-plugin-pwa` (dev)                  | 1.3.0    | 2.0.0   | Upgrade together with Vite 8 |
| `react-router-dom`                       | 6.30.6   | 7.18.5  | Router API changes |
| `pdfjs-dist`                             | 4.10.38  | 6.4.299 | `postinstall` copies `pdf.worker.mjs` into `public/` – verify path |
| `katex`                                  | 0.18.10  | 0.19.1  | 0.x minor bump, may contain breaking changes |
| `buffer` (dev)                           | 5.7.1    | 6.0.3   | Node polyfill |
| `babel-plugin-transform-import-meta` (dev) | 2.3.3  | 3.1.0   | |

## Pinned: `@swc/core`

`@swc/core` is pinned to `1.12.14` via `overrides` in `pnpm-workspace.yaml`.
`vite-plugin-top-level-await` breaks with newer `@swc/core` releases
(`[vite-plugin-top-level-await] missing field 'type'` during `vite build`).
Only lift the pin once the plugin supports newer versions (or is no longer
needed).

The override used to live in the `"pnpm"` field of `package.json`. It was
moved because newer pnpm versions (v11) only read settings from
`pnpm-workspace.yaml`.

## Deploying

On the server, install with the lockfile to get exactly the tested versions:

```sh
pnpm install --frozen-lockfile && pnpm run build
```
