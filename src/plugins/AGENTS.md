# Plugins

## Our plugins

A feature that could be published one day lives in `src/plugins/<name>/`, shaped like
Payload's own plugins so it can be lifted out without a rewrite:

- `index.ts` exports `<name>Plugin`, and nothing else the app needs. It's made with
  `registerPlugin({ slug, order, manifest, plugin })` (`@/utilities/registerPlugin`): Payload's
  `definePlugin` descriptor plus a `manifest` (name, source, description, `switch`), so
  `<name>Plugin(options)` carries Payload's `slug` and `options`, and its `plugin` gets the
  options and the other plugins (`plugins`). When Payload covers what the manifest does, drop
  that key. The manifest is fixed facts about the plugin; what a site decides goes in options.
  It lists the plugin on the admin's **System → Plugins** page. A package that doesn't describe
  itself is wrapped with `describePlugin` where `src/plugins/index.ts` installs it.
- Every plugin takes `enabled` (checked at runtime; `isPluginOn` reads it) and `disabled`
  (`SitePluginOptions`). Switching a plugin off stops its behavior; its schema stays.
- A plugin that checks `enabled` on each request offers a `switch` in its manifest:
  `pluginSwitches` (`src/globals/Plugins/`) gives it a checkbox on System → Plugins named for
  its slug (a camelCase one), `src/plugins/index.ts` passes `pluginSwitch("<slug>")` as its
  `enabled`, and routes outside the plugin gate on `isPluginEnabled("<slug>")`. A beta's switch
  starts off (`defaultValue: false`), which shows a **Beta** badge; when it graduates, flip the
  default rather than deleting the switch. This replaces an experiment in Settings for a
  feature that's a plugin; anything else stays an experiment.
- Settings an admin changes while the site runs (thresholds, limits, rules) go in the plugin's
  own global, in the System group (the comments plugin's **Comment settings**), never as fields
  on Settings or Plugins: a plugin can't depend on the host's globals, and a global of its own
  gets its own access (moderators read Comment settings; Settings is admin-only) and its own save
  hooks (saving Settings clears Next's whole cache and the edge). A plugin with nothing for an
  admin to change has no global: what the site decides goes in options, and on or off is its
  switch. Settings (`site-settings`) keeps the experiments and site-wide values no one feature
  owns; a feature that already has a global (Header's ticker, Integrations) keeps its settings
  there.
- `types.ts` holds `<Name>PluginConfig`, extending `SitePluginOptions`. Options have defaults,
  and `disabled: true` leaves the schema in place (so migrations don't change) but turns the
  behavior off.
- `collections/`, `hooks/`, `endpoints/` and `components/` as the plugin needs them. Admin
  components are referenced by path through `exports/client.ts` and `exports/rsc.ts`, so
  the import map paths survive a move into a package.
- Whatever is this app's comes in through the options: preview paths, access and roles,
  blocks and fields, side effects like `purgeEdgeCache` (as a callback). Payload comes from
  `req.payload` or the `payload` a hook is handed, never `@/data/payload`.
- `@/utilities` may be imported directly: it would ship alongside as a shared package.

ESLint enforces the import rules for every folder under `src/plugins/` (`eslint.config.mjs`).
