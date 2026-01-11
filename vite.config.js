import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	root: "public",
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "public/index.html"),
				guide: resolve(__dirname, "public/guide.html"),
				terms: resolve(__dirname, "public/terms.html"),
			},
			output: {
				manualChunks: {
					firebase: [
						"firebase/app",
						"firebase/auth",
						"firebase/firestore",
						"firebase/functions",
						"firebase/app-check",
						"firebase/ai",
					],
				},
			},
		},
	},
	plugins: [tailwindcss()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "public"),
		},
	},
	server: {
		host: "127.0.0.1",
	},
});
