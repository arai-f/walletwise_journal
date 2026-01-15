const fs = require("fs");
const path = require("path");

// package.json から新しいバージョンを取得
// npm version コマンド実行中、このスクリプトが呼ばれる時点で package.json は更新済み
const packageJsonPath = path.resolve(__dirname, "../package.json");
const packageJson = require(packageJsonPath);
const newVersion = packageJson.version;
const configPath = path.resolve(__dirname, "../public/src/config.js");

try {
	let configContent = fs.readFileSync(configPath, "utf8");

	// appVersion: "x.x.x" の部分を正規表現で置換
	const regex = /(appVersion:\s*")([^"]*)(")/;
	if (regex.test(configContent)) {
		configContent = configContent.replace(regex, `$1${newVersion}$3`);
		fs.writeFileSync(configPath, configContent, "utf8");
		console.log(`Updated public/src/config.js appVersion to ${newVersion}`);
	} else {
		console.warn("Warning: appVersion not found in public/src/config.js");
		process.exit(1);
	}
} catch (error) {
	console.error("Error updating config.js:", error);
	process.exit(1);
}
