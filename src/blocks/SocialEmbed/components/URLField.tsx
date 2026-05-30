"use client"
import "@/blocks/SocialEmbed/components/URLField.scss"
import { detectPlatform } from "@/blocks/SocialEmbed/helpers/detectPlatform"
import { useDebounce } from "@/utilities/useDebounce"
import { TextField, useField } from "@payloadcms/ui"
import { CheckCircle2, XCircle } from "lucide-react"
import type { TextFieldClientComponent } from "payload"

/**
 * A custom TextField component for validating social media URLs.
 *
 * This field provides real-time social link validation and feedback for admins.
 * Visual feedback is provided with a check or error icon beside the input.
 */
export const URLField: TextFieldClientComponent = ({ path, ...props }) => {
  const { value } = useField<string>({ path })
  const debouncedValue = useDebounce(value || "", 500)

  const isValid: boolean | null =
    !debouncedValue || debouncedValue.trim() === "" ? null : detectPlatform(debouncedValue) !== null

  return (
    <div className="url-field-wrapper">
      <TextField path={path} {...props} />
      {isValid !== null && (
        <div className="url-field-icon">
          {isValid ? (
            <CheckCircle2 size={18} style={{ color: "#22c55e" }} aria-label="Valid URL" />
          ) : (
            <XCircle size={18} style={{ color: "#ef4444" }} aria-label="Invalid URL" />
          )}
        </div>
      )}
    </div>
  )
}
