import type { Topic } from "@/payload-types"
import type { Payload } from "payload"

export interface SeedTopicConfig {
  name: string
  description?: string
}

const defaultTopics: SeedTopicConfig[] = [
  {
    name: "Politics",
    description: "literally a statement of fact but ok.",
  },
  {
    name: "Memes",
    description:
      "Research and commentary on internet culture, virality, and digital communication.",
  },
  {
    name: "Cognitive Science",
    description: "Cross-disciplinary work on mind, behavior, and the science of thought.",
  },
  {
    name: "Philosophy",
    description: "Foundational questions about existence, knowledge, and ethics.",
  },
  {
    name: "Ethics",
    description: "Moral philosophy and the study of right conduct.",
  },
  {
    name: "Epistemology",
    description: "The nature of knowledge, belief, and justified true belief.",
  },
  {
    name: "Neuroscience",
    description: "The science of the brain and nervous system.",
  },
  {
    name: "Digital Culture",
    description: "How technology shapes society, identity, and communication.",
  },
  {
    name: "Social Media",
    description: "Platforms, influence, and the economics of attention.",
  },
  {
    name: "Identity",
    description: "Personal identity, self, and continuity across time and change.",
  },
  {
    name: "Humor",
    description: "The philosophy and psychology of humor, irony, and comedy.",
  },
]

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const createTopics = async (
  payload: Payload,
  topicsToCreate: SeedTopicConfig[] = defaultTopics,
): Promise<Topic[]> => {
  const topics: Topic[] = []

  for (const topic of topicsToCreate) {
    const createdTopic = await payload.create({
      collection: "topics",
      draft: false,
      data: {
        name: topic.name,
        description: topic.description,
        slug: toSlug(topic.name),
      },
    })
    topics.push(createdTopic)
  }

  return topics
}
