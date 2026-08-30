import { screen } from 'electron'

const defineDimention = (options, dimention) => {
  const display = screen.getPrimaryDisplay()
  if (options[dimention] > display.workAreaSize[dimention]) {
    return display.workAreaSize[dimention]
  }
  return options[dimention]
}

export const getOptimalDimentions = options => {
  return {
    width: defineDimention(options, 'width'),
    height: defineDimention(options, 'height')
  }
}

export const getNewBounds = (bounds, options) => {
  const dimentions = getOptimalDimentions(options)
  const calcX = Math.round(bounds.x - (dimentions.width - bounds.width) / 2)
  const calcY = Math.round(bounds.y - (dimentions.height - bounds.height) / 2)
  const x = calcX > 0 ? calcX : 0
  const y = calcY > 0 ? calcY : 0
  return { x, y, width: dimentions.width, height: dimentions.height }
}

export const checkInternet = cb => {
  require('dns').lookup('google.com', function (err) {
    if (err) {
      cb(false)
    } else {
      cb(true)
    }
  })
}
