import type { DriveStep } from "driver.js"

export const TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='mega-menu']",
    popover: {
      title: "Explore Topics",
      description: "Browse articles by topic using the navigation bar.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='search']",
    popover: {
      title: "Search Articles",
      description: "Find any article quickly with full-text search.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "[data-tour='mode-toggle']",
    popover: {
      title: "Light / Dark Mode",
      description: "Switch between light and dark themes to suit your preference.",
      side: "top",
      align: "start",
    },
  },
]
