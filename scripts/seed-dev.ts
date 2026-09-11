import "dotenv/config"
import { seed } from "@/endpoints/seed"
import config from "@payload-config"
import { getPayload } from "payload"

export async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seeding is not allowed in production")
  }

  const payload = await getPayload({ config })

  try {
    await seed(payload, (message, step, total) => {
      console.warn(`[${step}/${total}] ${message}`)
    })
    console.warn("✔ Dev seed complete")
  } finally {
    await payload.db.destroy?.()
  }
}

if (!process.env.VITEST) {
  try {
    await main()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
