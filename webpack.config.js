const path = require('path');

module.exports = {
    entry: './src/index.ts',
    target: 'web',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "events": require.resolve("events"),
        }
    },
    output: {
        filename: 'index.browser.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'AsyncSocket',
            type: 'umd',
            export: 'default',
        },
        globalObject: 'this',
    },
    externals: {
    },
};
