var path = require('path')
var Dotenv = require('dotenv-webpack')

module.exports = {
  renderer: {
    target: 'electron-renderer',
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            query: {
              presets: ['@babel/react', '@babel/preset-env']
            }
          }
        },
        {
          test: /\.sass$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'style-loader'
            },
            {
              loader: 'css-loader'
            },
            {
              loader: 'sass-loader'
            }
          ]
        },
        {
          test: /\.svg$/,
          use: [
            {
              loader: 'babel-loader'
            },
            {
              loader: 'react-svg-loader'
            }
          ]
        },
        {
          test: /\.(png|jpe?g|gif)$/,
          use: [
            {
              loader: 'file-loader',
              options: {}
            }
          ]
        }
      ]
    },
    resolve: {
      modules: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, './src/renderer/javascripts'),
        path.resolve(__dirname, './src/renderer/stylesheets'),
        path.resolve(__dirname, './src/renderer/images')
      ]
    }
  },
  preload: {},
  main: {
    target: 'electron-main',
    module: {
      rules: [
        {
          test: /\.(png|jpe?g|gif)$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]'
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new Dotenv({
        path: path.resolve(__dirname, '.env')
      })
    ],
    resolve: {
      modules: [
        path.resolve(__dirname, 'resources'),
        path.resolve(__dirname, 'node_modules')
      ]
    }
  }
}
