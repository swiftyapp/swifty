var path = require('path')
var Dotenv = require('dotenv-webpack')

const envFile = () => {
  const NODE_ENV = process.env.NODE_ENV
  if (!NODE_ENV) {
    return path.resolve(__dirname, '.env')
  } else {
    return path.resolve(__dirname, `.env.${NODE_ENV}`)
  }
}

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
            options: {
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
  preload: {
    resolve: {
      modules: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, 'src', 'main')
      ]
    }
  },
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
        path: envFile()
      })
    ],
    resolve: {
      modules: [
        path.resolve(__dirname, 'src', 'main'),
        path.resolve(__dirname, 'resources'),
        path.resolve(__dirname, 'node_modules')
      ]
    }
  }
}
