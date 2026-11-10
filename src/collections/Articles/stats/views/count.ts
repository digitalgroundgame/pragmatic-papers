import { sql } from "@payloadcms/db-postgres"
import type { Payload } from "payload"

import { ARTICLE_VIEWS_TABLE } from "./schema"

/** Today in UTC, as the database sees it, so every server agrees on the day. */
const TODAY = sql`(now() at time zone 'utc')::date`
const TABLE = sql.raw(`"${ARTICLE_VIEWS_TABLE}"`)

/**
 * Adds one view to today's count for an article, if it's published. One statement: the
 * article check and the increment can't race, and a draft or deleted id adds nothing.
 * Resolves whether it counted.
 */
export async function recordView(payload: Payload, articleId: number): Promise<boolean> {
  const result = await payload.db.drizzle.execute<{ article_id: number }>(sql`
    INSERT INTO ${TABLE} (article_id, day, views)
    SELECT id, ${TODAY}, 1 FROM articles WHERE id = ${articleId} AND _status = 'published'
    ON CONFLICT (article_id, day) DO UPDATE SET views = ${TABLE}.views + 1
    RETURNING article_id
  `)
  return result.rows.length > 0
}

export interface ViewCounts {
  allTime: number
  last30Days: number
  last7Days: number
  /** The first day any article was counted (YYYY-MM-DD), or null before the first view. */
  countingSince: string | null
}

/** An article's views, over the same ranges as GA's: today and the 6 or 29 days before it. */
export async function viewCounts(payload: Payload, articleId: number): Promise<ViewCounts> {
  const result = await payload.db.drizzle.execute<{
    all_time: number
    last_30_days: number
    last_7_days: number
    counting_since: string | null
  }>(sql`
    SELECT
      coalesce(sum(views), 0)::int AS all_time,
      coalesce(sum(views) FILTER (WHERE day > ${TODAY} - 30), 0)::int AS last_30_days,
      coalesce(sum(views) FILTER (WHERE day > ${TODAY} - 7), 0)::int AS last_7_days,
      (SELECT min(day)::text FROM ${TABLE}) AS counting_since
    FROM ${TABLE}
    WHERE article_id = ${articleId}
  `)
  const row = result.rows[0]
  return {
    allTime: Number(row?.all_time ?? 0),
    last30Days: Number(row?.last_30_days ?? 0),
    last7Days: Number(row?.last_7_days ?? 0),
    countingSince: row?.counting_since ?? null,
  }
}
