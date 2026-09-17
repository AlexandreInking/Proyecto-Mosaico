export interface TilesetSliceInput {
  readonly imageWidth: number
  readonly imageHeight: number
  readonly tileWidth: number
  readonly tileHeight: number
  readonly marginX: number
  readonly marginY: number
  readonly spacingX: number
  readonly spacingY: number
  readonly offsetX: number
  readonly offsetY: number
}

export interface TileSourceRectangle {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface TilesetSliceResult {
  readonly columns: number
  readonly rows: number
  readonly rectangles: readonly TileSourceRectangle[]
}

export function sliceTileset(input: TilesetSliceInput): TilesetSliceResult {
  const values = [input.imageWidth, input.imageHeight, input.tileWidth, input.tileHeight, input.marginX, input.marginY, input.spacingX, input.spacingY, input.offsetX, input.offsetY]
  if (values.some((value) => !Number.isInteger(value)) || input.imageWidth < 1 || input.imageHeight < 1
    || input.tileWidth < 1 || input.tileHeight < 1
    || input.marginX < 0 || input.marginY < 0 || input.spacingX < 0 || input.spacingY < 0
    || input.offsetX < 0 || input.offsetY < 0) throw new RangeError('TILESET_SLICE_INVALID')
  const originX = input.marginX + input.offsetX
  const originY = input.marginY + input.offsetY
  const columns = Math.floor((input.imageWidth - originX - input.marginX + input.spacingX) / (input.tileWidth + input.spacingX))
  const rows = Math.floor((input.imageHeight - originY - input.marginY + input.spacingY) / (input.tileHeight + input.spacingY))
  if (columns < 1 || rows < 1) throw new RangeError('TILESET_SLICE_EMPTY')
  if (columns * rows > 1_000_000) throw new RangeError('TILESET_SLICE_LIMIT')
  const rectangles: TileSourceRectangle[] = []
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    rectangles.push({
      x: originX + column * (input.tileWidth + input.spacingX),
      y: originY + row * (input.tileHeight + input.spacingY),
      width: input.tileWidth,
      height: input.tileHeight,
    })
  }
  return { columns, rows, rectangles }
}
