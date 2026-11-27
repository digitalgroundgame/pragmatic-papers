import type { Block } from "payload"

import { blockImages } from "@/blocks/blockImages"

/**
 * Every topic, each a tile with its article count, 50 to a page. For the Topics site page:
 * the list is the site's, the heading and introduction around it are the editors'.
 */
export const TopicsList: Block = {
  slug: "topicsList",
  dbName: "topics_list",
  interfaceName: "TopicsListBlock",
  labels: { singular: "Topics list", plural: "Topics lists" },
  admin: { images: blockImages("topicsList"), disableBlockName: true },
  fields: [
    {
      name: "emptyMessage",
      type: "text",
      defaultValue: "No topics found.",
      admin: { description: "Shown in place of the list while there are no topics." },
    },
  ],
}
