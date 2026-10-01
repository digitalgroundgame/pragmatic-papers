[← Table of Contents](https://github.com/digitalgroundgame/pragmatic-papers/wiki#table-of-contents)

## Overview

The Pragmatic Papers is a Next.js application with an embedded PayloadCMS instance, hosted on a Hetzner VPS managed by Coolify, and served globally via Cloudflare.

## System diagram

![pragmatic_papers_architecture](https://github.com/user-attachments/assets/64c5e5aa-b7f0-4373-9230-7589af9fec4a)

---

## Infrastructure

- **Hetzner VPS** — a virtual private server running all application services via Docker containers orchestrated by Coolify.
- **Coolify** — the self-hosted deployment platform responsible for container management, environment variables, and deploy hooks.
- **Cloudflare** — sits in front of the VPS, handling DNS, DDoS protection, caching, and SSL termination. All traffic passes through Cloudflare before reaching the server.

## Application

- **Next.js** — the core framework, responsible for rendering pages (statically where possible), routing, and serving API routes.
- **PayloadCMS** — embedded directly inside the Next.js app (not a separate service). Provides the admin panel, content collections, and REST/GraphQL APIs. Accessible at `/admin`.
- **React** — the UI rendering layer used throughout the frontend, built on Next.js's App Router.

## Data

- **PostgreSQL** — the primary database, running as a Docker container on the VPS. PayloadCMS connects directly to it for content storage.

## Frontend

- **Tailwind CSS** — utility-first CSS framework for styling.
- **shadcn/ui + Base UI** — component library providing accessible, unstyled primitives styled with Tailwind.

## Observability

- **Google Tag Manager (GTM)** — loaded on the frontend; manages when and how third-party scripts fire.
- **Google Analytics (GA4)** — injected via GTM, used for page view tracking and user analytics.

---

## Request lifecycle

1. User's browser makes a request to the Pragmatic Papers domain.
2. **Cloudflare** receives the request, applies edge caching rules, and forwards it to the Hetzner VPS if needed.
3. **Coolify / Docker** routes the request to the running Next.js container.
4. **Next.js** serves the response — either a pre-rendered static page from the build, or a dynamically server-rendered page.
5. If the request is to `/admin` or a Payload API route, **PayloadCMS** handles it, querying **PostgreSQL** as needed.
6. The browser renders the React page. **GTM** fires, loading **Google Analytics** for tracking.

---

## Key conventions

- Static rendering is preferred by default; dynamic rendering is opted into explicitly per route.
- PayloadCMS content is fetched at build time where possible to maximise static output.
- All environment-specific config (database URLs, API keys) is managed through Coolify's environment variable UI — never committed to the repo.
