import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import Dotenv from 'dotenv-webpack';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取环境变量
const mode = process.env.NODE_ENV || 'development';
console.log(`当前构建模式: ${mode}`);

export default {
    entry: {
        main: './src/index.js',
        knowledgeBase: './src/knowledge-base.js'
    },
    mode, 
    devtool: 'source-map', 
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
            "os": false, 
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
        new Dotenv({
            systemvars: true // 允许系统环境变量覆盖.env文件中的变量
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        }),
        new webpack.NormalModuleReplacementPlugin(
            /async_hooks/,
            './src/polyfills/async-hooks-polyfill.js'
        ),
        new webpack.NormalModuleReplacementPlugin(
            /^os$/,
            './src/polyfills/noop.js'
        )
    ],
    optimization: {
        splitChunks: {
            chunks: 'all',
            name: 'vendor'
        }
    },
    devServer: {
        static: './dist',
        port: 8084,
        open: true,
        hot: true 
    }
};
