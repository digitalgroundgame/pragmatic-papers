"use client"

import "driver.js/dist/driver.css"

import { driver } from "driver.js"
import React, { createContext, useCallback, useContext, useEffect } from "react"

import { useNotification } from "@/providers/NotificationProvider"

import { TOUR_STEPS } from "./config"

interface TourContextValue {
  startTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const { visible: shouldShow, markSeen } = useNotification("tour")

  const startTour = useCallback(() => {
    const d = driver({
      showProgress: true,
      steps: TOUR_STEPS,
      onDestroyed: markSeen,
    })
    d.drive()
  }, [markSeen])

  useEffect(() => {
    if (!shouldShow) return
    const timer = setTimeout(startTour, 600)
    return () => clearTimeout(timer)
  }, [shouldShow, startTour])

  return <TourContext.Provider value={{ startTour }}>{children}</TourContext.Provider>
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour must be used within TourProvider")
  return ctx
}
