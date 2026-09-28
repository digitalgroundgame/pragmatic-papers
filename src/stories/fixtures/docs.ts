import type { Article, Topic, User, Volume } from "@/payload-types"

import { landscapeImage, portraitImage, squareImage, wideImage } from "./media"
import { articleBody, paragraphs } from "./richText"

const TIMESTAMP = "2026-01-15T12:00:00.000Z"

export function userFixture(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: "Jordan Rivera",
    affiliation: "Staff writer",
    slug: "jordan-rivera",
    email: "jordan@example.com",
    biography: paragraphs(1),
    profileImage: squareImage,
    socials: [
      {
        id: "s1",
        link: { type: "custom", url: "https://bsky.app/profile/example", label: "Bluesky" },
      },
      { id: "s2", link: { type: "custom", url: "https://example.com", label: "Website" } },
    ],
    roles: ["writer"],
    collection: "users",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

export const authors: User[] = [
  userFixture(),
  userFixture({
    id: 2,
    name: "Sam Okafor",
    slug: "sam-okafor",
    email: "sam@example.com",
    affiliation: "Contributing editor",
    profileImage: null,
    socials: null,
  }),
  userFixture({
    id: 3,
    name: "Priya Natarajan",
    slug: "priya-natarajan",
    email: "priya@example.com",
    affiliation: "Data desk",
  }),
]

export function topicFixture(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 1,
    name: "Elections",
    slug: "elections",
    description: "Races, turnout, and the rules that shape them.",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

export const topics: Topic[] = [
  topicFixture(),
  topicFixture({ id: 2, name: "Housing", slug: "housing" }),
  topicFixture({ id: 3, name: "Courts", slug: "courts" }),
]

const HEADLINES = [
  "The school board races nobody is watching",
  "What a 200-vote margin buys a city council",
  "Inside the county that counts every ballot twice",
  "Zoning is the housing policy you never voted on",
  "How appellate judges get picked, and why it matters",
  "The special election with eleven percent turnout",
  "A field guide to reading a municipal budget",
  "Why redistricting fights start at the county line",
  "The volunteer poll workers holding elections together",
  "What the state supreme court decided this term",
] as const

const HERO_IMAGES = [landscapeImage, portraitImage, wideImage, squareImage]

export function articleFixture(overrides: Partial<Article> = {}): Article {
  return {
    id: 1,
    title: HEADLINES[0],
    slug: "school-board-races",
    content: articleBody,
    heroImage: landscapeImage,
    meta: {
      title: HEADLINES[0],
      description: "Turnout is low, stakes are high, and the candidates are your neighbors.",
      image: landscapeImage,
    },
    publishedAt: "2026-01-12T15:00:00.000Z",
    authors: [authors[0]!],
    topics: [topics[0]!],
    _status: "published",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

export const articles: Article[] = HEADLINES.map((title, i) =>
  articleFixture({
    id: i + 1,
    title,
    slug: `article-${i + 1}`,
    heroImage: HERO_IMAGES[i % HERO_IMAGES.length],
    meta: {
      title,
      description: "Turnout is low, stakes are high, and the candidates are your neighbors.",
      image: HERO_IMAGES[i % HERO_IMAGES.length],
    },
    authors: [authors[i % authors.length]!],
    topics: [topics[i % topics.length]!],
    publishedAt: new Date(Date.UTC(2026, 0, 12 - i, 15)).toISOString(),
  }),
)

export function volumeFixture(overrides: Partial<Volume> = {}): Volume {
  return {
    id: 1,
    title: "The Local Issue",
    volumeNumber: 12,
    slug: "12",
    description:
      "Seven articles on the offices that shape daily life and the people who fill them.",
    editorsNote: paragraphs(2),
    articles: articles.slice(0, 4),
    publishedAt: "2026-01-11T15:00:00.000Z",
    _status: "published",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  }
}

export const volumes: Volume[] = [12, 11, 10, 9, 8, 7].map((volumeNumber, i) =>
  volumeFixture({
    id: i + 1,
    volumeNumber,
    slug: String(volumeNumber),
    title: ["The Local Issue", "Courts", "Money", "Maps", "Turnout", "Labor"][i]!,
    articles: articles.slice(i, i + 4),
    publishedAt: new Date(Date.UTC(2026, 0, 11 - i * 7, 15)).toISOString(),
  }),
)
