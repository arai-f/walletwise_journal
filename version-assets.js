const fs = require("fs");
const path = require("path");

// package.jsonからバージョン番号を取得
const packageJson = require("./package.json");
const version = packageJson.version;

console.log(`
Appending version ${version} to asset links...`);

const indexPath = path.join(__dirname, "public", "index.html");
let indexHtml = fs.readFileSync(indexPath, "utf8");

// publicフォルダ内にある、ローカルのCSSとJSファイルにバージョンを付与
indexHtml = indexHtml.replace(
	/(href|src)="(?!https?:\/\/)([^"]+\.(css|js))"/g,
	`$1="$2?v=${version}"`
);

fs.writeFileSync(indexPath, indexHtml);

console.log("Successfully versioned asset links in index.html");
