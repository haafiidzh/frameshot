# original-clone: working rules

Scope of this file: any work whose target is `original-clone/` (features, fixes, tests, refactors, new editor capabilities).

## Isolation rule (human decision, 2026-11-10)
While developing `original-clone/`:
- NEVER read-for-edit, write, create, move or delete anything under `/home/coder/product-designer/.claude/`.
- NEVER read-for-edit, write, create, move or delete anything under `/home/coder/product-designer/improved-clone/`.
- NEVER invoke the `context-keeper`, `pm`, `developer`, `qa` or `ui-ux` agents, the `spawn-developers` or `confirm` skills, and never write handoffs, briefs, tasks, decisions or ADRs. The project context system does not track this folder.
- Do not "sync context" even if a Stop hook asks. If a Stop hook asks for `context-keeper` because of work done here, end the turn normally and tell the human; the human decides when to sync.
- Reading `.claude/docs/` or `PRD.md` for information is allowed; changing them is not.

## Where progress is recorded instead
- `replica/build-log.md`: one line per change (date, what, result).
- `replica/features.csv`: the `clone` column and notes.
- `replica/clone-screens/`: screenshots.
- `workflow-docs/README.md` (plus `workflow-docs/clone-screens/`): STANDING RULE from the human: update it after EVERY change to `original-clone/` (what changed and why, bugs found, test results, what is not covered, screenshots). Add a new numbered section in Indonesian, matching the style of the existing sections; never rewrite older sections.
These are outside `.claude/` and `improved-clone/`, so they are allowed.

## Other rules (inherited from the root CLAUDE.md)
- Clean room: no code, assets, copy or brand from the reference app; screenshots are reference only.
- Tokens only: no raw hex or pixel values in components (palette data in `lib/scene.ts` and device art are the exceptions).
- No git commands: no repo exists; the human initialises git.
- Features that do not exist in the reference (extras such as bento grid) are marked as extras in `replica/features.csv` (priority `extra`) and in `replica/build-log.md`; they do not count toward parity.
- Run `pnpm exec tsc --noEmit` and `pnpm lint` before reporting done; stop any dev server you started.
