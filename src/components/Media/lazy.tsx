"use client"
import dynamic from "next/dynamic"

// Every image goes through `Media`, so a static import would put the audio and video players
// (and the Base UI slider and popover the audio player is built from) on every page.
export const AudioMedia = dynamic(() => import("./AudioMedia").then((m) => m.AudioMedia))
export const VideoMedia = dynamic(() => import("./VideoMedia").then((m) => m.VideoMedia))
