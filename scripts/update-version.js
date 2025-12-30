const fs = require("fs");
const path = require("path");

// package.json から新しいバージョンを取得
const packageJsonPath = path.resolve(__dirname, "../package.json");
const packageJson = require(packageJsonPath);
const newVersion = packageJson.version;

// config.js のパス
const configPath = path.resolve(__dirname, "../public/js/config.js");

try {
	let configContent = fs.readFileSync(configPath, "utf8");

	// appVersion: "x.x.x" の部分を正規表現で置換
	const regex = /(appVersion:\s*")([^"]*)(")/;
	if (regex.test(configContent)) {
		configContent = configContent.replace(regex, `$1${newVersion}$3`);
		fs.writeFileSync(configPath, configContent, "utf8");
		console.log(`Updated public/js/config.js appVersion to ${newVersion}`);
	} else {
		console.warn("Warning: appVersion not found in public/js/config.js");
	}
} catch (error) {
	console.error("Error updating config.js:", error);
	process.exit(1);
}
