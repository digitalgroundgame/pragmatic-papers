import { describe, expect, it } from "vitest"

import { describeTimeline } from "@/blocks/Timeline/narration"

describe("describeTimeline", () => {
  it("renders one spoken line per event, in author order", () => {
    expect(
      describeTimeline({
        title: "Fall of Rome",
        events: [
          {
            date: "0410-08-24T00:00:00.000Z",
            title: "Visigoths sack Rome",
            description: "Alaric enters the city",
          },
          { date: "0476-09-04T00:00:00.000Z", title: "Romulus Augustulus is deposed" },
        ],
      }),
    ).toBe(
      '(A timeline titled "Fall of Rome": August 24, 410: Visigoths sack Rome. Alaric enters the city.\n' +
        "September 4, 476: Romulus Augustulus is deposed.)",
    )
  })

  it("drops the title clause when the timeline is untitled", () => {
    expect(describeTimeline({ events: [{ title: "Sometime in late antiquity" }] })).toBe(
      "(A timeline: Sometime in late antiquity.)",
    )
  })

  it("falls back to a bare aside when there are no events to read", () => {
    expect(describeTimeline({ title: "Fall of Rome", events: [] })).toBe(
      '(A timeline titled "Fall of Rome".)',
    )
    // A malformed document may omit the array entirely.
    expect(describeTimeline({})).toBe("(A timeline.)")
    expect(describeTimeline({ events: "not an array" })).toBe("(A timeline.)")
  })

  it("speaks a date-only event as a bare date", () => {
    expect(describeTimeline({ events: [{ date: "1453-05-29T00:00:00.000Z" }] })).toBe(
      "(A timeline: May 29, 1453.)",
    )
  })

  it("accepts a Date instance as well as an ISO string", () => {
    expect(
      describeTimeline({
        events: [{ date: new Date("1453-05-29T00:00:00.000Z"), title: "Constantinople falls" }],
      }),
    ).toBe("(A timeline: May 29, 1453: Constantinople falls.)")
  })

  it("formats dates in en-US/UTC regardless of the surrounding timezone", () => {
    // Late-evening UTC would roll back a day in a negative-offset locale; the
    // spoken date must not depend on where the narration was generated.
    expect(describeTimeline({ events: [{ date: "1453-05-29T23:30:00.000Z" }] })).toBe(
      "(A timeline: May 29, 1453.)",
    )
  })

  it("does not double up punctuation the author already wrote", () => {
    expect(
      describeTimeline({
        events: [
          { date: "0410-08-24T00:00:00.000Z", title: "Rome falls!", description: "At last?" },
        ],
      }),
    ).toBe("(A timeline: August 24, 410: Rome falls! At last?)")
  })

  it("keeps an event that has words but no usable date", () => {
    expect(
      describeTimeline({
        events: [
          { date: "not a date", title: "Sometime in late antiquity" },
          { title: "No date at all" },
        ],
      }),
    ).toBe("(A timeline: Sometime in late antiquity.\nNo date at all.)")
  })

  it("skips events with nothing sayable", () => {
    expect(
      describeTimeline({
        events: [
          // Neither a parseable date nor any text.
          { date: "not a date" },
          { title: "   ", description: "" },
          // Malformed rows must not crash the narration.
          null,
          "an event",
          { title: "The empire quietly ends" },
        ],
      }),
    ).toBe("(A timeline: The empire quietly ends.)")
  })

  it("omits citations and avatars, which have nothing to say aloud", () => {
    const spoken = describeTimeline({
      events: [
        {
          date: "0410-08-24T00:00:00.000Z",
          title: "Visigoths sack Rome",
          avatar: { id: 7, filename: "alaric.jpg", alt: "Alaric I" },
          enableCitation: true,
          citation: { type: "custom", url: "https://example.com/alaric" },
        },
      ],
    })

    expect(spoken).toBe("(A timeline: August 24, 410: Visigoths sack Rome.)")
    expect(spoken).not.toContain("example.com")
    expect(spoken).not.toContain("alaric.jpg")
  })

  it("ignores a non-string timeline title", () => {
    expect(describeTimeline({ title: 1453, events: [{ title: "Constantinople falls" }] })).toBe(
      "(A timeline: Constantinople falls.)",
    )
  })
})
