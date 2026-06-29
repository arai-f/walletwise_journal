import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	root: "public",
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		chunkSizeWarningLimit: 600,
		rolldownOptions: {
			input: {
				main: resolve(__dirname, "public/index.html"),
			},
			output: {
				codeSplitting: {
					groups: [
						{
							name: "recharts",
							test: /[\\/]node_modules[\\/]recharts/,
						},
						{
							name: "ui",
							test: /[\\/]node_modules[\\/]sortablejs/,
						},
						{
							name: "firebase_auth",
							test: /[\\/]node_modules[\\/]@?firebase[\\/](app|auth)/,
						},
						{
							name: "firebase_db",
							test: /[\\/]node_modules[\\/]@?firebase[\\/](firestore|functions|app-check)/,
						},
					],
				},
			},
		},
	},
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", { target: "19" }]],
			},
		}),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": resolve(__dirname, "public"),
		},
	},
	server: {
		host: "127.0.0.1",
	},
});
