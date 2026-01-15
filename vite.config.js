import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "public"),
		},
	},
	server: {
		host: "127.0.0.1",
	},
});
