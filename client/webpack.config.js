const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

let package = require('./package.json');

function modify(buffer) {
   // copy-webpack-plugin passes a buffer
   var manifest = JSON.parse(buffer.toString());

   // make any modifications you like, such as
   manifest.version = package.version;

   // pretty print to JSON with two spaces
   manifest_JSON = JSON.stringify(manifest, null, 2);
   return manifest_JSON;
}

module.exports = {
	plugins: [
		new HtmlWebpackPlugin({
			hash: true,
			title: 'The Last Outpost',
			header: 'The Last Outpost',
			metaDesc: 'Last Outpost Client Implementation',
			template: './src/index.html',
			filename: 'index.html',
			inject: 'head'
		}),
		new CopyWebpackPlugin([
		{
			from: "./src/manifest.json",
			to:   "./manifest.json",
			transform (content, path) {
				return modify(content)
			}
		}])
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
				test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
				type: 'asset/resource',
				generator: {
					filename: './img/[name][ext]',
				}
			},
			{
				test: /\.(ogg|mp3)$/i,
				type: 'asset/resource',
				generator: {
					filename: './snd/[name][ext]',
				}
			},
			{
				test: /\.(ttf)$/i,
				type: 'asset/resource',
				generator: {
					filename: './fonts/[name][ext]',
				}
			}
		],
	},
};
