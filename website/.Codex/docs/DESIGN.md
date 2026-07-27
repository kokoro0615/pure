# DESIGN

## Overview

This project adopts a Vercel-first frontend architecture for highly polished UI/UX, advanced animation, responsive layout systems, and selective 3D/WebGL experiences.

## Architecture

- Deployment target: Vercel.
- Application foundation: Next.js 16 App Router, React 19, and TypeScript.
- Rendering model: server-render pages and content by default; isolate animation-heavy, interaction-heavy, and WebGL sections as client components.
- Design system: Tailwind CSS v4 with CSS-first `@theme`, CSS variables, and container queries.
- UI primitives: Radix UI as the accessible behavior layer, with shadcn/ui used selectively as owned component source.
- Animation layers: Motion for standard UI state, layout, gesture, and route motion; GSAP + ScrollTrigger for art-directed scroll timelines.
- 3D/WebGL: Three.js with `@react-three/fiber` and `@react-three/drei` for selected hero-grade scenes only.

## Implementation Plan

### Libraries

- Core: `next`, `react`, `react-dom`, `typescript`.
- Styling: `tailwindcss`, `@tailwindcss/postcss`.
- UI: Radix UI, selective shadcn/ui components, `lucide-react`.
- Motion: `motion`, `gsap`, `@gsap/react`, ScrollTrigger.
- 3D: `three`, `@react-three/fiber`, `@react-three/drei`.
- Observability and quality: Vercel Speed Insights, Vercel Web Analytics, Playwright, axe, Lighthouse CI.

### Key Decisions

- Use Next.js 16 App Router because it is the strongest fit for Vercel deployment, preview workflows, image/font/script optimization, and server/client component separation.
- Use Tailwind CSS v4 as the tokenized design layer because CSS variables and `@theme` allow design tokens to be shared with animation code.
- Use Radix UI underneath custom-styled components to preserve accessibility, keyboard behavior, focus management, and ARIA patterns.
- Use Motion as the default animation library because it covers UI-level layout animation, enter/exit states, gestures, and reduced-motion handling.
- Use GSAP only for complex scroll choreography, pinned sections, scrubbed timelines, and long-form visual storytelling.
- Use React Three Fiber selectively to avoid unnecessary WebGL cost on pages that do not need 3D impact.
- PURE home now treats the post-intro video block as the primary HOME HERO: one active vertical reel, a full-bleed ambient video layer, and three event selectors. The browser-facing source uses existing 720p derivatives instead of the 4K masters to preserve autoplay smoothness.

### Guardrails

- Respect `prefers-reduced-motion` for all animation systems.
- Prefer `transform` and `opacity` animation; avoid layout-affecting animation where possible.
- Lazy-load heavy GSAP timelines, WebGL scenes, and below-the-fold media.
- Use `next/image`, `next/font`, and `next/script` for performance-sensitive assets.
- Cap WebGL DPR and use adaptive quality for low-performance devices.
- Restyle shadcn/ui components heavily; do not treat default shadcn visuals as the brand.

## TODO

- Define concrete design tokens: color, typography, radius, spacing, easing, duration, z-index, and shadow scales.
- Choose the first target subproject for implementation.
- Add quality budgets for Core Web Vitals, bundle size, animation frame stability, accessibility, and Lighthouse CI.
- Decide whether the project needs a reusable shared UI package across client subprojects.

## Open Questions

- Which subproject should receive this stack first: `clients/jindogg/`, `clients/tsplus/`, a new app, or another target?
- What is the intended visual direction: luxury/refined, editorial, brutalist, immersive 3D, operational SaaS, or another direction?
- What content model or CMS, if any, is needed?

## Changelog

- 2026-05-17: Recorded adopted Vercel-first UI/UX animation technology stack and implementation guardrails.
- 2026-05-18: Recorded PURE post-intro video HERO decision using optimized vertical event reels.
