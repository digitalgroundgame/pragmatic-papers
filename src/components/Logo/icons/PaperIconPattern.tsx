import { cn } from "@/utilities/utils"
import React from "react"

export const PaperIconPattern: React.FC<React.ComponentProps<"svg"> & { id: string }> = ({
  id,
  fill = "currentColor",
  className,
  style,
}) => {
  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none", className)}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={id}
          width="64"
          height="64"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-15)"
        >
          <path
            d="M3.16,1.7H0s0,16.61,0,16.61h3.2v-6.48c2.42,0,4.34-1.56,4.34-4.88v-.36c0-3.32-1.94-4.88-4.38-4.88ZM4.28,8.26c0,1.06-.36,1.46-.88,1.46h-.2V3.78h.2c.52,0,.88.4.88,1.46v3.02ZM9.03,1.7h10.97v16.61h-10.97V1.7Z"
            transform="scale(2)"
            fill={fill}
          />
          <animateTransform
            attributeName="patternTransform"
            type="translate"
            from="0 0"
            to="64 -64"
            dur="6s"
            repeatCount="indefinite"
            additive="sum"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
