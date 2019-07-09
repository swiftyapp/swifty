var path = require('path')

module.exports = {
  renderer: {
    target: "electron-renderer",
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            query: {
               presets: ["@babel/react", "@babel/preset-env"]
            }
          }
        },
        {
          test: /\.sass$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "style-loader"
            },
            {
              loader: "css-loader"
            },
            {
              loader: "sass-loader"
            }
          ]
        },
        {
          test: /\.svg$/,
          use: [
            {
              loader: "babel-loader"
            },
            {
              loader: "react-svg-loader"
            }
          ]
        }
      ],
    },
    resolve: {
      modules: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, './src/javascripts/renderer'),
        path.resolve(__dirname, './src/stylesheets'),
        path.resolve(__dirname, './src/images')
      ]
    }
  },
  main: {}
}
