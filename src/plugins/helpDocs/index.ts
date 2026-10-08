import type { Plugin } from "payload"

/**
 * The help bell beside the account avatar in the admin header: the articles in src/docs/ that
 * the logged-in user's roles are meant to see, with an unread count kept in their Payload
 * preferences. The articles ship with the code, so each release brings its own.
 */
export const helpDocsPlugin = (): Plugin => (config) => ({
  ...config,
  admin: {
    ...config.admin,
    components: {
      ...config.admin?.components,
      // Config-level actions render after a view's own, so the bell sits next to the avatar.
      actions: [
        ...(config.admin?.components?.actions ?? []),
        "@/plugins/helpDocs/HelpDocsBell#HelpDocsBell",
      ],
    },
  },
})
