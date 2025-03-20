import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import Dotenv from 'dotenv-webpack';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    entry: {
        main: './src/index.js',
        knowledgeBase: './src/knowledge-base.js'
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    resolve: {
        extensions: ['.js'],
        fallback: {
            "buffer": 'buffer/',
            "crypto": 'crypto-browserify',
            "stream": 'stream-browserify',
            "util": 'util/',
            "process": 'process/browser',
            "zlib": 'browserify-zlib',
            "url": 'url/',
            "vm": 'vm-browserify',
            "timers": 'timers-browserify',
            "assert": 'assert/',
            "net": 'net-browserify',
            "tls": 'tls-browserify',
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
            './src/polyfills/async-hooks-polyfill.js'
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
