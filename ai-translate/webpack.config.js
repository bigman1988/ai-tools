const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const webpack = require('webpack');

module.exports = {
    entry: {
        main: './src/index.ts',
        knowledgeBase: './src/knowledge-base.ts'
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "buffer": require.resolve("buffer/"),
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "util": require.resolve("util/"),
            "process": require.resolve("process/browser"),
            "zlib": require.resolve("browserify-zlib"),
            "url": require.resolve("url/"),
            "vm": require.resolve("vm-browserify"),
            "timers": require.resolve("timers-browserify"),
            "assert": require.resolve("assert/"),
            "net": require.resolve("net-browserify"),
            "tls": require.resolve("tls-browserify"),
            "async_hooks": false,
            "fs": false,
            "path": false,
            "child_process": false
        },
        alias: {
            'xlsx': path.resolve(__dirname, 'node_modules/xlsx/dist/xlsx.full.min.js')
        }
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            filename: 'index.html',
            chunks: ['main']
        }),
        new HtmlWebpackPlugin({
            template: './src/knowledge-base.html',
            filename: 'knowledge-base.html',
            chunks: ['knowledgeBase']
        }),
        new Dotenv(),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        }),
        // 添加空的async_hooks模块
        new webpack.NormalModuleReplacementPlugin(
            /async_hooks/,
            require.resolve('./src/polyfills/async-hooks-polyfill.js')
        )
    ],
    optimization: {
        splitChunks: {
            chunks: 'all',
            name: 'vendor'
        }
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 8083,
        open: true
    }
};
