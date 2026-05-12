import type { Media, User } from "@/payload-types"
import type { Payload, RequiredDataFromCollection } from "payload"
import { createRichTextFromString } from "./richtext"

export interface SeededUsers {
  admin: User
  chiefEditor: User
  editor: User
  writers: User[]
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

const WRITER_DATA = [
  {
    first: "Teagan",
    last: "Wordsmith",
    affiliation: "Senior Research Fellow, Pragmatic Papers Institute",
    field: "academic research and scientific papers",
    socials: ["Twitter", "GitHub", "Google Scholar"],
  },
  {
    first: "Sienna",
    last: "Scribe",
    affiliation: "Associate Editor, Department of Theoretical Studies",
    field: "theoretical physics and mathematics",
    socials: ["Twitter", "GitHub", "ORCID"],
  },
  {
    first: "Alexandra",
    last: "Chen",
    affiliation: "Professor of Cognitive Science, Stanford University",
    field: "cognitive psychology",
    socials: ["Twitter", "Google Scholar"],
  },
  {
    first: "Marcus",
    last: "Thompson",
    affiliation: "Senior Fellow, Brookings Institution",
    field: "international relations",
    socials: ["Twitter"],
  },
  {
    first: "Priya",
    last: "Patel",
    affiliation: "Research Director, MIT Media Lab",
    field: "technology, society, and human behavior",
    socials: ["GitHub", "LinkedIn"],
  },
  {
    first: "Erik",
    last: "Johansson",
    affiliation: "Professor of Philosophy, University of Oxford",
    field: "ethics, metaethics, and political philosophy",
    socials: ["ORCID"],
  },
  {
    first: "Maria",
    last: "Gonzalez",
    affiliation: "Neuroscientist, Max Planck Institute",
    field: "neural mechanisms of learning and memory",
    socials: ["Twitter", "Google Scholar"],
  },
  {
    first: "David",
    last: "Kim",
    affiliation: "Assistant Professor, Seoul National University",
    field: "behavioral economics and game theory",
    socials: ["GitHub"],
  },
  {
    first: "Fatima",
    last: "Al-Rashid",
    affiliation: "Senior Researcher, Qatar Foundation",
    field: "Middle Eastern politics and energy policy",
    socials: ["LinkedIn"],
  },
  {
    first: "James",
    last: "O'Brien",
    affiliation: "Professor of History, Harvard University",
    field: "20th century political movements and revolutions",
    socials: ["Twitter", "ORCID"],
  },
  {
    first: "Yuki",
    last: "Tanaka",
    affiliation: "Research Scientist, Tokyo Institute of Technology",
    field: "artificial intelligence and machine learning ethics",
    socials: ["GitHub", "Google Scholar"],
  },
  {
    first: "Sophie",
    last: "Martin",
    affiliation: "Professor of Sociology, Sorbonne University",
    field: "digital communities and online social movements",
    socials: ["Twitter"],
  },
  {
    first: "Lars",
    last: "Andersen",
    affiliation: "Climate Scientist, University of Copenhagen",
    field: "climate change impacts and mitigation strategies",
    socials: ["Google Scholar"],
  },
  {
    first: "Amara",
    last: "Okafor",
    affiliation: "Public Health Researcher, WHO",
    field: "global health systems and policy",
    socials: ["LinkedIn", "ORCID"],
  },
  {
    first: "Nikolai",
    last: "Petrov",
    affiliation: "Professor of Physics, Moscow State University",
    field: "quantum field theory and particle physics",
    socials: ["GitHub"],
  },
  {
    first: "Isabella",
    last: "Santos",
    affiliation: "Environmental Economist, University of São Paulo",
    field: "conservation and sustainable development",
    socials: ["Twitter", "Google Scholar"],
  },
  {
    first: "Raj",
    last: "Krishnan",
    affiliation: "Data Scientist, Google Research",
    field: "natural language processing and large language models",
    socials: ["GitHub", "LinkedIn"],
  },
  {
    first: "Clara",
    last: "van Dijk",
    affiliation: "Professor of Law, University of Amsterdam",
    field: "international law and human rights",
    socials: ["ORCID"],
  },
  {
    first: "Michael",
    last: "Osei",
    affiliation: "Development Economist, World Bank",
    field: "economic growth and poverty reduction in Africa",
    socials: ["Twitter"],
  },
  {
    first: "Sunita",
    last: "Verma",
    affiliation: "Biotech Researcher, Indian Institute of Science",
    field: "CRISPR and gene editing technologies",
    socials: ["GitHub", "Google Scholar"],
  },
  {
    first: "Henrik",
    last: "Bergström",
    affiliation: "Professor of Education, Uppsala University",
    field: "pedagogy and educational technology",
    socials: ["LinkedIn"],
  },
  {
    first: "Zara",
    last: "Kowalska",
    affiliation: "Cultural Anthropologist, University of Warsaw",
    field: "digital anthropology and social media culture",
    socials: ["Twitter", "ORCID"],
  },
]

const SOCIAL_URLS: Record<string, string> = {
  Twitter: "https://twitter.com",
  GitHub: "https://github.com",
  "Google Scholar": "https://scholar.google.com",
  ORCID: "https://orcid.org",
  LinkedIn: "https://linkedin.com/in",
}

function generateWriterData(index: number, media: Media[]): UserData {
  const data = WRITER_DATA[index]!
  const slug = `${data.first.toLowerCase()}-${data.last.toLowerCase()}`
    .replace(/'/g, "")
    .replace(/[^a-z0-9-]/g, "-")
  const biography = `Expert in ${data.field}, affiliated with ${data.affiliation}.`

  const socials = data.socials.map((platform) => ({
    link: {
      type: "custom" as const,
      url: `${SOCIAL_URLS[platform]}/${slug.replace(/-/g, "")}`,
      label: platform,
      newTab: true as const,
    },
  }))

  return {
    email: `writer${index + 1}@example.com`,
    password: "password123",
    name: `${data.first} ${data.last}`,
    role: "writer",
    slug,
    affiliation: data.affiliation,
    biography: createRichTextFromString(biography),
    profileImage: media[index % 4]?.id,
    socials,
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

  const writers: User[] = []
  for (let i = 0; i < WRITER_DATA.length; i++) {
    const writerData = generateWriterData(i, media)
    const writer = await createUser(payload, writerData, `writer${i + 1}`)
    writers.push(writer)
  }

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

  return {
    admin,
    chiefEditor,
    editor,
    writers,
    narrator,
  }
}
