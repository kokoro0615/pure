# Repository Guidelines

## Project Structure & Module Organization

This repository contains a single active Next.js project in `website/`. Application code lives under `website/src`: route files and global styles are in `src/app`, reusable UI and animation components are in `src/components`, shared helpers are in `src/lib`, and shared TypeScript types should go in `src/types`. Static browser assets belong in `website/public`; working reference media and inspection artifacts currently live in `website/image/` and top-level `website/*.png` files. Do not commit generated output such as `.next/` or `node_modules/`.

## Build, Test, and Development Commands

Run commands from `website/`.

```bash
npm install        # install dependencies from package-lock.json
npm run dev        # start the local Next.js dev server
npm run build      # create a production build
npm run start      # serve the production build
npm run lint       # run ESLint over the project
```

Use `npm`, not `pnpm` or `yarn`, because this project has a `package-lock.json`.

## Coding Style & Naming Conventions

Use TypeScript with `strict` mode enabled. Prefer functional React components, explicit prop types, and the `@/*` import alias for `src` paths. Component files use `PascalCase.tsx` such as `IntroSequence.tsx`; utility modules use `kebab-case.ts` or descriptive lowercase names such as `intro-timeline.ts`. Keep styling in Tailwind utilities and `src/app/globals.css`; avoid unrelated visual refactors when changing behavior. ESLint is configured through `eslint.config.mjs` with Next.js Core Web Vitals and TypeScript rules.

## Testing Guidelines

No test runner is configured yet. For now, run `npm run lint` and `npm run build` before handing off changes. When adding tests, place them near the feature or under a future `website/tests/` directory, name files `*.test.ts` or `*.test.tsx`, and cover animation timing, responsive rendering, and critical user-visible states.

## Commit & Pull Request Guidelines

Recent history uses short Conventional Commit style messages, for example `docs: record residual workspace research notes`, `chore: record workspace topology migration`, and `docs(backup): add Batch F2 human decision intake`. Follow `<type>(optional-scope): <imperative summary>` with `docs`, `chore`, `fix`, `feat`, or `refactor`.

Pull requests should include a concise summary, commands run, linked issue or task context, and screenshots or recordings for visual changes. Note any skipped checks or known responsive risks.

## Security & Configuration Tips

Keep secrets in local environment files and never commit them. Validate any future external input before rendering it, and avoid logging sensitive values from integrations or analytics.
