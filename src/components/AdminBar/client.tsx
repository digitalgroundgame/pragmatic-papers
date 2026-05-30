"use client"

import { PaperIcon } from "@/components/Logo/icons/PaperIcon"
import { getClientSideURL } from "@/utilities/getURL"
import type { PayloadAdminBarProps } from "@payloadcms/admin-bar"
import { PayloadAdminBar } from "@payloadcms/admin-bar"
import { useRouter } from "next/navigation"

export const AdminBarClient: React.FC<PayloadAdminBarProps> = (props) => {
  const router = useRouter()

  function onPreviewExit() {
    fetch("/next/exit-preview").then(() => {
      router.push("/")
      router.refresh()
    })
  }

  return (
    <PayloadAdminBar
      {...props}
      unstyled
      className="container flex gap-1.5 px-6 py-2 text-xs"
      classNames={{
        logo: "hover:text-brand",
        user: "hidden md:inline underline-offset-2 hover:underline",
        controls: "flex ml-auto gap-1.5",
        create: "hidden md:inline underline-offset-2 hover:underline",
        edit: "hidden md:inline underline-offset-2 hover:underline",
        preview: "underline-offset-2 hover:underline",
        logout: "underline-offset-2 hover:underline",
      }}
      cmsURL={getClientSideURL()}
      logo={<PaperIcon className="size-4" />}
      onPreviewExit={onPreviewExit}
    />
  )
}
