module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          electron: '6.0.4',
          node: 'current'
        }
      }
    ]
  ]
}
