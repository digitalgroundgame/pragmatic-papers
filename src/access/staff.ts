import { type PayloadRequest } from "payload"
import { isStaff } from "./roles"

export const staff = ({ req: { user } }: { req: PayloadRequest }): boolean => {
  return isStaff(user)
}
