"use client"

import { Compass } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"

import { useTour } from "./TourProvider"

export function TourTrigger(): React.ReactNode {
  const { startTour } = useTour()
  return (
    <Button variant="ghost" size="icon" onClick={startTour}>
      <Compass className="size-6" />
      <span className="sr-only">Site tour</span>
    </Button>
  )
}
