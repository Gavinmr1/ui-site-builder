# UI Site Builder

UI Site Builder is a visual, drag-and-drop website builder for creating modern pages without hand-coding every section. It is designed for fast iteration: compose layouts, style components, preview behavior, and export production-ready output.

## What It Does

- Build pages visually with a component palette and canvas
- Rearrange content with drag-and-drop interactions
- Edit properties and styles from dedicated side panels
- Apply responsive styles across desktop, tablet, and mobile breakpoints
- Use multi-select and bulk actions for faster editing
- Save/load projects and import/export project files
- Export to React (ZIP) or standalone HTML output

## Core Product Areas

### Visual Editor

- Canvas-based editing with nested component trees
- Sidebar component library with categories, favorites, templates, and assets
- Properties panel for content, layout, spacing, and visual styling
- Keyboard shortcuts, undo/redo, and contextual editing helpers

### Design System Support

- Theme tokens and reusable style primitives
- Theme family support including light/dark-ready workflows
- Design token tooling for consistent spacing, color, and typography decisions

### Export Pipeline

- Code export helpers under `src/builder/export`
- V2 export and mapper pipeline under `src/v2`
- React + Tailwind export support via V2 exporters

### Reliability and Safety

- Error boundaries around critical builder surfaces
- Project validation utilities for storage and import flows
- Analytics hooks for product and reliability monitoring

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS
- Zustand for editor state
- dnd-kit for drag-and-drop
- Framer Motion for interaction polish
- JSZip for export packaging

## Project Structure

- `src/builder`: main editor runtime (canvas, panels, store, renderer, export, themes)
- `src/v2`: schema-first model, mappers, validation, and exporters
- `src/styles`: global shared styling (including custom scrollbar styles)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Developer Scripts

- `npm run dev` - start the Vite dev server
- `npm run build` - run TypeScript build and Vite production bundle
- `npm run lint` - run ESLint
- `npm run preview` - preview the built app locally

## Analytics and Telemetry

The app tracks key editor lifecycle events such as bootstrap, node operations, preview opens, exports, and runtime errors.

Optional environment variables:

- `VITE_ANALYTICS_ENDPOINT`: POST destination for analytics event payloads
- `VITE_ANALYTICS_DEBUG`: set to `true` to print analytics events in the browser console

When available, the app can also forward events to in-page analytics providers:

- `window.plausible`
- `window.posthog.capture`

## Deployment

Deployment guidance and launch checklist are documented in `DEPLOYMENT.md`.

Supported deployment targets include:

- Vercel
- Netlify
- Static hosting (S3, Azure Blob, GitHub Pages, and similar)

## Product Direction

The current release is production-capable and optimized for real user workflows.
Ongoing work in the V2 architecture is focused on stronger schema consistency, safer round-tripping, and improved export quality at scale.
