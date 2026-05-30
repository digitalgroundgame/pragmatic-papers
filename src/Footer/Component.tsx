import { Logo } from "@/components/Logo"
import { Menu } from "@/components/Menu"
import { ModeToggle } from "@/components/ModeToggle"
import { SocialLinks } from "@/components/SocialLinks"
import type { Footer } from "@/payload-types"
import { getCachedGlobal } from "@/utilities/getGlobals"
import { Copyright } from "./Copyright"

export async function Footer(): Promise<React.ReactElement> {
  const { id, navItems, socials, copyright }: Footer = await getCachedGlobal("footer", 1)()

  return (
    <footer className="container mt-6 space-y-1 py-2">
      <div className="flex flex-col justify-between gap-2 border-t pt-2 md:flex-row md:items-center">
        <a href="/" className="flex-1">
          <Logo size="sm" />
        </a>
        <div className="flex flex-row items-center gap-2">
          <SocialLinks parentId={id} socials={socials} aria-label="Footer Social Links" />
          <ModeToggle />
        </div>
      </div>
      <div className="flex flex-col-reverse items-start gap-1 md:flex-row md:items-center md:justify-between md:gap-2">
        <Copyright copyright={copyright} />
        <Menu menu={navItems} />
      </div>
    </footer>
  )
}
