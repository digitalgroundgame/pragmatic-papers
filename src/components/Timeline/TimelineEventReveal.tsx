"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/utilities/utils"

interface Props {
  children: React.ReactNode
  className?: string
}

export const TimelineEventReveal: React.FC<Props> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          io.unobserve(el)
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-250",
        visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-95 opacity-0",
        className,
      )}
      style={{
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {children}
    </div>
  )
}
