# Next.js 16 ESLint migration fix

Date: 2026-05-17

## Symptom

`npm run lint` failed with:

```text
next lint
Invalid project directory provided, no such directory: /home/kokoro/projects/pure/lint
```

## Root cause

Next.js 16 removed `next lint`. The project still had:

```json
"lint": "next lint"
```

With Next.js 16, `next lint` is no longer a valid lint command. The recommended path is to run ESLint directly with an `eslint.config.mjs` flat config.

## Secondary issue

The initial migration form using `FlatCompat` and `next/core-web-vitals` produced an ESLint 9 circular structure error in this package combination. The working Next.js 16 form imports flat configs directly:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
```

## Fix

- Changed `package.json` lint script to `eslint .`.
- Added `eslint.config.mjs` using Next.js 16 flat config imports.
- Removed the custom `src/types/gsap.d.ts` declaration because it erased GSAP package types.
- Replaced explicit `any` in `src/lib/intro-timeline.ts` with GSAP dynamic import types.
- Replaced remaining lint-warning `<img>` usage with `next/image`.

## Verification

- `npm run lint`: passed with no warnings.
- `npm run build`: passed.
- Browser reload at `http://localhost:51794/`: no console errors observed.
