import config from "@payload-config"
import { getPayload, type Payload } from "payload"

export async function getPayloadConfig(): Promise<Payload> {
  return await getPayload({ config })
}
