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

export interface ResolvedMap {
  title: string | null
  svg: string
  regionAttribute: string
  regions: ResolvedRegion[]
}
