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
					vendor: ["react", "react-dom"],
					recharts: ["recharts"],
					ui: ["sortablejs"],
					firebase_auth: ["firebase/app", "firebase/auth"],
					firebase_db: [
						"firebase/firestore",
						"firebase/functions",
						"firebase/app-check",
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
