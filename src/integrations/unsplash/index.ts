import { env, type Integration } from "../types"

/**
 * A photo as this site uses it: what the picker shows, what attribution needs, and where to
 * fetch the file. Trimmed from Unsplash's photo object (unsplash.com/documentation#get-a-photo).
 */
export interface UnsplashPhoto {
  id: string
  width: number
  height: number
  /** Average colour, shown while the thumbnail loads. */
  color: string | null
  alt: string | null
  /** A small rendition for the picker, hotlinked as Unsplash's guidelines require. */
  thumbUrl: string
  /** The original, resizable through imgix parameters. Only ever on images.unsplash.com. */
  rawUrl: string
  /** The photo's page on unsplash.com, with this app's referral parameters. */
  pageUrl: string
  /** The URL that counts a download; hit it when the photo is used (`trackDownload`). */
  downloadLocation: string
  photographer: {
    name: string
    username: string
    /** Their profile on unsplash.com, with this app's referral parameters. */
    profileUrl: string
  }
}

export interface UnsplashSearchPage {
  total: number
  totalPages: number
  results: UnsplashPhoto[]
}

export type UnsplashOrientation = "landscape" | "portrait" | "squarish"

export interface UnsplashSearch {
  query: string
  page?: number
  perPage?: number
  orientation?: UnsplashOrientation
}

interface FetchOpts {
  fetchImpl?: typeof fetch
}

export interface UnsplashIntegration extends Integration {
  /** Unsplash's own home page with this app's referral parameters, for "on Unsplash". */
  homeUrl(): string
  search(search: UnsplashSearch, opts?: FetchOpts): Promise<UnsplashSearchPage>
  photo(id: string, opts?: FetchOpts): Promise<UnsplashPhoto>
  /**
   * Tell Unsplash the photo was used. Their API guidelines require it whenever a photo is
   * downloaded into something a person made, which is what saving it as media is.
   */
  trackDownload(photo: UnsplashPhoto, opts?: FetchOpts): Promise<void>
  /** The photo's file, resized to at most `width` pixels wide, as a JPEG. */
  image(photo: UnsplashPhoto, width: number, opts?: FetchOpts): Promise<Response>
}

export interface UnsplashAppOptions {
  id: string
  label: string
  /** Environment variable holding the application's Access Key (sent as `Client-ID`). */
  keyEnv: string
  /**
   * Environment variable naming the application as Unsplash knows it, for the `utm_source`
   * on every link back to Unsplash. Falls back to `defaultAppName`.
   */
  appNameEnv: string
  defaultAppName: string
}

const API = "https://api.unsplash.com"
const IMAGE_HOST = "images.unsplash.com"

/** The parts of Unsplash's photo object this site reads. */
interface RawPhoto {
  id: string
  width: number
  height: number
  color?: string | null
  alt_description?: string | null
  description?: string | null
  urls: { raw: string; small: string }
  links: { html: string; download_location: string }
  user: { name: string; username: string; links: { html: string } }
}

function isOn(url: string, hostname: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && parsed.hostname === hostname
  } catch {
    return false
  }
}

/**
 * A connection to one Unsplash application, for finding photos and bringing them into Media.
 * The key is the application's public Access Key; the Secret Key is only for OAuth, which a
 * search-and-download app never needs.
 */
export function unsplashApp({
  id,
  label,
  keyEnv,
  appNameEnv,
  defaultAppName,
}: UnsplashAppOptions): UnsplashIntegration {
  const appName = (): string => env(appNameEnv) ?? defaultAppName

  const referral = (url: string): string => {
    const u = new URL(url)
    u.searchParams.set("utm_source", appName())
    u.searchParams.set("utm_medium", "referral")
    return u.toString()
  }

  const toPhoto = (raw: RawPhoto): UnsplashPhoto => ({
    id: raw.id,
    width: raw.width,
    height: raw.height,
    color: raw.color ?? null,
    alt: raw.alt_description || raw.description || null,
    thumbUrl: raw.urls.small,
    rawUrl: raw.urls.raw,
    pageUrl: referral(raw.links.html),
    downloadLocation: raw.links.download_location,
    photographer: {
      name: raw.user.name,
      username: raw.user.username,
      profileUrl: referral(raw.user.links.html),
    },
  })

  const call = async (url: string, fetchImpl: typeof fetch): Promise<unknown> => {
    const key = env(keyEnv)
    if (!key) throw new Error(`Unsplash needs ${keyEnv}`)
    if (!isOn(url, "api.unsplash.com")) throw new Error("Not an Unsplash API URL")

    const response = await fetchImpl(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    })
    if (!response.ok) {
      let reasons: string[] = []
      try {
        reasons = ((await response.json()) as { errors?: string[] }).errors ?? []
      } catch {
        // Not JSON; the status says enough.
      }
      throw new Error(
        `Unsplash request failed (HTTP ${response.status})${reasons.length ? `: ${reasons.join("; ")}` : ""}`,
      )
    }
    return response.json()
  }

  return {
    id,
    label,
    service: "Unsplash",
    describe: () => `unsplash:app/${appName()}`,
    required: [keyEnv],
    optional: [appNameEnv],
    homeUrl: () => referral("https://unsplash.com/"),

    async search({ query, page = 1, perPage = 24, orientation }, { fetchImpl = fetch } = {}) {
      const url = new URL(`${API}/search/photos`)
      url.searchParams.set("query", query)
      url.searchParams.set("page", String(page))
      url.searchParams.set("per_page", String(perPage))
      url.searchParams.set("content_filter", "high")
      if (orientation) url.searchParams.set("orientation", orientation)

      const body = (await call(url.toString(), fetchImpl)) as {
        total: number
        total_pages: number
        results: RawPhoto[]
      }
      return {
        total: body.total,
        totalPages: body.total_pages,
        results: body.results.map(toPhoto),
      }
    },

    async photo(photoId, { fetchImpl = fetch } = {}) {
      const body = (await call(
        `${API}/photos/${encodeURIComponent(photoId)}`,
        fetchImpl,
      )) as RawPhoto
      return toPhoto(body)
    },

    async trackDownload(photo, { fetchImpl = fetch } = {}) {
      await call(photo.downloadLocation, fetchImpl)
    },

    async image(photo, width, { fetchImpl = fetch } = {}) {
      if (!isOn(photo.rawUrl, IMAGE_HOST)) throw new Error("Not an Unsplash image URL")
      const url = new URL(photo.rawUrl)
      url.searchParams.set("w", String(Math.min(width, photo.width)))
      url.searchParams.set("fm", "jpg")
      url.searchParams.set("q", "85")
      url.searchParams.set("fit", "max")
      const response = await fetchImpl(url.toString())
      if (!response.ok) throw new Error(`Unsplash image failed (HTTP ${response.status})`)
      return response
    },
  }
}
