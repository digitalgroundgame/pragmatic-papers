import type { PluginInfo, PluginLink } from "@/globals/Plugins/trackPlugins"

import { experiment } from "."

const EXPERIMENTS: PluginLink = { label: "Settings → Experiments", path: "/globals/site-settings" }

/**
 * What System → Plugins says about each plugin, under the key it has in the config's plugin
 * list (`plugins` in `./index.ts`, plus Sentry in `payload.config.ts`). `trackPlugins` takes
 * both, so a plugin without an entry here, or an entry without a plugin, fails type checking.
 */
export const PLUGIN_INFO = {
  search: {
    name: "Search",
    source: "@payloadcms/plugin-search",
    description:
      "Keeps a search index of articles, pages, volumes and topics, which the site's search reads.",
  },
  redirects: {
    name: "Redirects",
    source: "@payloadcms/plugin-redirects",
    description:
      "Redirects from old URLs to pages, volumes and articles. Hidden in the admin until it's set up.",
  },
  nestedDocs: {
    name: "Nested docs",
    source: "@payloadcms/plugin-nested-docs",
    description: "Parents and breadcrumb URLs for categories.",
  },
  seo: {
    name: "SEO",
    source: "@payloadcms/plugin-seo",
    description:
      "The Auto-generate buttons in the SEO tab of articles, pages, volumes, topics and interactives.",
  },
  formBuilder: {
    name: "Form builder",
    source: "@payloadcms/plugin-form-builder",
    description: "Forms and their submissions. Hidden in the admin until it's set up.",
  },
  s3Storage: {
    name: "S3 storage",
    source: "@payloadcms/storage-s3",
    description:
      "Keeps media and map uploads in the S3 bucket. Off where USE_LOCAL_STORAGE=true, which keeps them on disk.",
    enabled: process.env.USE_LOCAL_STORAGE !== "true",
  },
  docs: {
    name: "Help docs",
    source: "src/plugins/docs",
    description: "Help docs at /docs, written in the admin or shipped in src/docs/ with a release.",
    enabled: experiment("docs"),
    beta: true,
    settings: [EXPERIMENTS],
  },
  notifications: {
    name: "Notifications",
    source: "src/plugins/notifications",
    description:
      "The bell beside the avatar in the admin header: help docs and other news for each staff member.",
    enabled: experiment("notifications"),
    beta: true,
    settings: [EXPERIMENTS],
  },
  tours: {
    name: "Guided tours",
    source: "src/plugins/tours",
    description:
      "driver.js walkthroughs of the admin, started from a help doc or the bell's Show me.",
    enabled: experiment("tours"),
    beta: true,
    settings: [EXPERIMENTS],
  },
  sso: {
    name: "SSO",
    source: "src/plugins/sso",
    description:
      "Staff sign-in to the admin with Google or Discord, through Better Auth. Email and password login stays on.",
    enabled: experiment("sso"),
    beta: true,
    settings: [EXPERIMENTS, { label: "Integrations", path: "/globals/integrations" }],
  },
  sentry: {
    name: "Sentry",
    source: "@payloadcms/plugin-sentry",
    description:
      "Reports the errors Payload answers with a 5xx to Sentry, with the signed-in user.",
  },
} satisfies Record<string, PluginInfo>
