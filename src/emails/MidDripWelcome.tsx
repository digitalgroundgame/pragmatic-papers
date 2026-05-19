import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { Tailwind } from "@react-email/tailwind"
import * as React from "react"

import type { Article, Volume } from "@/payload-types"

export interface MidDripWelcomeEmailProps {
  volume: Pick<Volume, "title" | "volumeNumber" | "slug">
  alreadySent: Pick<Article, "title" | "slug">[]
  remainingCount: number
  siteUrl: string
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
            <Text className="m-0 text-xs tracking-wider text-neutral-500 uppercase">
              Welcome · Volume {volume.volumeNumber} in progress
            </Text>
            <Section className="mt-5">
              <Text className="m-0 text-2xl leading-tight font-semibold">
                You&apos;re joining mid-Volume — here&apos;s what you&apos;ve missed
              </Text>
              <Text className="mt-3 text-base leading-relaxed text-neutral-700">
                We&apos;re currently sending one article per weekday from{" "}
                <Link href={volumeUrl}>{volume.title}</Link>. You&apos;ll get the next article
                tomorrow morning along with everyone else. In the meantime, here are the pieces
                already sent in this Volume:
              </Text>
              <Section className="mt-5">
                {alreadySent.map((article) => (
                  <Text key={article.slug} className="my-2 text-base">
                    <Link
                      href={`${siteUrl}/articles/${article.slug}`}
                      className="text-neutral-900 underline"
                    >
                      {article.title}
                    </Link>
                  </Text>
                ))}
              </Section>
              <Text className="mt-5 text-base leading-relaxed text-neutral-700">
                {remainingCount > 0
                  ? `${remainingCount} more article${remainingCount === 1 ? "" : "s"} ${remainingCount === 1 ? "is" : "are"} coming over the next ${remainingCount === 1 ? "weekday" : "few weekdays"}.`
                  : "You'll join the next Volume from the very first day."}
              </Text>
            </Section>
            <Hr className="my-8 border-neutral-200" />
            <Text className="m-0 text-xs text-neutral-500">
              You&apos;re receiving this because you just subscribed to Pragmatic Papers. You can{" "}
              <Link href="{{ UnsubscribeURL }}">unsubscribe</Link> any time.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default MidDripWelcomeEmail
