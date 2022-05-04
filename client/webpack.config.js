const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
	plugins: [
		new HtmlWebpackPlugin({
			hash: true,
			title: 'The Last Outpost',
			header: 'The Last Outpost',
			metaDesc: 'Last Outpost Client Implementation',
			template: './src/index.html',
			filename: 'index.html',
			inject: 'body'
		})
	],
	mode: 'development',
	output: {
		clean: true
	},
	devServer: {
		port: 5001,
		open: true
	},
	module: {
		rules: [
			{
				test: /\.css$/i,
				use: ['style-loader','css-loader'],
			},
			{
				test: /\.(png|svg|jpg|jpeg|gif)$/i,
				type: 'asset/resource',
			},
			{
				test: /\.(ttf)$/i,
				type: 'asset/resource',
				generator: {
					filename: './fonts/[name][ext]',
				}
			},
		],
	},
};
