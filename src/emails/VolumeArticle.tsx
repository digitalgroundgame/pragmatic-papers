import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { Tailwind } from "@react-email/tailwind"
import * as React from "react"

import type { Article, Volume } from "@/payload-types"
import { getMediaUrl } from "@/utilities/getMediaUrl"

export interface VolumeArticleEmailProps {
  article: Article
  volume: Pick<Volume, "title" | "volumeNumber" | "slug">
  dayIndex: number
  totalDays: number
  siteUrl: string
}

function articleExcerpt(article: Article): string {
  if (article.meta?.description) return article.meta.description
  return `A new piece from Volume ${article.populatedVolume?.volumeNumber ?? ""}.`
}

function heroImageUrl(article: Article): string | null {
  const hero = article.heroImage
  if (!hero || typeof hero === "number") return null
  const url = getMediaUrl(hero.url)
  if (!url) return null
  return url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_SERVER_URL ?? ""}${url}`
}

export function VolumeArticleEmail(props: VolumeArticleEmailProps): React.ReactElement {
  const { article, volume, dayIndex, totalDays, siteUrl } = props
  const excerpt = articleExcerpt(article)
  const heroUrl = heroImageUrl(article)
  const articleUrl = `${siteUrl}/articles/${article.slug}`
  const volumeUrl = `${siteUrl}/volumes/${volume.slug}`

  return (
    <Html>
      <Head />
      <Preview>{`${article.title} — ${excerpt}`}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto max-w-[560px] px-5 py-8">
            <Text className="m-0 text-xs tracking-wider text-neutral-500 uppercase">
              Volume {volume.volumeNumber} · Day {dayIndex} of {totalDays}
            </Text>
            {heroUrl ? (
              <Section className="mt-4">
                <Link href={articleUrl}>
                  <Img
                    src={heroUrl}
                    alt={article.title}
                    width="520"
                    className="rounded-md object-cover"
                  />
                </Link>
              </Section>
            ) : null}
            <Section className="mt-5">
              <Link href={articleUrl} className="text-neutral-900 no-underline">
                <Text className="m-0 text-2xl leading-tight font-semibold">{article.title}</Text>
              </Link>
              <Text className="mt-3 text-base leading-relaxed text-neutral-700">{excerpt}</Text>
              <Link
                href={articleUrl}
                className="mt-5 inline-block rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white no-underline"
              >
                Read on Pragmatic Papers
              </Link>
            </Section>
            <Hr className="my-8 border-neutral-200" />
            <Text className="m-0 text-xs text-neutral-500">
              You&apos;re receiving this because you subscribed to Pragmatic Papers. Catch up on the
              full <Link href={volumeUrl}>Volume {volume.volumeNumber}</Link> any time, or{" "}
              <Link href="{{ UnsubscribeURL }}">unsubscribe</Link>.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default VolumeArticleEmail
