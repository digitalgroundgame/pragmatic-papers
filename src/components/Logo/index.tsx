import { LogomarkIcon } from "@/components/Logo/icons/LogomarkIcon"
import { cn } from "@/utilities/utils"
import { type VariantProps, cva } from "class-variance-authority"
import React from "react"

const logoVariants = cva("w-auto text-foreground", {
  variants: {
    size: {
      default: "h-6 sm:h-7 md:h-8 lg:h-8.5",
      sm: "h-5 sm:h-6 md:h-7 lg:h-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

export interface LogoProps
  extends React.SVGProps<SVGSVGElement>, VariantProps<typeof logoVariants> {
  love?: boolean
}

export const Logo: React.FC<LogoProps> = ({ className, size, ...props }) => {
  return (
    <>
      <LogomarkIcon className={cn(logoVariants({ size, className }))} {...props} />
      <span className="sr-only">Pragmatic Papers Logo</span>
    </>
  )
}
