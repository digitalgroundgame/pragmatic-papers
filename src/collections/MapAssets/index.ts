import path from "path"
import { fileURLToPath } from "url"

import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from "payload"

import { anyone } from "@/access/anyone"
import { editorOrSelf } from "@/access/editorOrSelf"
import { writer } from "@/access/writer"
import type { MapAsset } from "@/payload-types"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const populateCreatedBy: CollectionBeforeChangeHook<MapAsset> = ({ data, operation, req }) => {
  if (operation === "create" && req.user) {
    data.createdBy = req.user.id
  }
  return data
}

const captureSvgContent: CollectionBeforeValidateHook<MapAsset> = ({ data, req }) => {
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
    create: writer,
    delete: editorOrSelf,
    read: anyone,
    update: editorOrSelf,
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
      admin: {
        description:
          "Auto-populated with the uploaded SVG's text content so blocks can read it without a runtime file fetch.",
        readOnly: true,
        hidden: true,
      },
    },
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
