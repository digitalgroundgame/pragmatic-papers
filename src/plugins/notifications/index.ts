import type { Plugin } from "payload"

import type { NotificationsOptions } from "./types"

export type {
  NotificationItem,
  NotificationSource,
  NotificationsOptions,
  NotificationType,
} from "./types"

/**
 * A bell beside the account avatar in the admin header: what's new for the logged-in user,
 * from each source, with an unread count and per-type muting kept in their Payload
 * preferences (no schema of its own). The docs plugin is the first source.
 */
export const notificationsPlugin =
  (options: NotificationsOptions): Plugin =>
  (config) => ({
    ...config,
    // `custom` stays on the server, so the sources' functions never reach the client config.
    custom: { ...config.custom, notifications: options },
    admin: {
      ...config.admin,
      components: {
        ...config.admin?.components,
        // Config-level actions render after a view's own, so the bell sits next to the avatar.
        actions: [
          ...(config.admin?.components?.actions ?? []),
          "@/plugins/notifications/NotificationsBell#NotificationsBell",
        ],
      },
    },
  })
