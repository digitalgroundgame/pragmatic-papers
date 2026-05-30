import { admin } from "@/access/admins"
import { type Webhook } from "@/payload-types"
import { type FieldHookArgs, type CollectionConfig } from "payload"
import { format, isAfter } from "date-fns"

export const Webhooks: CollectionConfig = {
  slug: "webhooks",
  access: {
    create: admin,
    delete: admin,
    read: admin,
    update: admin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: false,
    },
    {
      name: "url",
      type: "text",
      required: true,
    },
    {
      type: "text",
      name: "mostRecent",
      label: "Most Recent",
      hooks: {
        afterRead: [
          (ctx: FieldHookArgs<Webhook>): string => {
            const latest = ctx.data?.pushed
              ?.map((v) => {
                return { vol: v.volumeNumber, time: new Date(v.timePushed ?? 0) }
              })
              .reduce((prev, curr) => (isAfter(prev.time, curr.time) ? prev : curr))
            return latest ? `Vol. ${latest.vol} - ${format(latest.time, "PP pp")}` : "-"
          },
        ],
      },
      admin: {
        readOnly: true,
        description: "The most recent volume number that has been pushed to this webhook",
      },
    },
    {
      name: "pushed",
      type: "array",
      labels: {
        plural: "volumes",
        singular: "volume",
      },
      fields: [
        {
          name: "volumeNumber",
          type: "number",
          admin: {
            readOnly: true,
            hidden: true,
          },
        },
        {
          name: "timePushed",
          type: "date",
          admin: {
            readOnly: true,
            hidden: true,
          },
        },
      ],
      admin: {
        readOnly: true,
        hidden: true,
      },
    },
  ],
}
