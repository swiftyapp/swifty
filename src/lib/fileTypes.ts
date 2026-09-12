/** File kinds that have a window-level drop owner. */

// What the OS recognizers can open, and what the image picker filters to.
export const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'heic',
  'heif',
  'webp',
  'tiff',
  'tif',
  'bmp',
  'gif'
]

export const isImagePath = (path: string): boolean => {
  const extension = /\.([^.\\/]+)$/.exec(path)?.[1]
  return !!extension && IMAGE_EXTENSIONS.includes(extension.toLowerCase())
}
