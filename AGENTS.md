# wow-pad-planner

Read `README.md` first: it covers what the planner and the PadPlan addon do and how to build and test them.

- The page is plain HTML, CSS and JavaScript (`page/`), assembled into one file by `build.py`. Keep it dependency-free in the browser.
- `bun run check` must pass before a push: the starter check, the browser test (`tools/page-test.mjs`) and the addon test (`tools/addon-test.lua`, which reads the fixtures the browser test writes to `dist/`).
- The share code (`WPP1:`) is for the planner; the addon code (`PADPLAN1:`) is for `/padplan import`. Both are public formats: only add fields, never rename or remove them.
- Pushing a tag `vX.Y.Z` publishes `PadPlan.zip` as a GitHub release. Every push to main redeploys the page to GitHub Pages.
