// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

const { refreshEmbedSnapshots } = vi.hoisted(() => ({ refreshEmbedSnapshots: vi.fn() }))
vi.mock("../logic", () => ({ refreshEmbedSnapshots }))

import { refreshEmbedSnapshotsTask } from ".."

describe("refreshEmbedSnapshotsTask", () => {
  it("runs daily and reports the counts", async () => {
    expect(refreshEmbedSnapshotsTask.schedule).toEqual([{ cron: "45 5 * * *", queue: "default" }])
    const counts = { refreshed: 2, fresh: 5, failed: 1 }
    refreshEmbedSnapshots.mockResolvedValue(counts)
    const logger = { info: vi.fn() }
    const payload = { logger }
    const handler = refreshEmbedSnapshotsTask.handler as (args: unknown) => Promise<unknown>

    await expect(handler({ req: { payload } })).resolves.toEqual({ output: counts })
    expect(refreshEmbedSnapshots).toHaveBeenCalledWith(payload, { log: logger })
    expect(logger.info).toHaveBeenCalledWith("[embed-refresh] done: 2 refreshed, 5 fresh, 1 failed")
  })
})
