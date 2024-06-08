import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'node:path';

export default {
  mode: 'production',
  target: 'web',
  entry: {
    index: './src/index.js',
    codicon: './src/codicon.ttf',
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      scriptLoading: 'module',
    }),
  ],

  output: {
    filename: '[name].bundle.js',
    assetModuleFilename: '[name][ext]',
    path: path.resolve(import.meta.dirname, '..', 'docs', 'playground'),
    clean: true,
    library: {
      type: 'module',
    },
  },

  experiments: {
    outputModule: true,
  },

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
};
