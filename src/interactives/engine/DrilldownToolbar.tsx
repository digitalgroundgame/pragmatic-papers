"use client"

import { MapIcon, Maximize2, Minimize2, PanelLeft, PanelRight, ZoomIn, ZoomOut } from "lucide-react"
import React from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

import type { RegionInfo } from "./types"

export interface DrilldownToolbarProps {
  railOpen: boolean
  railId: string
  onToggleRail(): void
  trail: RegionInfo[]
  onTrailRoot(): void
  onTrailItem(id: string): void
  zoom: number
  zoomMax: number
  onZoomOut(): void
  onZoomIn(): void
  onZoomReset(): void
  paneOpen: boolean
  paneId: string
  onTogglePane(): void
  full: boolean
  onToggleFull(): void
}

/**
 * One bar across the top of the map: where the reader is on the left, what they can do to it
 * on the right. A row rather than two absolutely placed corners, so a long trail truncates
 * against the controls instead of running under them.
 */
export function DrilldownToolbar({
  railOpen,
  railId,
  onToggleRail,
  trail,
  onTrailRoot,
  onTrailItem,
  zoom,
  zoomMax,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  paneOpen,
  paneId,
  onTogglePane,
  full,
  onToggleFull,
}: DrilldownToolbarProps): React.ReactElement {
  return (
    <div className="absolute inset-x-2 top-1 z-10 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        data-drilldown-rail-toggle=""
        aria-expanded={railOpen}
        aria-controls={railId}
        aria-label={railOpen ? "Hide the region list" : "Show the region list"}
        onClick={onToggleRail}
        className="shrink-0"
      >
        <PanelLeft aria-hidden="true" />
      </Button>
      {trail.length > 0 && (
        <>
          <Separator orientation="vertical" className="mr-2" />
          <Breadcrumb
            data-drilldown-trail=""
            aria-label="Where you are on the map"
            className="min-w-0"
          >
            <BreadcrumbList className="flex-nowrap gap-1 sm:gap-1.5">
              <BreadcrumbItem>
                <BreadcrumbLink
                  render={
                    <button
                      type="button"
                      data-drilldown-trail-root=""
                      aria-label="Back to the whole map"
                      onClick={onTrailRoot}
                      className="flex items-center"
                    />
                  }
                >
                  <MapIcon aria-hidden="true" className="size-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              {trail.map((region, i) => (
                <React.Fragment key={region.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    {i === trail.length - 1 ? (
                      <BreadcrumbPage className="truncate" title={region.label}>
                        {region.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        title={region.label}
                        render={
                          <button
                            type="button"
                            data-drilldown-trail-item={region.id}
                            onClick={() => onTrailItem(region.id)}
                            className="max-w-40 truncate"
                          />
                        }
                      >
                        {region.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      )}
      {/* The camera, then the panels: two different things, so a rule between them — and both
          kept out of the trail's way by the row rather than by a guess at how much room the
          trail has left. */}
      <div data-drilldown-zoom="" className="ml-auto flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          title="Zoom out (−)"
          onClick={onZoomOut}
          disabled={zoom <= 1}
        >
          <ZoomOut aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          title="Zoom in (+)"
          onClick={onZoomIn}
          disabled={zoom >= zoomMax}
        >
          <ZoomIn aria-hidden="true" />
        </Button>
        {/* Written out rather than drawn: every "fit" glyph in the set is a variation on the
            corner brackets that mean full screen, and the button beside it is the one that
            means full screen. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          data-drilldown-zoom-reset=""
          aria-label="Fit the whole map"
          title="Fit the whole map (0)"
          onClick={onZoomReset}
          disabled={zoom <= 1}
        >
          <span aria-hidden="true" className="text-[0.7rem] font-semibold">
            1×
          </span>
        </Button>
      </div>
      <Separator orientation="vertical" className="mx-1 shrink-0" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        data-drilldown-pane-toggle-map=""
        aria-expanded={paneOpen}
        aria-controls={paneId}
        aria-label={paneOpen ? "Hide the details" : "Show the details"}
        onClick={onTogglePane}
        className="shrink-0"
      >
        <PanelRight aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        data-drilldown-fullscreen=""
        aria-pressed={full}
        aria-label={full ? "Leave full screen" : "Full screen"}
        title={full ? "Leave full screen (F)" : "Full screen (F)"}
        onClick={onToggleFull}
        className="shrink-0"
      >
        {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      </Button>
    </div>
  )
}
