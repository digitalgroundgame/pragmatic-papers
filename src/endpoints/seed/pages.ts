import type { Page } from "@/payload-types"
import type { Payload, RequiredDataFromCollectionSlug } from "payload"

import { createRichTextContent } from "./richtext"

type PageData = RequiredDataFromCollectionSlug<"pages">

/**
 * Creates a page, or updates the existing one if a slug conflict is detected.
 * Needed because Payload's internal version cleanup can fail during bulk deletes,
 * leaving orphaned records that cause unique slug violations on re-seed.
 */
export async function createOrUpdatePage(payload: Payload, data: PageData): Promise<Page> {
  try {
    return await payload.create({ collection: "pages", data })
  } catch (err) {
    const isSlugConflict = err instanceof Error && err.message.toLowerCase().includes("slug")
    if (!isSlugConflict) throw err

    const existing = await payload.find({
      collection: "pages",
      where: { slug: { equals: data.slug } },
      limit: 1,
    })

    const existingPage = existing.docs[0]
    if (!existingPage) throw err

    payload.logger.warn(
      `Page slug "${data.slug}" already exists (id: ${existingPage.id}), updating instead of creating.`,
    )

    return await payload.update({
      collection: "pages",
      id: existingPage.id,
      data,
    })
  }
}

interface PageConfig {
  title: string
  slug: string
  content: string
  description: string
}

interface CreatePagesResult {
  aboutPage: Page
  articlesPage: Page
  contactPage: Page
  privacyPolicyPage: Page
  termsOfUsePage: Page
  volumesPage: Page
}

interface AboutContributors {
  chiefEditorIds: number[]
  editorIds: number[]
  writerIds: number[]
}

/** Hero richText with a heading containing the page name (for pageHero type). */
const createHeroRichTextHeading = (pageTitle: string, tag: "h1" | "h2" | "h3" | "h4" = "h1") => ({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: pageTitle,
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr" as const,
        format: "" as const,
        indent: 0,
        tag,
        type: "heading" as const,
        version: 1,
      },
    ],
    direction: "ltr" as const,
    format: "" as const,
    indent: 0,
    type: "root",
    version: 1,
  },
})

