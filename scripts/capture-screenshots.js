/**
 * WalletWise Journal - スクリーンショット自動キャプチャスクリプト
 *
 * Playwright を使用して、iOSスマホ版 (iPhone 15/16 Pro) と PC版 (1440x900) の
 * 主要画面を高解像度 (Retina 2x) で自動撮影し、docs/screenshots/ に保存します。
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const OUTPUT_DIR = path.join(__dirname, "../docs/screenshots");

const MOBILE_DIR = path.join(OUTPUT_DIR, "mobile");
const DESKTOP_DIR = path.join(OUTPUT_DIR, "desktop");
const SAMPLE_RECEIPT = path.join(
	__dirname,
	"../docs/assets/sample_receipt.png",
);

// モックAIアドバイザーの返答データ（構造化分析ポイント対応）
const MOCK_ADVISOR_RESPONSE = {
	result: {
		adviceText:
			"直近の家計簿データを分析しました！📊\n\n今月の食費は **¥42,800** で、全体の支出の約24%を占めています。先月（¥48,500）と比較して **約12%（-¥5,700）の節約** ができており、とても良好な推移です。\n\n💡 **改善ポイント**:\nスーパーでのまとめ買い（オーケー、ライフ）が中心で自炊が定着しています。カフェ・コンビニでの細かな出費（計¥6,480）を少し意識すると、さらに月5,000円前後の余力が生まれます！",
		alertLevel: "safe",
		analysisPoints: [
			{
				type: "positive",
				title: "食費の節約トレンド",
				content:
					"今月の食費は¥42,800。前月比 -12%（-¥5,700）の改善で順調です。",
			},
			{
				type: "positive",
				title: "自炊まとめ買いの定着",
				content:
					"週末のスーパーまとめ買いにより、平日の外食出費が抑制されています。",
			},
			{
				type: "warning",
				title: "カフェ・軽食の細かな支出",
				content:
					"コンビニやカフェの出費（計¥6,480）にさらなる節約余地があります。",
			},
		],
		suggestedAction:
			"平日のカフェ利用を週2回に絞ることで、月約3,000円の節約が可能です。",
	},
};

async function ensureDirs() {
	if (!fs.existsSync(MOBILE_DIR)) fs.mkdirSync(MOBILE_DIR, { recursive: true });
	if (!fs.existsSync(DESKTOP_DIR))
		fs.mkdirSync(DESKTOP_DIR, { recursive: true });
}

/**
 * Firebase Auth Emulator でのログインを実行
 */
async function authenticate(page) {
	console.log("  - アプリケーションへアクセス中...");
	await page.goto(BASE_URL, { waitUntil: "networkidle" });

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
		// 既にログイン済みの場合はスキップ
	}

	await page.waitForSelector("#home-section", { timeout: 15000 });
	await page.waitForTimeout(1500);
}

/**
 * AIアドバイザー API のモック設定
 */
