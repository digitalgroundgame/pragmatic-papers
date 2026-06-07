interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

const NAMED_RATIOS = {
  square: 1,
  photo: 4 / 3,
  classic: 3 / 2,
  video: 16 / 9,
  vertical: 9 / 16,
} as const

type NamedRatio = keyof typeof NAMED_RATIOS

export class Screenshot {
  private box: BoundingBox | null

  constructor(box: BoundingBox | null) {
    this.box = box
  }

  padding(amount: number): Screenshot {
    if (!this.box) return this
    return new Screenshot({
      x: Math.max(0, this.box.x - amount),
      y: Math.max(0, this.box.y - amount),
      width: this.box.width + amount * 2,
      height: this.box.height + amount * 2,
    })
  }

  aspectRatio(ratio: number | NamedRatio): Screenshot {
    if (!this.box) return this
    const resolved = typeof ratio === "string" ? NAMED_RATIOS[ratio] : ratio
    const { x, y, width, height } = this.box
    const current = width / height
    if (current > resolved) {
      const newHeight = width / resolved
      const delta = (newHeight - height) / 2
      return new Screenshot({ x, y: Math.max(0, y - delta), width, height: newHeight })
    } else {
      const newWidth = height * resolved
      const delta = (newWidth - width) / 2
      return new Screenshot({ x: Math.max(0, x - delta), y, width: newWidth, height })
    }
  }

  get clip(): BoundingBox | undefined {
    return this.box ?? undefined
  }
}
