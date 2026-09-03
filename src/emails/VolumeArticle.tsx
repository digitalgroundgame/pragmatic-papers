import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"
import { Tailwind } from "@react-email/tailwind"
import { formatDistanceToNow } from "date-fns"
import * as React from "react"

import type { Article, Topic, User, Volume } from "@/payload-types"
import { formatAuthors } from "@/utilities/formatAuthors"
import { getMediaUrl } from "@/utilities/getMediaUrl"
import { isResolved } from "@/utilities/relationships"
import { cn } from "@/utilities/utils"

export interface VolumeArticleEmailProps {
  article: Article
  volume: Pick<Volume, "title" | "volumeNumber" | "slug">
  dayIndex: number
  totalDays: number
  siteUrl: string
}

function articleExcerpt(
  article: Article,
  volume: Pick<Volume, "title" | "volumeNumber" | "slug">,
): string {
  if (article.meta?.description) return article.meta.description
  return `A new piece from Volume ${volume.volumeNumber ?? ""}.`
}

/**
 * Pipes the hero image through /_next/image to get an optimized image.
 *
 * Width must be one of Next's default deviceSizes ([640, 750, 828, 1080,
 * 1200, 1920, ...]) or /_next/image returns 400. 1080 is just under 2× the
 * email's 560px max-width — Retina mail clients still render sharp without
 * us serving 4K source files.
 *
 * Local-storage paths are relative (e.g. /api/media/file/...) — passing them
 * directly lets /_next/image handle them with an internal route rather than
 * an outbound HTTP fetch (which fails in Docker where localhost:8000 is only
 * the external port mapping, not the container's own address).
 */
function heroImageUrl(article: Article, siteUrl: string): string | null {
  const hero = article.heroImage
  if (!isResolved(hero)) return null
  const raw = getMediaUrl(hero.url)
  if (!raw) return null
  const params = new URLSearchParams({ url: raw, w: "1080", q: "80" })
  return `${siteUrl}/_next/image?${params.toString()}`
}

function getDimensions(article: Article):
  | {
      width?: number
      height?: number
    }
  | undefined {
  if (!isResolved(article.heroImage)) return undefined
  return {
    width: article.heroImage.sizes?.small?.width ?? undefined,
    height: article.heroImage.sizes?.small?.height ?? undefined,
  }
}

/**
 * Make sure avatar URLs are always absolute.
 * Email clients resolve a relative src against the email's host, which
 * for the hosted view is the mailing-list provider rather than our site, so it
 * 404s.
 */
function getAvatars(article: Article, siteUrl: string): string[] {
  const authors = (article.authors || []).filter(isResolved<User>)
  return authors
    .map((a) => {
      const image = a?.profileImage
      if (!isResolved(image)) return null
      const raw = getMediaUrl(image.sizes?.square?.url)
      if (!raw) return null
      if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
      return `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`
    })
    .filter((url): url is string => Boolean(url))
}

export function VolumeArticleEmail({
  article,
  volume,
  dayIndex,
  totalDays,
  siteUrl,
}: VolumeArticleEmailProps): React.ReactElement {
  const excerpt = articleExcerpt(article, volume)
  const heroUrl = heroImageUrl(article, siteUrl)
  const image = getDimensions(article)
  const avatars = getAvatars(article, siteUrl)
  const articleUrl = `${siteUrl}/articles/${article.slug}`
  const volumeUrl = `${siteUrl}/volumes/${volume.slug}`
  const authors = (article.authors || []).filter(isResolved<User>)

  return (
    <Html>
      <Head />
      <Preview>{`${article.title} — ${excerpt}`}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-5 py-8">
            <Img
              src={`${siteUrl}/the-pragmatic-papers-logo-dark.png`}
              alt="The Pragmatic Papers Logo"
              width="256"
              height="28"
            />
            <Text className="my-1 text-base tracking-wider text-neutral-600 uppercase">
              Volume {volume.volumeNumber} · Day {dayIndex} of {totalDays}
            </Text>
            {heroUrl && (
              <Section>
                <Link href={articleUrl}>
                  <Img
                    src={heroUrl}
                    alt={article.title}
                    width={image?.width}
                    height={image?.height}
                    className="my-3 rounded-md bg-black"
                  />
                </Link>
              </Section>
            )}
            <Section>
              <Link href={articleUrl} className="text-black no-underline">
                <Text className="my-1 text-3xl font-bold">{article.title}</Text>
              </Link>
              {authors.length > 0 && (
                <Row className="my-1">
                  {avatars.length > 0 && (
                    <Column style={{ width: 24 + avatars.length * 8 }}>
                      {avatars.map((src, i) => (
                        <Img
                          key={src}
                          src={src}
                          width="24"
                          height="24"
                          className={cn(
                            "ring-background inline-block rounded-full bg-black ring-2",
                            i > 0 ? "-ml-2" : "ml-0",
                          )}
                        />
                      ))}
                    </Column>
                  )}
                  <Column>
                    <Text className="my-0 pl-2 text-sm text-neutral-600">
                      By {formatAuthors(authors)}
                    </Text>
                  </Column>
                </Row>
              )}
              {article.publishedAt && (
                <Text className="my-0 text-neutral-600">
                  {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                </Text>
              )}
              <Text className="my-1 text-base leading-relaxed text-black">{excerpt}</Text>
              {article.topics && article.topics.length > 0 && (
                <Text className="my-1 text-xs tracking-wide text-neutral-600 uppercase">
                  {article.topics
                    .filter(isResolved<Topic>)
                    .map((t) => t.name)
                    .join(" · ")}
                </Text>
              )}
              <Link
                href={articleUrl}
                className="mx-auto my-3 block w-fit rounded-md px-5 py-3 text-center font-medium text-white no-underline"
                style={{ backgroundColor: "#ff401a" }}
              >
                Read on The Pragmatic Papers
              </Link>
            </Section>
            <Hr className="my-8 border-neutral-200" />
            <Text className="text-xs text-neutral-600">
              You&apos;re receiving this because you subscribed to The Pragmatic Papers. Catch up on
              the full{" "}
              <Link href={volumeUrl} style={{ color: "#ff401a" }}>
                Volume {volume.volumeNumber}
              </Link>{" "}
              any time, or{" "}
              <Link href="{{ UnsubscribeURL }}" style={{ color: "#ff401a" }}>
                unsubscribe
              </Link>
              .
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default VolumeArticleEmail
