import type { User } from "@/payload-types"

export const isAdmin = (user: User): boolean => {
  return user.role === "admin" || user.role === "chief-editor"
}

export const isEditor = (user: User): boolean => {
  return user.role === "editor" || isAdmin(user)
}

export const isWriter = (user: User): boolean => {
  return user.role === "writer" || isEditor(user)
}