export const createPages = async (
  payload: Payload,
  contributors?: AboutContributors,
): Promise<CreatePagesResult> => {
  const pageConfigs: Record<
    "about" | "articles" | "contact" | "privacyPolicy" | "termsOfUse" | "volumes",
    PageConfig
  > = {
    about: {
      title: "About",
      slug: "about",
      content:
        "Welcome to Pragmatic Papers. We are dedicated to publishing high-quality research and scholarly articles across various disciplines.",
      description: "Learn more about Pragmatic Papers and our mission.",
    },
    articles: {
      title: "Articles",
      slug: "articles",
      content:
        "Browse our collection of peer-reviewed articles and research papers. Each volume brings together curated works from leading scholars.",
      description: "Browse all articles published by Pragmatic Papers.",
    },
    contact: {
      title: "Contact",
      slug: "contact",
      content:
        "We would love to hear from you. Please reach out to us if you have any questions, suggestions, or inquiries.",
      description: "Get in touch with the Pragmatic Papers team.",
    },
    privacyPolicy: {
      title: "Privacy Policy",
      slug: "privacy-policy",
      content:
        "Your privacy is important to us. This privacy policy explains how we collect, use, and protect your personal information when you use our website.",
      description: "Read our privacy policy to understand how we handle your data.",
    },
    termsOfUse: {
      title: "Terms of Use",
      slug: "terms-of-use",
      content:
        "By using our website, you agree to these terms of use. Please read them carefully before accessing or using our services.",
      description: "Review our terms of use before using our website.",
    },
    volumes: {
      title: "Volumes",
      slug: "volumes",
      content:
        "Explore our published volumes. Each volume is a themed collection of articles, edited and introduced by our editorial team.",
      description: "Explore all volumes published by Pragmatic Papers.",
    },
  }

  const { about, articles, contact, privacyPolicy, termsOfUse, volumes } = pageConfigs

  const aboutLayout: PageData["layout"] = [
    {
      blockType: "content",
      columns: [
        {
          size: "full",
          richText: createRichTextContent(about.content),
          enableLink: false,
        },
      ],
    },
  ]

  if (contributors?.chiefEditorIds.length) {
    aboutLayout.push({
      blockType: "contributors",
      title: "Chief Editors",
      people: contributors.chiefEditorIds,
    })
  }
  if (contributors?.editorIds.length) {
    aboutLayout.push({
      blockType: "contributors",
      title: "Editors",
      people: contributors.editorIds,
    })
  }
  if (contributors?.writerIds.length) {
    aboutLayout.push({
      blockType: "contributors",
      title: "Authors",
      people: contributors.writerIds,
    })
  }

  const aboutPage = await createOrUpdatePage(payload, {
    title: about.title,
    slug: about.slug,
    hero: {
      type: "lowImpact",
      richText: null,
      links: [],
      media: null,
    },
    layout: aboutLayout,
    meta: {
      title: about.title,
      description: about.description,
      image: null,
    },
    _status: "published",
    publishedAt: new Date().toISOString(),
  })

  const articlesPage = await createOrUpdatePage(payload, {
    title: articles.title,
    slug: articles.slug,
    hero: {
      type: "pageHero",
      richText: createHeroRichTextHeading(articles.title),
      links: [],
      media: null,
    },
    layout: [
      {
        blockType: "volumeView",
        introContent: null,
        populateBy: "collection",
        relationTo: "volumes",
        limit: 6,
        selectedDocs: [],
      },
    ],
    meta: {
      title: articles.title,
      description: articles.description,
      image: null,
    },
    _status: "published",
    publishedAt: new Date().toISOString(),
  })

  const contactForm = await payload.create({
    collection: "forms",
    data: {
      title: "Contact Form",
      fields: [
        {
          blockType: "text",
          name: "name",
          label: "Name",
          required: true,
          width: 100,
        },
        {
          blockType: "email",
          name: "email",
          label: "Email",
          required: true,
          width: 100,
        },
        {
          blockType: "text",
          name: "subject",
          label: "Subject",
          required: true,
          width: 100,
        },
        {
          blockType: "textarea",
          name: "message",
          label: "Message",
          required: true,
          width: 100,
        },
      ],
      submitButtonLabel: "Send Message",
      confirmationType: "message",
      confirmationMessage: createRichTextContent(
        "Thank you for reaching out! We will get back to you as soon as possible.",
      ),
    },
  })

  const contactPage = await createOrUpdatePage(payload, {
    title: contact.title,
    slug: contact.slug,
    hero: {
      type: "lowImpact",
      richText: null,
      links: [],
      media: null,
    },
    layout: [
      {
        blockType: "content",
        columns: [
          {
            size: "full",
            richText: createRichTextContent(contact.content),
            enableLink: false,
          },
        ],
      },
      {
        blockType: "formBlock",
        form: contactForm.id,
        enableIntro: false,
      },
    ],
    meta: {
      title: contact.title,
      description: contact.description,
      image: null,
    },
    _status: "published",
    publishedAt: new Date().toISOString(),
  })

  const privacyPolicyPage = await createOrUpdatePage(payload, {
    title: privacyPolicy.title,
    slug: privacyPolicy.slug,
    hero: {
      type: "lowImpact",
      richText: null,
      links: [],
      media: null,
    },
    layout: [
      {
        blockType: "content",
        columns: [
          {
            size: "full",
            richText: createRichTextContent(privacyPolicy.content),
            enableLink: false,
          },
        ],
      },
    ],
    meta: {
      title: privacyPolicy.title,
      description: privacyPolicy.description,
      image: null,
    },
    _status: "published",
    publishedAt: new Date().toISOString(),
  })

  const termsOfUsePage = await createOrUpdatePage(payload, {
    title: termsOfUse.title,
    slug: termsOfUse.slug,
    hero: {
      type: "lowImpact",
      richText: null,
      links: [],
      media: null,
    },
    layout: [
      {
        blockType: "content",
        columns: [
          {
            size: "full",
            richText: createRichTextContent(termsOfUse.content),
            enableLink: false,
          },
        ],
      },
    ],
    meta: {
      title: termsOfUse.title,
      description: termsOfUse.description,
      image: null,
    },
    _status: "published",
    publishedAt: new Date().toISOString(),
  })

  const volumesPage = await createOrUpdatePage(payload, {
    title: volumes.title,
    slug: volumes.slug,
    hero: {
      type: "pageHero",
      richText: createHeroRichTextHeading(volumes.title),
      links: [],
      media: null,
    },
    layout: [
      {
        blockType: "volumeView",
        introContent: null,
        populateBy: "collection",
        relationTo: "volumes",
        limit: 6,
        selectedDocs: [],
      },
    ],
    meta: {
      title: volumes.title,
      description: volumes.description,
      image: null,
    },
    _status: "published",
    publishedAt: new Date().toISOString(),
  })

  return {
    aboutPage,
    articlesPage,
    contactPage,
    privacyPolicyPage,
    termsOfUsePage,
    volumesPage,
  }
}
