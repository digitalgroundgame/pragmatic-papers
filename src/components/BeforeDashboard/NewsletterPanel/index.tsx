import { loadNewsletterOverview } from "./load"
import { NewsletterStats } from "./NewsletterStats"

/** The dashboard's Newsletter panel, read from Listmonk on each visit. */
export async function NewsletterPanel(): Promise<React.ReactNode> {
  return <NewsletterStats overview={await loadNewsletterOverview()} />
}
