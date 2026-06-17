"use client"

import "driver.js/dist/driver.css"

import { driver } from "driver.js"
import React, { createContext, useCallback, useContext } from "react"

import { useNotification } from "@/providers/NotificationProvider"

import { TOUR_STEPS } from "./config"

interface TourContextValue {
  startTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const { markSeen } = useNotification("tour")

  const startTour = useCallback(() => {
    const d = driver({
      showProgress: true,
      steps: TOUR_STEPS,
      onDestroyed: markSeen,
    })
    d.drive()
  }, [markSeen])

  return <TourContext.Provider value={{ startTour }}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour must be used within TourProvider")
  return ctx
}
