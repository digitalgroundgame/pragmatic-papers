import type { Access, AccessArgs, FieldAccess } from "payload"
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

export const anyone: Access = () => true

type isAuthenticated = (args: AccessArgs<User>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}

export const admin: Access = ({ req: { user } }) => {
  return atLeast(user, "admin")
}

export const adminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return atLeast(user, "admin")
}

export const editor: Access = ({ req: { user } }) => {
  return atLeast(user, "editor")
}

export const editorFieldLevel: FieldAccess = ({ req: { user } }) => {
  return atLeast(user, "editor")
}

export const writer: Access = ({ req: { user } }) => {
  return atLeast(user, "writer")
}

export const writerFieldLevel: FieldAccess = ({ req: { user } }) => {
  return atLeast(user, "writer")
}

export const staff = ({ req: { user } }: AccessArgs<User>): boolean => {
  return isStaff(user)
}
