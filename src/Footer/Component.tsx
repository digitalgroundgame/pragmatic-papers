import { RenderBlocks } from "@/blocks/RenderBlocks"
import { Logo } from "@/components/Logo"
import { Menu } from "@/components/Menu"
import { SocialLinks } from "@/components/SocialLinks"
import type { Footer } from "@/payload-types"
import { getCachedGlobal } from "@/utilities/getGlobals"
import { Copyright } from "./Copyright"
import { ModeToggle } from "@/components/ModeToggle"

export async function Footer(): Promise<React.ReactElement> {
  const { id, navItems, socials, copyright, layout }: Footer = await getCachedGlobal("footer", 2)()

  return (
    <footer className="container space-y-2 py-2">
      {layout && (
        <div className="border-t pt-6">
          <RenderBlocks blocks={layout} />
        </div>
      )}
      <div className="flex flex-col justify-between gap-2 border-t pt-4 md:flex-row md:items-center">
        <a href="/" className="flex-1">
          <Logo size="sm" />
        </a>
        <div className="flex flex-row items-center gap-2">
          <SocialLinks parentId={id} socials={socials} aria-label="Footer Social Links" />
          <ModeToggle location="footer" />
        </div>
      </div>
      <div className="flex flex-col-reverse items-start gap-1 md:flex-row md:items-center md:justify-between md:gap-2">
        <Copyright copyright={copyright} />
        <Menu menu={navItems} />
      </div>
    </footer>
  )
}
