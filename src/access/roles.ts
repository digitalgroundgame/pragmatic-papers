import type { User } from "@/payload-types"

export type Role = NonNullable<User["role"]>

export const ROLE_HIERARCHY: Record<Role, number> = {
  member: 0,
  narrator: 1,
  writer: 2,
  editor: 3,
  "chief-editor": 4,
  admin: 4,
} as const

export const atLeast = (user: User | null | undefined, role: Role): boolean => {
  if (!user?.role) return false
  const userLevel = ROLE_HIERARCHY[user.role]
  const requiredLevel = ROLE_HIERARCHY[role]
  if (userLevel === undefined || requiredLevel === undefined) return false
  return userLevel >= requiredLevel
}

export const isStaff = (user: User | null | undefined): boolean => {
  if (!user?.role) return false
  return user.role !== "member"
}
