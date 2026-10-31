import type { Endpoint } from "payload"

import { MINE_PATH } from "../constants"
import { achievementsFor } from "../read"
import type { HeldAchievement, ResolvedAchievementsConfig } from "../types"

const noStore = { "Cache-Control": "private, no-store" }

/** What `GET /api/achievements/mine` answers. */
export interface MyAchievements {
  achievements: HeldAchievement[]
}

/**
 * `GET /api/achievements/mine`: every achievement the signed-in reader holds, for their account
 * page. 404 while achievements are switched off; 401 for someone signed out.
 */
export const mineEndpoint = (config: ResolvedAchievementsConfig): Endpoint => ({
  path: MINE_PATH,
  method: "get",
  handler: async (req) => {
    if (!(await config.enabled(req.payload))) {
      return Response.json({ message: "Not Found" }, { status: 404 })
    }
    const user = await config.currentUser(req)
    if (!user) {
      return Response.json({ message: "Sign in first." }, { status: 401, headers: noStore })
    }
    const held = await achievementsFor(req.payload, [user], config, req)
    const body: MyAchievements = { achievements: held.get(String(user.id)) ?? [] }
    return Response.json(body, { headers: noStore })
  },
})
