import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	root: "public",
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		rollupOptions: {
			output: {
				manualChunks: {
					firebase: [
						"firebase/app",
						"firebase/auth",
						"firebase/firestore",
						"firebase/functions",
						"firebase/app-check",
						"firebase/vertexai",
					],
				},
			},
		},
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "public"),
		},
	},
	server: {
		host: "127.0.0.1",
	},
});
