import type { PayloadRequest } from "payload"

// Anyone User who's role is not "member" can access this collection
export const staff = ({ req: { user } }: { req: PayloadRequest }): boolean => {
  if (!user) return false
  if (!user.role) return false
  return user.role !== "member"
}
