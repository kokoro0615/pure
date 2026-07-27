# Vercel UI/UX Animation Stack Research

Date: 2026-05-17

## Recommendation

Use a Vercel-first stack:

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4 as the design-token and layout system
- Radix UI primitives with selective shadcn/ui source components
- Motion for React for state, layout, gesture, and route-level UI motion
- GSAP ScrollTrigger for art-directed scroll narratives, pinned sections, and long choreography
- React Three Fiber + Three.js + Drei only for hero-grade 3D/WebGL moments
- Vercel Speed Insights, Web Analytics, Playwright, axe, Lighthouse CI, and bundle/performance budgets

## Rationale

Next.js is the most natural Vercel target because Vercel maintains Next.js and provides zero-configuration deployment, global performance, preview deployments, ISR, image optimization, and framework-aware infrastructure. The current local repository already contains Next.js 16, React 19, and Tailwind 4 client projects, so this stack also keeps project conventions aligned.

Tailwind CSS v4 is appropriate for high-end layout systems because it exposes design tokens as native CSS variables, supports CSS-first `@theme`, uses modern CSS features, improves build performance, supports container queries, and includes 3D transform utilities. This makes it a good base for a custom visual language without adding runtime styling cost.

Motion for React should be the default animation layer for product UI because it supports layout animation, scroll-triggered and scroll-linked animation, exit animation, gestures, reduced-motion handling, and Next.js App Router friendly client imports.

GSAP should be reserved for sequences Motion is not optimized for: pinned scroll sections, scrubbed timelines, long multi-element choreography, SVG/text sequencing, and highly controlled campaign-style storytelling. It adds power but also complexity, so it should not replace Motion for ordinary component states.

React Three Fiber should be used selectively. It is compatible with React 18 and 19 when the major version is matched, and it works with Next.js with attention to `transpilePackages`. For performance, use on-demand rendering, instancing, LOD, nested loading, compressed assets, and adaptive DPR.

Radix UI should be the accessibility base for dialogs, popovers, menus, tabs, sliders, and other complex controls. shadcn/ui is useful as owned source code, not as a visual identity. Components should be restyled heavily to avoid generic shadcn aesthetics.

## Suggested Package Groups

Core:

- `next`
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `@tailwindcss/postcss`

UI:

- `radix-ui` or individual `@radix-ui/react-*` packages
- `lucide-react`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `sonner`

Animation:

- `motion`
- `gsap`
- `@gsap/react`

3D:

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `@react-three/postprocessing`

Quality:

- `@vercel/analytics`
- `@vercel/speed-insights`
- `@playwright/test`
- `axe-core`
- `eslint`
- `prettier`

Asset pipeline:

- `gltf-transform`
- `gltfjsx`
- image optimization to AVIF/WebP
- KTX2/Basis texture compression for WebGL-heavy projects

## Architecture Guidelines

- Keep pages and data-heavy sections server-rendered by default.
- Isolate animated and interactive islands with `"use client"`.
- Lazy-load WebGL, heavy GSAP timelines, and non-critical media.
- Use `next/image`, `next/font`, and `next/script` for core performance primitives.
- Define motion tokens in CSS variables and reuse them in Tailwind and Motion.
- Respect `prefers-reduced-motion` and provide non-motion equivalents.
- Animate `transform` and `opacity`; avoid layout-affecting animation.
- Cap WebGL device pixel ratio and use adaptive quality on low-end devices.
- Avoid smooth-scroll hijacking unless the concept truly requires it.
- Track Core Web Vitals in Vercel Speed Insights from preview and production.

## Source Notes

- Vercel Next.js docs: Next.js on Vercel is zero-configuration and provides global scalability, availability, performance, preview deployments, ISR, and image optimization.
- Next.js docs: Next.js 16 App Router uses React canary releases with stable React 19 changes and Turbopack is the default bundler.
- Tailwind CSS v4 docs: CSS-first configuration, native CSS theme variables, modern CSS features, container queries, 3D transforms, and faster builds.
- Motion docs: layout animation, scroll-triggered and scroll-linked animation, exit animation, reduced motion, and `motion/react-client` for Next.js App Router.
- GSAP ScrollTrigger docs: advanced scroll-driven timelines, pinning, scrub, debounced scroll updates, and resize recalculation.
- React Three Fiber docs: React 18/19 compatibility by major version, Next.js configuration notes, on-demand rendering, instancing, LOD, and adaptive performance.
- Radix UI docs: accessible, unstyled primitives with ARIA, focus management, and keyboard navigation handled.

