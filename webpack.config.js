const path = require('path');
const package = require('./package.json');

const baseConfig = {
  entry: {
    [`featbit-js-client-sdk-${package.version}`]: './src/index.ts',
    [`featbit-js-client-sdk`]: './src/index.ts'
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.ts$/,
        loader: 'string-replace-loader',
        options: {
          search: '__VERSION__',
          replace: package.version,
          flags: 'g'
        }
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'umd'),
    filename: `[name].js`,
    libraryTarget: 'umd',
    //library: 'FFCJsClient',
    umdNamedDefine: true,
    // prevent error: `Uncaught ReferenceError: self is not define`
    globalObject: 'this',
  },
  optimization: {
    minimize: true
  },
};

const config = {
  ...baseConfig, output: {
    path: path.resolve(__dirname, 'dist', 'umd'),
    filename: `[name].js`,
    libraryTarget: 'umd',
    umdNamedDefine: true,
    // prevent error: `Uncaught ReferenceError: self is not define`
    globalObject: 'this',
  }
};

const configDemo = {
  ...baseConfig, output: {
    path: path.resolve(__dirname, 'examples', 'web-app', 'umd'),
    filename: `[name].js`,
    libraryTarget: 'umd',
    umdNamedDefine: true,
    // prevent error: `Uncaught ReferenceError: self is not define`
    globalObject: 'this',
  }
};

module.exports = [
  config,
  configDemo
];