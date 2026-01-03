import fs from "fs";
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
						"firebase/vertexai",
					],
				},
			},
		},
	},
	plugins: [
		{
			name: "generate-version-file",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					const url = new URL(req.url, `http://${req.headers.host}`);
					if (url.pathname === "/version.json") {
						try {
							const configPath = resolve(__dirname, "public/js/config.js");
							const content = fs.readFileSync(configPath, "utf-8");
							const match = content.match(/appVersion:\s*["']([^"']+)["']/);
							const version = match ? match[1] : String(Date.now());
							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify({ version }));
							return;
						} catch (e) {
							console.error("[Vite] Failed to serve version.json", e);
						}
					}
					next();
				});
			},
			closeBundle() {
				try {
					const configPath = resolve(__dirname, "public/js/config.js");
					const content = fs.readFileSync(configPath, "utf-8");
					const match = content.match(/appVersion:\s*["']([^"']+)["']/);
					const version = match ? match[1] : Date.now();

					// distディレクトリが存在しない場合は作成する（安全策）
					const distDir = resolve(__dirname, "dist");
					if (!fs.existsSync(distDir))
						fs.mkdirSync(distDir, { recursive: true });

					const outputPath = resolve(__dirname, "dist/version.json");
					fs.writeFileSync(outputPath, JSON.stringify({ version }));
					console.log(`[Vite] Generated version.json: ${version}`);
				} catch (e) {
					console.error("[Vite] Failed to generate version.json", e);
				}
			},
		},
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
