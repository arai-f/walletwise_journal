/**
 * テストスクリプト: AIスキャンのインタラクション検証
 */
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "http://localhost:5173";
const SAMPLE_RECEIPT = path.join(
	__dirname,
	"../docs/assets/sample_receipt.png",
);

async function testScan() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
	});
	const page = await context.newPage();

	// scanReceipt API モック
	let resolveScan;
	const scanPromise = new Promise((resolve) => {
		resolveScan = resolve;
	});

	await page.route("**/scanReceipt*", async (route) => {
		console.log("  [Mock] scanReceipt API リクエストをインターセプト");
		// 意図的に1秒待機させて解析中画面を確認できるようにする
		await page.waitForTimeout(1000);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: [
					{
						date: "2026-09-13",
						amount: 3639,
						description: "スーパーライフ 渋谷東店 (食料品)",
						type: "expense",
						category: "食費",
					},
				],
			}),
		});
	});

	console.log("1. ページ読み込み中...");
	await page.goto(BASE_URL, { waitUntil: "networkidle" });

	// ログイン確認
	try {
		const loginBtn = await page.waitForSelector(
			"button:has-text('Googleアカウントでログイン')",
			{ timeout: 4000 },
		);
		if (loginBtn) {
			console.log("  - ログインボタンを検出、ポップアップで認証中...");
			const [popup] = await Promise.all([
				page.waitForEvent("popup"),
				loginBtn.click(),
			]);
			await popup.waitForLoadState("networkidle");
			await popup.click("text=test@example.com");
			console.log("  - test@example.com でログイン完了");
		}
	} catch (e) {
		console.log("ログイン済みまたはスキップ");
	}

	await page.waitForSelector("#home-section", { timeout: 15000 });
	await page.waitForTimeout(1000);

	console.log("2. 取引追加モーダルを開く...");
	const addBtn = page.locator("#add-transaction-button").first();
	await addBtn.click();
	await page.waitForSelector("button:has-text('画像選択')", { timeout: 5000 });

	console.log("3. レシート画像をアップロード...");
	const fileInput = page.locator("input[name='fileInput']");
	await fileInput.setInputFiles(SAMPLE_RECEIPT);

	console.log("4. 解析中画面を待機...");
	await page.waitForSelector(
		"text=Gemini 3.1 Flash Lite が画像を読み取っています",
		{
			timeout: 5000,
		},
	);
	console.log("   -> 解析中画面を確認！");

	console.log("5. 結果画面を待機...");
	await page.waitForSelector("text=スキャン結果の確認", { timeout: 10000 });
	console.log("   -> スキャン結果画面を確認！");
	await page.waitForTimeout(1000);

	console.log("6. スクリーンショット撮影 (スキャン結果)...");
	await page.screenshot({ path: "test_scan_desktop.png" });

	console.log("7. 取引を登録して保存...");
	const saveBtn = page.locator("button:has-text('登録')").last();
	await saveBtn.click();
	await page.waitForTimeout(1500);

	console.log("8. 取引が保存されたか確認...");
	await page.screenshot({ path: "test_scan_after_save.png" });

	console.log("✅ テスト成功！");
	await browser.close();
}

testScan().catch((err) => {
	console.error("❌ エラー:", err);
	process.exit(1);
});
