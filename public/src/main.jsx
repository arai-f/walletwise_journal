import "@fortawesome/fontawesome-free/css/all.min.css";
import "../src/input.css";

import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import * as utils from "./utils.js";

// 初期表示をフェードインさせる
setTimeout(() => {
	if (document.body) {
		document.body.style.visibility = "visible";
		document.body.style.opacity = "1";
	}
}, 100);

const appContainer = utils.dom.get("root") || document.getElementById("root");

if (appContainer) {
	const appRoot = createRoot(appContainer);
	appRoot.render(<App />);
} else {
	console.error("Root element #root not found");
}