async function setupApiMocks(page) {
	await page.route("**/askAdvisor*", async (route) => {
		console.log("  [Mock] askAdvisor API リクエストをインターセプト");
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ data: MOCK_ADVISOR_RESPONSE.result }),
		});
	});

	await page.route("**/scanReceipt*", async (route) => {
		console.log("  [Mock] scanReceipt API リクエストをインターセプト");
		await page.waitForTimeout(1200);
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
}

/**
 * モバイル（iOS）版スクリーンショットの撮影
 */
async function captureMobile(browser) {
	console.log("\n📱 [Mobile] iOS版スクリーンショット撮影開始 (393x852 @2x)...");

	const context = await browser.newContext({
		viewport: { width: 393, height: 852 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
		userAgent:
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	});

	const page = await context.newPage();
	await setupApiMocks(page);
	await authenticate(page);

	// 1. ダッシュボード (ホーム / コックピット)
	console.log("  -> 01_dashboard.png");
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(600);
	await page.screenshot({
		path: path.join(MOBILE_DIR, "01_dashboard.png"),
	});

	// 2. 口座推移チャート展開
	console.log("  -> 02_dashboard_chart.png");
	const mufgCard = page.locator("text=三菱UFJ銀行").first();
	if (await mufgCard.isVisible()) {
		await mufgCard.click();
		await page.waitForTimeout(400);
	}
	const toggleChartBtn = page
		.locator("button:has-text('推移チャートを表示')")
		.first();
	if (await toggleChartBtn.isVisible()) {
		await toggleChartBtn.click();
		await page.waitForTimeout(1500);
	}
	await page.screenshot({
		path: path.join(MOBILE_DIR, "02_dashboard_chart.png"),
	});

	// 3. 次回のカード支払い予定
	console.log("  -> 03_billing_list.png");
	const billingSection = page.locator("#billing-section");
	if (await billingSection.isVisible()) {
		await billingSection.evaluate((el) =>
			el.scrollIntoView({ block: "start" }),
		);
		await page.waitForTimeout(600);
		await page.screenshot({
			path: path.join(MOBILE_DIR, "03_billing_list.png"),
		});
	}

	// 4. 取引履歴一覧
	console.log("  -> 04_transactions.png");
	const txSection = page.locator("#transactions-section").first();
	if (await txSection.isVisible()) {
		await txSection.evaluate((el) => el.scrollIntoView({ block: "start" }));
		await page.waitForTimeout(600);
		await page.screenshot({
			path: path.join(MOBILE_DIR, "04_transactions.png"),
		});
	}

	// 5. 分析レポート (前月の完結データを表示)
	console.log("  -> 05_analysis_report.png");
	const analysisSection = page.locator("#analysis-section");
	if (await analysisSection.isVisible()) {
		await analysisSection.evaluate((el) =>
			el.scrollIntoView({ block: "start" }),
		);
		const monthSelect = page.locator("#analysis-month-select");
		if (await monthSelect.isVisible()) {
			const options = await monthSelect.locator("option").all();
			if (options.length > 1) {
				const prevMonthVal = await options[1].getAttribute("value");
				if (prevMonthVal) {
					await monthSelect.selectOption(prevMonthVal);
					await page.waitForTimeout(1000);
				}
			}
		}
		await page.waitForTimeout(1500);
		await page.screenshot({
			path: path.join(MOBILE_DIR, "05_analysis_report.png"),
		});

		// 5b. 年次推移
		console.log("  -> 05b_analysis_annual.png");
		const annualBtn = page.locator("button:has-text('年次')").first();
		if (await annualBtn.isVisible()) {
			await annualBtn.click();
			await page.waitForTimeout(1200);
			await page.screenshot({
				path: path.join(MOBILE_DIR, "05b_analysis_annual.png"),
			});
		}
	}

	// 6. AIアドバイザー (チャット展開)
	console.log("  -> 06_ai_advisor.png");
	await page.evaluate(() => window.scrollTo(0, 0));
	const advisorCard = page.locator("#ai-advisor-card-container");
	await advisorCard.evaluate((el) => el.scrollIntoView({ block: "start" }));
	await advisorCard.click();
	await page.waitForTimeout(600);

	const foodSuggestion = page.locator("button:has-text('食費の内訳')").first();
	if (await foodSuggestion.isVisible()) {
		await foodSuggestion.click();
		await page.waitForTimeout(1500);
	}
	await page.evaluate(() => {
		const el = document.getElementById("ai-advisor-card-container");
		if (el) {
			el.scrollIntoView({ behavior: "instant", block: "start" });
			const chatLog = el.querySelector(".overflow-y-auto");
			if (chatLog) chatLog.scrollTop = 0;
		}
	});
	await page.waitForTimeout(400);
	await page.screenshot({
		path: path.join(MOBILE_DIR, "06_ai_advisor.png"),
	});

	// 7. 取引入力モーダル
	console.log("  -> 07_transaction_modal.png");
	await page.evaluate(() => window.scrollTo(0, 0));
	const navAddBtn = page
		.locator("nav button:has-text('登録')")
		.or(page.locator("button[aria-label='取引を追加']"))
		.first();
	if (await navAddBtn.isVisible()) {
		await navAddBtn.click();
		await page.waitForSelector("#transaction-amount", { timeout: 4000 });
		await page.waitForTimeout(600);
		await page.screenshot({
			path: path.join(MOBILE_DIR, "07_transaction_modal.png"),
		});

		// 8. レシートスキャン (AI解析中 & 結果確認)
		if (fs.existsSync(SAMPLE_RECEIPT)) {
			console.log("  -> 08_scan_analyzing.png");
			const fileInput = page.locator("input[name='fileInput']");
			await fileInput.setInputFiles(SAMPLE_RECEIPT);
			await page.waitForSelector(
				"text=Gemini 3.1 Flash Lite が画像を読み取っています",
				{ timeout: 4000 },
			);
			await page.waitForTimeout(300);
			await page.screenshot({
				path: path.join(MOBILE_DIR, "08_scan_analyzing.png"),
			});

			console.log("  -> 09_scan_result.png");
			await page.waitForSelector("text=スキャン結果の確認", { timeout: 8000 });
			await page.waitForTimeout(800);
			await page.screenshot({
				path: path.join(MOBILE_DIR, "09_scan_result.png"),
			});

			console.log("  -> 09b_scan_image.png");
			const imageTabBtn = page.locator("button:has-text('元画像')").first();
			if (await imageTabBtn.isVisible()) {
				await imageTabBtn.click();
				await page.waitForTimeout(800);
				await page.screenshot({
					path: path.join(MOBILE_DIR, "09b_scan_image.png"),
				});
			}
		}
	}

	await context.close();
}

/**
 * デスクトップ（PC/Windows）版スクリーンショットの撮影
 */
async function captureDesktop(browser) {
	console.log(
		"\n💻 [Desktop] PC版スクリーンショット撮影開始 (1440x900 @2x)...",
	);

	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
		isMobile: false,
		hasTouch: false,
	});

	const page = await context.newPage();
	await setupApiMocks(page);
	await authenticate(page);

	// 1. ダッシュボード (ホーム / コックピット)
	console.log("  -> 01_dashboard.png");
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(600);
	await page.screenshot({
		path: path.join(DESKTOP_DIR, "01_dashboard.png"),
	});

	// 2. 口座推移チャート展開
	console.log("  -> 02_dashboard_chart.png");
	const mufgCard = page.locator("text=三菱UFJ銀行").first();
	if (await mufgCard.isVisible()) {
		await mufgCard.click();
		await page.waitForTimeout(400);
	}
	const toggleChartBtn = page
		.locator("button:has-text('推移チャートを表示')")
		.first();
	if (await toggleChartBtn.isVisible()) {
		await toggleChartBtn.click();
		await page.waitForTimeout(1500);
	}
	await page.screenshot({
		path: path.join(DESKTOP_DIR, "02_dashboard_chart.png"),
	});

	// 3. 次回のカード支払い予定
	console.log("  -> 03_billing_list.png");
	const billingSection = page.locator("#billing-section");
	if (await billingSection.isVisible()) {
		await billingSection.evaluate((el) =>
			el.scrollIntoView({ block: "start" }),
		);
		await page.waitForTimeout(600);
		await page.screenshot({
			path: path.join(DESKTOP_DIR, "03_billing_list.png"),
		});
	}

	// 4. 取引履歴一覧
	console.log("  -> 04_transactions.png");
	const txSection = page.locator("#transactions-section").first();
	if (await txSection.isVisible()) {
		await txSection.evaluate((el) => el.scrollIntoView({ block: "start" }));
		await page.waitForTimeout(600);
		await page.screenshot({
			path: path.join(DESKTOP_DIR, "04_transactions.png"),
		});
	}

	// 5. 分析レポート (前月の完結月を表示)
	console.log("  -> 05_analysis_report.png");
	const analysisSection = page.locator("#analysis-section");
	if (await analysisSection.isVisible()) {
		await analysisSection.evaluate((el) =>
			el.scrollIntoView({ block: "start" }),
		);
		const monthSelect = page.locator("#analysis-month-select");
		if (await monthSelect.isVisible()) {
			const options = await monthSelect.locator("option").all();
			if (options.length > 1) {
				const prevMonthVal = await options[1].getAttribute("value");
				if (prevMonthVal) {
					await monthSelect.selectOption(prevMonthVal);
					await page.waitForTimeout(1000);
				}
			}
		}
		await page.waitForTimeout(1500);
		await page.screenshot({
			path: path.join(DESKTOP_DIR, "05_analysis_report.png"),
		});

		// 5b. 年次推移
		console.log("  -> 05b_analysis_annual.png");
		const annualBtn = page.locator("button:has-text('年次')").first();
		if (await annualBtn.isVisible()) {
			await annualBtn.click();
			await page.waitForTimeout(1200);
			await page.screenshot({
				path: path.join(DESKTOP_DIR, "05b_analysis_annual.png"),
			});
		}
	}

	// 6. AIアドバイザー (チャット展開)
	console.log("  -> 06_ai_advisor.png");
	await page.evaluate(() => window.scrollTo(0, 0));
	const advisorCard = page.locator("#ai-advisor-card-container");
	await advisorCard.evaluate((el) => el.scrollIntoView({ block: "start" }));
	await advisorCard.click();
	await page.waitForTimeout(600);

	const foodSuggestion = page.locator("button:has-text('食費の内訳')").first();
	if (await foodSuggestion.isVisible()) {
		await foodSuggestion.click();
		await page.waitForTimeout(1500);
	}
	await page.evaluate(() => {
		const el = document.getElementById("ai-advisor-card-container");
		if (el) {
			el.scrollIntoView({ behavior: "instant", block: "start" });
			const chatLog = el.querySelector(".overflow-y-auto");
			if (chatLog) chatLog.scrollTop = 0;
		}
	});
	await page.waitForTimeout(400);
	await page.screenshot({
		path: path.join(DESKTOP_DIR, "06_ai_advisor.png"),
	});

	// 7. 取引入力モーダル
	console.log("  -> 07_transaction_modal.png");
	const addBtn = page.locator("#add-transaction-button").first();
	if (await addBtn.isVisible()) {
		await addBtn.click();
		await page.waitForSelector("#transaction-amount", { timeout: 4000 });
		await page.waitForTimeout(600);
		await page.screenshot({
			path: path.join(DESKTOP_DIR, "07_transaction_modal.png"),
		});

		// 8. レシートスキャン (AI解析中 & 結果確認)
		if (fs.existsSync(SAMPLE_RECEIPT)) {
			console.log("  -> 08_scan_analyzing.png");
			const fileInput = page.locator("input[name='fileInput']");
			await fileInput.setInputFiles(SAMPLE_RECEIPT);
			await page.waitForSelector(
				"text=Gemini 3.1 Flash Lite が画像を読み取っています",
				{ timeout: 4000 },
			);
			await page.waitForTimeout(300);
			await page.screenshot({
				path: path.join(DESKTOP_DIR, "08_scan_analyzing.png"),
			});

			console.log("  -> 09_scan_result.png");
			await page.waitForSelector("text=スキャン結果の確認", { timeout: 8000 });
			await page.waitForTimeout(800);
			await page.screenshot({
				path: path.join(DESKTOP_DIR, "09_scan_result.png"),
			});
		}
	}

	await context.close();
}

async function run() {
	console.log("==================================================");
	console.log("📸 WalletWise Journal スクリーンショット自動撮影開始");
	console.log("==================================================");

	await ensureDirs();

	const browser = await chromium.launch({
		headless: true,
	});

	try {
		await captureMobile(browser);
		await captureDesktop(browser);
		console.log("\n==================================================");
		console.log("🎉 全てのスクリーンショットの撮影が完了しました！");
		console.log(`📁 保存先: ${OUTPUT_DIR}`);
		console.log("==================================================");
	} catch (err) {
		console.error("撮影エラー:", err);
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
}

run();
