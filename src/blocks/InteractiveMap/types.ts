export interface RegionDatum {
  regionId: string
  label?: string | null
  value?: number | null
  color?: string | null
}

export interface ResolvedRegion {
  regionId: string
  label: string
  formattedValue: string | null
  color: string
}

export interface ResolvedPath {
  d: string
  regionId: string | null
  extraAttrs: Record<string, string>
}

export interface ResolvedMap {
  title: string | null
  viewBox: string
  transform: string | null
  paths: ResolvedPath[]
  regions: ResolvedRegion[]
}
