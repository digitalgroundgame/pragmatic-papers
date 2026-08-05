import path from "path"
import { fileURLToPath } from "url"

import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"

import { anyone, writerOrEditor } from "@/access/collections"
import { isCreatedByOrEditor } from "@/access/policies"
import { link } from "@/fields/link2"
import type { MapAsset } from "@/payload-types"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const populateCreatedBy: CollectionBeforeChangeHook<MapAsset> = ({
  data,
  operation,
  req,
}) => {
  if (operation === "create" && req.user) {
    data.createdBy = req.user.id
  }
  return data
}

export const captureSvgContent: CollectionBeforeValidateHook<MapAsset> = ({ data, req }) => {
  const file = req.file
  if (file && file.mimetype === "image/svg+xml") {
    const text =
      file.data && typeof file.data === "object" && "toString" in file.data
        ? file.data.toString("utf8")
        : ""
    if (data) data.svgContent = text
  }
  return data
}

export const MapAssets: CollectionConfig = {
  slug: "map-assets",
  labels: {
    singular: "Map Asset",
    plural: "Map Assets",
  },
  access: {
    create: writerOrEditor,
    delete: isCreatedByOrEditor,
    read: anyone,
    update: isCreatedByOrEditor,
  },
  admin: {
    defaultColumns: ["filename", "label", "mimeType", "updatedAt"],
    useAsTitle: "label",
    description:
      "Raw vector geometry for the Interactive Map block — SVG today, GeoJSON/TopoJSON later. Files are stored without image processing so vector data round-trips intact.",
  },
  fields: [
    {
      name: "label",
      type: "text",
      admin: {
        description:
          "Human-readable name shown in the admin (e.g. 'Missouri Congressional Districts — 119th Congress').",
      },
    },
    {
      name: "svgContent",
      type: "textarea",
      maxLength: 500000,
      admin: {
        description:
          "Auto-populated with the uploaded SVG's text content so blocks can read it without a runtime file fetch.",
        readOnly: true,
        hidden: true,
      },
    },
    link({
      name: "source",
      label: "Source",
      admin: {
        description: "Attribution link for the map data (e.g. Census Bureau, OpenStates).",
      },
      component: {
        type: { defaultValue: "custom" },
        reference: { required: false },
        url: { required: false },
        variant: { admin: { hidden: true } },
      },
    }),
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      access: {
        update: () => false,
      },
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
    // The s3Storage plugin only injects this field when storage is enabled, which never
    // happens locally (USE_LOCAL_STORAGE=true). Declaring it here keeps the column in the
    // schema in every environment so push and generated migrations stay in sync with prod.
    {
      name: "prefix",
      type: "text",
      defaultValue: "map-assets",
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
  hooks: {
    beforeValidate: [captureSvgContent],
    beforeChange: [populateCreatedBy],
  },
  upload: {
    staticDir: path.resolve(dirname, "../../../public/map-assets"),
    mimeTypes: ["image/svg+xml"],
    disableLocalStorage: process.env.USE_LOCAL_STORAGE !== "true",
  },
}
