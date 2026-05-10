import type { Media, User } from "@/payload-types"
import type { Payload, RequiredDataFromCollection } from "payload"
import { createRichTextFromString } from "./richtext"

export interface SeededUsers {
  admin: User
  chiefEditor: User
  editor: User
  writer1: User
  writer2: User
  narrator: User
}

type UserData = RequiredDataFromCollection<User> &
  Omit<Partial<User>, keyof RequiredDataFromCollection<User>>

export async function createUser(payload: Payload, data: UserData, label: string): Promise<User> {
  try {
    return await payload.create({ collection: "users", data })
  } catch (err) {
    payload.logger.warn(
      `Failed to create ${label} with full data, retrying with minimal fields. Error: ${err instanceof Error ? err.message : String(err)}`,
    )
    const { email, password, name, role, slug } = data
    return await payload.create({
      collection: "users",
      data: { email, password, name, role, slug },
    })
  }
}

export const createUsers = async (payload: Payload, media: Media[]): Promise<SeededUsers> => {
  const admin = await createUser(
    payload,
    {
      email: "admin@example.com",
      password: "password123",
      name: "John Admin",
      role: "admin",
      slug: "superadmin",
      profileImage: media[0]?.id,
    },
    "admin",
  )

  const chiefEditor = await createUser(
    payload,
    {
      email: "chiefeditor@example.com",
      password: "password123",
      name: "Jane Chief",
      role: "chief-editor",
      slug: "chiefjane",
      profileImage: media[1]?.id,
    },
    "chiefEditor",
  )

  const editor = await createUser(
    payload,
    {
      email: "editor@example.com",
      password: "password123",
      name: "Stacy The Editor",
      role: "editor",
      slug: "stacytheeditor",
      profileImage: media[2]?.id,
    },
    "editor",
  )

  const writer1 = await createUser(
    payload,
    {
      email: "writer1@example.com",
      password: "password123",
      name: "Teagan Wordsmith",
      slug: "teagan-wordsmith",
      role: "writer",
      affiliation: "Senior Research Fellow, Pragmatic Papers Institute",
      biography: createRichTextFromString(
        "A prolific writer specializing in academic research and scientific papers.",
      ),
      profileImage: media[3]?.id,
      socials: [
        {
          link: {
            type: "custom",
            url: "https://twitter.com/writer_one",
            label: "Twitter",
            newTab: true,
          },
        },
        {
          link: {
            type: "custom",
            url: "https://github.com/writer-one",
            label: "GitHub",
            newTab: true,
          },
        },
        {
          link: {
            type: "custom",
            url: "https://scholar.google.com",
            label: "Google Scholar",
            newTab: true,
          },
        },
      ],
    },
    "writer1",
  )

  const writer2 = await createUser(
    payload,
    {
      email: "writer2@example.com",
      password: "password123",
      name: "Sienna Scribe",
      slug: "sienna-scribe",
      role: "writer",
      affiliation: "Associate Editor, Department of Theoretical Studies",
      biography: createRichTextFromString(
        "An experienced researcher with focus on theoretical physics and mathematics.",
      ),
      profileImage: media[0]?.id,
      socials: [
        {
          link: {
            type: "custom",
            url: "https://twitter.com/writer_two",
            label: "Twitter",
            newTab: true,
          },
        },
        {
          link: {
            type: "custom",
            url: "https://github.com/writer-two",
            label: "GitHub",
            newTab: true,
          },
        },
        {
          link: {
            type: "custom",
            url: "https://orcid.org",
            label: "ORCID",
            newTab: true,
          },
        },
      ],
    },
    "writer2",
  )

  const narrator = await createUser(
    payload,
    {
      email: "narrator@example.com",
      password: "password123",
      name: "Alex Narrator",
      slug: "alex-narrator",
      role: "narrator",
      affiliation: "Voice Artist",
      biography: createRichTextFromString(
        "A professional voice artist specializing in academic and educational content narration.",
      ),
      profileImage: media[2]?.id,
    },
    "narrator",
  )

  return { admin, chiefEditor, editor, writer1, writer2, narrator }
}
