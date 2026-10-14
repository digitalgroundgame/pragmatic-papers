import { isExperimentEnabled } from "@/globals/SiteSettings/isExperimentEnabled"

/**
 * The `<html>` attribute that squares off every corner on the public site while
 * the squareCorners experiment is on (globals.css reads it).
 */
export const cornerAttributes = async (): Promise<{ "data-corners"?: "square" }> =>
  (await isExperimentEnabled("squareCorners")) ? { "data-corners": "square" } : {}
