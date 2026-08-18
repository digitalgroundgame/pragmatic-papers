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
      // Payload's auth already supplies an `email` field and merges this
      // declaration into it; we redeclare it only to attach field-level read
      // access. The auth form (login, first-user registration, the Auth panel
      // on a user doc) renders its own email input, and Payload normally keeps
      // the merged field from rendering a second one via a `Field: false`
      // component. That suppression is delivered through form state, which
      // skips any field whose `access.read` denies — so on the first-user
      // registration form (no user yet, so `selfOrAdminFieldLevel` is false)
      // the client fell back to the default email input and drew a second
      // "Email" box. `admin.hidden` suppresses it on the client instead, which
      // holds whether or not read access passes. List columns are unaffected.
      name: "email",
      type: "email",
      access: {
        read: selfOrAdminFieldLevel,
      },
      admin: {
        hidden: true,
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
