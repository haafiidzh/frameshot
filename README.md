# original-clone

Client-side mockup editor (M0 + M1 of `replica/architecture.md`). Put an image in a device frame on a styled backdrop and download a PNG. No server, no accounts.

```bash
pnpm install
pnpm dev        # http://localhost:3100
pnpm build && pnpm start
pnpm typecheck && pnpm lint
```

Design tokens: `app/tokens.css` + `tailwind.config.ts` (from `replica/design/`). Scene model: `lib/scene.ts`. One renderer for preview, thumbnails and export: `lib/render.ts`. Devices are original procedural frames: `lib/devices.ts`.
Pin TypeScript 5.x and ESLint 9.x (Next 15 does not support TypeScript 7 or ESLint 10).
