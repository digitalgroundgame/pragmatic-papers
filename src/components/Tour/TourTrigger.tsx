"use client"

import React from "react"

import { Button } from "@/components/ui/button"

import { useTour } from "./TourProvider"

export function TourTrigger(): React.ReactNode {
  const { startTour } = useTour()
  return (
    <Button variant="ghost" size="sm" onClick={startTour}>
      Site tour
    </Button>
  )
}
