import { isOEmbed, type OEmbedResponse } from "@/blocks/SocialEmbed/helpers/oEmbed"
import type { SocialEmbedSnapshot } from "@/payload-types"
import { failure, type Result, success } from "@/utilities/results"

const DEFAULT_TIMEOUT_MS = 15_000

export type OEmbedRequestErrorCode = Exclude<NonNullable<SocialEmbedSnapshot["status"]>, "ok">

export class OEmbedRequestError extends Error {
  status?: number
  code: OEmbedRequestErrorCode

  constructor(message: string, options?: { status?: number; code: OEmbedRequestErrorCode }) {
    super(message)
    this.name = "OEmbedRequestError"
    this.status = options?.status
    this.code = options?.code ?? "error"
  }
}

/**
 * Fetches oEmbed data from a given URL endpoint.
 * This is a protected method available to all adapter implementations.
 * @param url - The oEmbed endpoint URL
 * @param init - Optional fetch init options
 * @returns A Result containing the oEmbed response or an error
 */
export async function fetchOEmbed<T extends OEmbedResponse = OEmbedResponse>(
  url: URL,
  init?: RequestInit,
): Promise<Result<T, OEmbedRequestError>> {
  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal

  try {
    const res = await fetch(url, { ...init, signal })

    if (!res.ok) {
      throw new OEmbedRequestError(`Failed to fetch oEmbed: ${res.statusText}`, {
        status: res.status,
        code: "forbidden",
      })
    }

    const raw = await res.json()
    if (!isOEmbed(raw)) {
      throw new OEmbedRequestError("Provider returned an invalid oEmbed response.", {
        code: "invalid_oembed_response",
      })
    }

    return success(raw as T)
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return failure(
        new OEmbedRequestError("Timed out while fetching oEmbed.", { code: "timeout" }),
      )
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return failure(new OEmbedRequestError("oEmbed request was aborted.", { code: "aborted" }))
    }
    return failure(
      error instanceof OEmbedRequestError
        ? error
        : new OEmbedRequestError(String(error), { code: "error" }),
    )
  }
}
