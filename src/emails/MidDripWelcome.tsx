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
import * as React from "react"

import type { Article, Volume } from "@/payload-types"

export interface MidDripWelcomeEmailProps {
  volume: Pick<Volume, "title" | "volumeNumber" | "slug">
  alreadySent: (Pick<Article, "title" | "slug"> & {
    heroImageUrl?: string | null
    authorsText?: string | null
    avatarUrl?: string | null
  })[]
  remainingCount: number
  siteUrl: string
}

function thumbnailUrl(rawUrl: string | null | undefined, siteUrl: string): string | null {
  if (!rawUrl) return null
  const params = new URLSearchParams({ url: rawUrl, w: "128", q: "80" })
  return `${siteUrl}/_next/image?${params.toString()}`
}

export function MidDripWelcomeEmail(props: MidDripWelcomeEmailProps): React.ReactElement {
  const { volume, alreadySent, remainingCount, siteUrl } = props
  const volumeUrl = `${siteUrl}/volumes/${volume.slug}`

  return (
    <Html>
      <Head />
      <Preview>{`Welcome to Pragmatic Papers — you're joining Volume ${volume.volumeNumber} in progress`}</Preview>
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
              Welcome · Volume {volume.volumeNumber} in progress
            </Text>
            <Section className="mt-5">
              <Text className="m-0 text-3xl font-bold">
                You&apos;re joining mid-volume! Here&apos;s what you&apos;ve missed:
              </Text>
              <Text className="mt-3 text-base leading-relaxed text-black">
                We&apos;re currently sending one article per weekday from{" "}
                <Link href={volumeUrl} style={{ color: "#ff401a" }}>
                  {volume.title}
                </Link>
                . You&apos;ll get the next article tomorrow morning along with everyone else.
              </Text>
              <Text className="mt-3 text-base leading-relaxed text-black">
                In the meantime, here are the pieces already sent in this Volume:
              </Text>
              <Section className="mt-5">
                {alreadySent.map((article) => {
                  const thumb = thumbnailUrl(article.heroImageUrl, siteUrl)
                  const articleUrl = `${siteUrl}/articles/${article.slug}`
                  return (
                    <Row key={article.slug} className="my-3">
                      {thumb && (
                        <Column className="w-40">
                          <Link href={articleUrl}>
                            <Img
                              src={thumb}
                              width="144"
                              height="96"
                              alt={article.title}
                              className="block rounded-sm bg-black object-cover"
                            />
                          </Link>
                        </Column>
                      )}
                      <Column valign="top">
                        <Link href={articleUrl} className="text-black no-underline">
                          <Text className="m-0 text-lg leading-snug font-bold">
                            {article.title}
                          </Text>
                        </Link>
                        {(article.authorsText || article.avatarUrl) && (
                          <Row className="mt-1">
                            {article.avatarUrl && (
                              <Column style={{ width: 30 }}>
                                <Img
                                  src={article.avatarUrl}
                                  width="24"
                                  height="24"
                                  className="bg-black"
                                  style={{ display: "inline-block", borderRadius: "50%" }}
                                />
                              </Column>
                            )}
                            {article.authorsText && (
                              <Column>
                                <Text className="m-0 text-sm text-neutral-600">
                                  By {article.authorsText}
                                </Text>
                              </Column>
                            )}
                          </Row>
                        )}
                      </Column>
                    </Row>
                  )
                })}
              </Section>
              <Text className="mt-5 text-base leading-relaxed text-neutral-600">
                {remainingCount > 0
                  ? `${remainingCount} more article${remainingCount === 1 ? "" : "s"} ${remainingCount === 1 ? "is" : "are"} coming over the next ${remainingCount === 1 ? "weekday" : "few weekdays"}.`
                  : "You'll join the next Volume from the very first day."}
              </Text>
            </Section>
            <Hr className="my-8 border-neutral-200" />
            <Text className="m-0 text-xs text-neutral-600">
              You&apos;re receiving this because you just subscribed to Pragmatic Papers. You can{" "}
              <Link href="{{ UnsubscribeURL }}" style={{ color: "#ff401a" }}>
                unsubscribe
              </Link>{" "}
              any time.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default MidDripWelcomeEmail
