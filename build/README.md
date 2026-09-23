# Build Assets

`icon.svg` is the single source for every OpenWizardAI icon: a white wizard hat on a purple squircle.

After editing it, regenerate all formats:

```bash
node scripts/generate-icons.mjs
```

This writes:

- **icon.icns** (macOS, 16-1024 px, needs macOS `iconutil`), **icon.ico** (Windows, 16-256 px), **icon.png** (Linux, 1024 px)
- `docs/assets/` icons, the renderer favicon (`src/renderer/public/icon.png`) and welcome icon (`src/renderer/assets/icon-wand.png`)
- Full-bleed mobile web icons in `src/web/public/icons/`
- The 72 px icon embedded in HTML exports (`groupChatExport.ts`, `tabExport.ts`)

`entitlements.mac.plist` holds the macOS hardened-runtime entitlements used by electron-builder.
