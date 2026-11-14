import React from "react"

import { LogomarkIcon } from "@/components/Logo/icons/LogomarkIcon"
import { formatLongDate } from "@/utilities/formatDate"

import { barGroups, majorityOf, publicGroups, votingMembers, type WhipCountData } from "./model"
import { candidateColor, groupPaint } from "./paint"
import { lightColor } from "./picture"
import { asOpened, countdownLine, headToHead, type CandidateCount } from "./seo"

/** The size link previews are drawn at: Open Graph's 1.91:1. */
export const CARD_SIZE = { width: 1200, height: 630 }

const BRAND = "#ff401a"
// Brand-colored text on white, and the fill behind white text: the brand's own orange is too
// light for either (the site's --brand-text and --brand-fill).
const BRAND_TEXT = "#e0330f"
const BRAND_FILL = "#e0330f"
const INK = "#171717"
const QUIET = "#525252"
const PAD = 56
/** The wordmark is 100×12, so this height draws it 300 wide. */
const LOGO_HEIGHT = 36

interface Props {
  title: string
  data: WhipCountData
  now: Date
}

function Side({
  count,
  color,
  align,
}: {
  count: CandidateCount
  color: string
  align: "flex-start" | "flex-end"
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 22, height: 22, borderRadius: 4, background: color }} />
        <div style={{ fontSize: 40, fontWeight: 700, color: INK }}>{count.candidate.name}</div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 132,
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 6,
          color: INK,
        }}
      >
        {count.backs}
      </div>
      <div style={{ display: "flex", fontSize: 24, color: QUIET, marginTop: 6 }}>
        {count.leans > 0 ? `backing, plus ${count.leans} leaning` : "publicly backing"}
      </div>
    </div>
  )
}

/**
 * A whip count as a link preview: the two leading candidates set against each other with their
 * public backers, one tick a voter with the line to win, the countdown to the vote, and the
 * site's logo. Drawn with `next/og`, so it is plain flexbox and inline styles.
 */
export function WhipCountCard({ title, data, now }: Props): React.ReactElement {
  const shown = asOpened(data)
  const voters = votingMembers(shown)
  const groups = publicGroups(shown)
  const majority = majorityOf(voters.length)
  const [first, second] = headToHead(data)
  const countdown = countdownLine(data, now)
  const ticks = barGroups(groups).flatMap((group) =>
    group.members.map((member) => ({ key: member.name, paint: groupPaint(shown, group) })),
  )

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        fontFamily: "Geist",
        borderTop: `14px solid ${BRAND}`,
        padding: `${PAD - 14}px ${PAD}px 0`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <LogomarkIcon
          fill={INK}
          brandFill={BRAND}
          width={(LOGO_HEIGHT * 100) / 12}
          height={LOGO_HEIGHT}
        />
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 2,
            color: BRAND_TEXT,
          }}
        >
          {`WHIP COUNT · AS OF ${formatLongDate(`${data.asOf}T00:00:00Z`).toUpperCase()}`}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 38,
          fontWeight: 600,
          color: INK,
          marginTop: 26,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>

      {first && (
        <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
          <Side
            count={first}
            color={lightColor(candidateColor(data, first.candidate))}
            align="flex-start"
          />
          <div
            style={{
              display: "flex",
              fontSize: 36,
              fontWeight: 700,
              color: BRAND_TEXT,
              padding: "0 24px",
              marginTop: 40,
            }}
          >
            vs
          </div>
          {second && (
            <Side
              count={second}
              color={lightColor(candidateColor(data, second.candidate))}
              align="flex-end"
            />
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        <div style={{ display: "flex", position: "relative", gap: 4, height: 44 }}>
          {ticks.map((tick) => (
            <div
              key={tick.key}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 3,
                background: lightColor(tick.paint.color),
                opacity: tick.paint.opacity,
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              left: `${(majority / Math.max(voters.length, 1)) * 100}%`,
              top: -10,
              width: 4,
              height: 64,
              marginLeft: -2,
              background: INK,
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
          paddingBottom: 40,
          fontSize: 24,
          color: QUIET,
        }}
      >
        <div style={{ display: "flex" }}>{`${majority} of ${voters.length} votes to win`}</div>
        {countdown && (
          <div
            style={{
              display: "flex",
              background: BRAND_FILL,
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 26,
              padding: "10px 22px",
              borderRadius: 6,
            }}
          >
            {countdown}
          </div>
        )}
      </div>
    </div>
  )
}
