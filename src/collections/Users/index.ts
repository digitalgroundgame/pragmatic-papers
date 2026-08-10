import { isSelfOrAdmin, readUsers } from "@/access/policies"
import { admin, staff } from "@/access/collections"
import { adminFieldLevel, selfOrAdminFieldLevel } from "@/access/fields"
import { revalidateUser } from "@/collections/Users/hooks/revalidateUser"
import { menu } from "@/fields/menu"
import {
  FixedToolbarFeature,
  HeadingFeature,
  IndentFeature,
  InlineToolbarFeature,
  lexicalEditor,
  OrderedListFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical"
import { slugField, type CollectionConfig } from "payload"
import { userExists } from "./hooks/userExists"

export const Users: CollectionConfig = {
  slug: "users",
  access: {
    admin: staff,
    create: admin,
    delete: admin,
    read: readUsers,
    update: isSelfOrAdmin,
  },
  admin: {
    defaultColumns: ["name", "roles", "email"],
    useAsTitle: "name",
  },
  auth: true,
  fields: [
    {
      name: "email",
      type: "email",
      access: {
        read: selfOrAdminFieldLevel,
      },
    },
    {
      name: "name",
      type: "text",
    },
    {
      name: "affiliation",
      type: "text",
      required: false,
      admin: {
        condition: userExists,
      },
    },
    {
      name: "biography",
      type: "richText",
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ["h2", "h3", "h4"] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
            OrderedListFeature(),
            UnorderedListFeature(),
            IndentFeature(),
          ]
        },
      }),
      required: false,
      admin: {
        condition: userExists,
      },
    },
    slugField({
      useAsSlug: "name",
      overrides: (field) => {
        field.admin = {
          condition: userExists,
          position: "sidebar",
        }
        return field
      },
    }),
    {
      name: "profileImage",
      type: "upload",
      relationTo: "media",
      required: false,
      admin: {
        condition: userExists,
        position: "sidebar",
      },
    },
    menu({
      name: "socials",
      label: "Socials",
      maxRows: 6,
      admin: {
        condition: userExists,
        position: "sidebar",
      },
    }),
    {
      name: "roles",
      type: "select",
      hasMany: true,
      saveToJWT: true,
      defaultValue: ["member"],
      access: {
        read: selfOrAdminFieldLevel,
        update: adminFieldLevel,
      },
      admin: {
        position: "sidebar",
        description:
          "Use “Author” for inactive writers. It grants no permissions — it only keeps a past contributor’s byline and profile page visible. When someone stops writing, remove “Writer” and leave “Author” rather than dropping them to “Member”, which would strip their name from articles they have already published.",
      },
      options: [
        {
          label: "Admin",
          value: "admin",
        },
        {
          label: "Chief Editor",
          value: "chief-editor",
        },
        {
          label: "Editor",
          value: "editor",
        },
        {
          label: "Writer",
          value: "writer",
        },
        {
          label: "Narrator",
          value: "narrator",
        },
        {
          label: "Author (inactive writer)",
          value: "author",
        },
        {
          label: "Member",
          value: "member",
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateUser],
  },
  timestamps: true,
}
