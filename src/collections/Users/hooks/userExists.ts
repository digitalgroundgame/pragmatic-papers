import type { User } from "@/payload-types"
import type { Condition } from "payload"

export const userExists: Condition<User> = ({ id }) => Boolean(id)
