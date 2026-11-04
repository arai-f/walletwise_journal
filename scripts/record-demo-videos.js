/**
 * WalletWise Journal - デモ動画自動収録スクリプト
 *
 * Playwright の recordVideo 機能を活用し、iOSスマホ版およびPC版の
 * アプリケーション操作デモ動画（WebM）を高解像度・スムーズなアニメーションで自動収録します。
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const VIDEO_DIR = path.join(__dirname, "../docs/videos");
const SAMPLE_RECEIPT = path.join(
	__dirname,
	"../docs/assets/sample_receipt.png",
);

// モックAIアドバイザーの返答データ（動画内で美しい診断カードを表示）
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

// スキャン結果モック
const MOCK_SCAN_RESPONSE = {
	data: [
		{
			date: "2026-09-13",
			amount: 3639,
			description: "スーパーライフ 渋谷東店 (食料品)",
			type: "expense",
			category: "食費",
		},
	],
};

function ensureDirs() {
	if (!fs.existsSync(VIDEO_DIR)) {
		fs.mkdirSync(VIDEO_DIR, { recursive: true });
	}
}

/**
 * 滑らかなスクロール（動画閲覧用）
 */
async function smoothScroll(page, targetY, steps = 15, delay = 35) {
	await page.evaluate(
		async ({ targetY, steps, delay }) => {
			const startY = window.scrollY;
			const diff = targetY - startY;
			for (let i = 1; i <= steps; i++) {
				window.scrollTo(0, startY + diff * (i / steps));
				await new Promise((r) => setTimeout(r, delay));
			}
		},
		{ targetY, steps, delay },
	);
	await page.waitForTimeout(200);
}

/**
 * 特定要素までスムーズスクロール
 */
async function smoothScrollToElement(page, selector, offset = -20) {
	const el = page.locator(selector).first();
	if (await el.isVisible()) {
		const box = await el.boundingBox();
		if (box) {
			const currentY = await page.evaluate(() => window.scrollY);
			await smoothScroll(page, currentY + box.y + offset);
		}
	}
}

/**
 * マウス移動シミュレーション（PC動画用）
 */
async function smoothMouseMoveTo(page, selector, steps = 12) {
	const el = page.locator(selector).first();
	if (await el.isVisible()) {
		const box = await el.boundingBox();
		if (box) {
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
				steps,
			});
			await page.waitForTimeout(250);
		}
	}
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
			console.log("  - ログインボタンを検出、認証中...");
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
	await page.waitForTimeout(1000);
}

/**
 * APIモック設定
 */
async function setupApiMocks(page) {
	await page.route("**/askAdvisor*", async (route) => {
		await page.waitForTimeout(800);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ data: MOCK_ADVISOR_RESPONSE.result }),
		});
	});

	await page.route("**/scanReceipt*", async (route) => {
		// AI読み取りのアニメーションを見せるため意図的に1.2秒ウェイト
		await page.waitForTimeout(1200);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(MOCK_SCAN_RESPONSE),
		});
	});
}

/**
 * 📱 モバイル（iOS PWA）版デモ動画の収録
 */
async function recordMobile(browser) {
	console.log(
		"\n📱 [Mobile] iOS版デモ動画の収録を開始します (786x1704 @2x Retina)...",
	);

	const tempDir = path.join(VIDEO_DIR, "temp_mobile");
	if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

	const context = await browser.newContext({
		viewport: { width: 393, height: 852 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
		userAgent:
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
		recordVideo: {
			dir: tempDir,
			size: { width: 786, height: 1704 },
		},
	});

	const page = await context.newPage();
	const video = page.video();
	await setupApiMocks(page);
	await authenticate(page);

	// シナリオ 1: トップ画面（純資産・月次収支）の表示
	console.log("  [Step 1] ダッシュボードをゆったり表示");
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(1500);

	// シナリオ 2: 口座カードの選択と推移チャートのアニメーション展開
	console.log("  [Step 2] 三菱UFJ銀行カードを選択し、推移チャートを展開");
	const mufgCard = page.locator("text=三菱UFJ銀行").first();
	if (await mufgCard.isVisible()) {
		await mufgCard.click();
		await page.waitForTimeout(600);
	}

	const toggleChartBtn = page
		.locator("button:has-text('推移チャートを表示')")
		.first();
	if (await toggleChartBtn.isVisible()) {
		await toggleChartBtn.click();
		// チャートの描画アニメーションをじっくり見せる
		await page.waitForTimeout(2000);
	}

	// 画面を少し下にスクロールして次回のカード請求一覧を見せる
	await smoothScroll(page, 320, 10, 25);
	await page.waitForTimeout(1200);

	// トップに戻る
	await smoothScroll(page, 0, 10, 20);
	await page.waitForTimeout(800);

	// シナリオ 3: 取引追加モーダルを開き、レシートをAIスキャン
	console.log("  [Step 3] レシートAIスキャンを実行");
	const navAddBtn = page
		.locator("nav button:has-text('登録')")
		.or(page.locator("button[aria-label='取引を追加']"))
		.first();

	if (await navAddBtn.isVisible()) {
		await navAddBtn.click();
		await page.waitForSelector("#transaction-amount", { timeout: 5000 });
		await page.waitForTimeout(800);

		if (fs.existsSync(SAMPLE_RECEIPT)) {
			console.log("  - レシート画像を投入");
			const fileInput = page.locator("input[name='fileInput']");
			await fileInput.setInputFiles(SAMPLE_RECEIPT);

			// AI解析中スピナー表示（約1.5秒）
			await page.waitForSelector(
				"text=Gemini 3.1 Flash Lite が画像を読み取っています",
				{ timeout: 5000 },
			);
			await page.waitForTimeout(1500);

			// 解析結果画面の確認
			await page.waitForSelector("text=スキャン結果の確認", { timeout: 8000 });
			await page.waitForTimeout(1500);

			// 「元画像」タブに切り替えて原本を確認
			const imageTabBtn = page.locator("button:has-text('元画像')").first();
			if (await imageTabBtn.isVisible()) {
				console.log("  - 元画像タブに切り替えて原本を確認");
				await imageTabBtn.click();
				await page.waitForTimeout(1200);

				// 読み取り結果タブへ戻る
				const resultTabBtn = page
					.locator("button:has-text('読み取り結果')")
					.first();
				if (await resultTabBtn.isVisible()) {
					await resultTabBtn.click();
					await page.waitForTimeout(800);
				}
			}

			// 「登録」ボタンをクリックして取引を確定保存
			console.log("  - スキャン取引を保存");
			const saveScanBtn = page
				.locator("button:has-text('✓ 登録')")
				.or(page.locator("button:has-text('登録')"))
				.last();
			if (await saveScanBtn.isVisible()) {
				await saveScanBtn.click();
				// モーダルが閉じるのを待機
				await page
					.waitForSelector("text=スキャン結果の確認", {
						state: "detached",
						timeout: 5000,
					})
					.catch(() => {});
				// 登録完了通知と即時残高反映を見せる
				await page.waitForTimeout(1500);
			}
		}
	}

	// シナリオ 4: AIアドバイザーによる家計診断
	console.log("  [Step 4] AIアドバイザーで食費の診断をリクエスト");
	const advisorCard = page.locator("#ai-advisor-card-container");
	if (await advisorCard.isVisible()) {
		await advisorCard.evaluate((el) =>
			el.scrollIntoView({ behavior: "smooth", block: "center" }),
		);
		await page.waitForTimeout(800);
		await advisorCard.click({ force: true });
		await page.waitForTimeout(800);

		// 「食費の内訳」サジェストチップをタップ
		const foodSuggestion = page
			.locator("button:has-text('食費の内訳')")
			.first();
		if (await foodSuggestion.isVisible()) {
			await foodSuggestion.click({ force: true });
			// AI生成中のアニメーションと回答の表示をしっかり見せる
			await page.waitForTimeout(3000);
		}
	}

	// エンディング余韻
	await page.waitForTimeout(1500);

	// コンテキストを閉じることで動画がディスクにフラッシュされる
	await context.close();

	// 生成された動画ファイルを mobile_demo.webm に移動
	const recordedPath = await video.path();
	const finalPath = path.join(VIDEO_DIR, "mobile_demo.webm");
	if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
	fs.renameSync(recordedPath, finalPath);

	// 一時ディレクトリのクリーンアップ
	try {
		fs.rmdirSync(tempDir);
	} catch (e) {}

	console.log(`✅ [Mobile] 動画保存完了: ${finalPath}`);
}

/**
 * 💻 デスクトップ（PC/Windows）版デモ動画の収録
 */
async function recordDesktop(browser) {
	console.log(
		"\n💻 [Desktop] PC版デモ動画の収録を開始します (2880x1800 @2x Retina)...",
	);

	const tempDir = path.join(VIDEO_DIR, "temp_desktop");
	if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
		isMobile: false,
		hasTouch: false,
		recordVideo: {
			dir: tempDir,
			size: { width: 2880, height: 1800 },
		},
	});

	const page = await context.newPage();
	const video = page.video();
	await setupApiMocks(page);
	await authenticate(page);

	// シナリオ 1: ワイドコックピットの表示
	console.log("  [Step 1] ワイドコックピット全体を表示");
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(1500);

	// 口座カードの選択と推移チャート
	console.log("  [Step 2] マウスを三菱UFJ銀行カードへ移動して選択");
	await smoothMouseMoveTo(page, "text=三菱UFJ銀行");
	const mufgCard = page.locator("text=三菱UFJ銀行").first();
	await mufgCard.click();
	await page.waitForTimeout(600);

	await smoothMouseMoveTo(page, "button:has-text('推移チャートを表示')");
	const toggleChartBtn = page
		.locator("button:has-text('推移チャートを表示')")
		.first();
	if (await toggleChartBtn.isVisible()) {
		await toggleChartBtn.click();
		await page.waitForTimeout(2000);
	}

	// シナリオ 2: 分析レポート（年次切り替えとバランス確認）
	console.log("  [Step 3] 分析レポートへスクロール");
	await smoothScrollToElement(page, "#analysis-section");
	await page.waitForTimeout(1000);

	// 「年次」切り替え
	console.log("  - 年次チャートへ切り替え");
	await smoothMouseMoveTo(page, "button:has-text('年次')");
	const annualBtn = page.locator("button:has-text('年次')").first();
	if (await annualBtn.isVisible()) {
		await annualBtn.click();
		await page.waitForTimeout(2000);
	}

	// 「月次」へ戻して前月を選択
	const monthlyBtn = page.locator("button:has-text('月次')").first();
	if (await monthlyBtn.isVisible()) {
		await smoothMouseMoveTo(page, "button:has-text('月次')");
		await monthlyBtn.click();
		await page.waitForTimeout(800);
	}

	// トップに戻る
	await smoothScroll(page, 0, 15, 25);
	await page.waitForTimeout(800);

	// シナリオ 3: PCでのレシートスキャンと2カラム照合UI
	console.log("  [Step 4] 右上の「＋ 取引を追加」からレシートスキャン");
	await smoothMouseMoveTo(page, "#add-transaction-button");
	const addBtn = page.locator("#add-transaction-button").first();
	if (await addBtn.isVisible()) {
		await addBtn.click();
		await page.waitForSelector("#transaction-amount", { timeout: 5000 });
		await page.waitForTimeout(800);

		if (fs.existsSync(SAMPLE_RECEIPT)) {
			console.log("  - レシート画像をアップロード");
			const fileInput = page.locator("input[name='fileInput']");
			await fileInput.setInputFiles(SAMPLE_RECEIPT);

			// AI解析中アニメーション
			await page.waitForSelector(
				"text=Gemini 3.1 Flash Lite が画像を読み取っています",
				{ timeout: 5000 },
			);
			await page.waitForTimeout(1500);

			// PC大画面での原本とスキャン結果の2カラム照合表示
			await page.waitForSelector("text=スキャン結果の確認", { timeout: 8000 });
			await page.waitForTimeout(2000);

			// 保存実行
			console.log("  - スキャン取引を保存");
			const saveScanBtn = page
				.locator("button:has-text('✓ 登録')")
				.or(page.locator("button:has-text('登録')"))
				.last();
			if (await saveScanBtn.isVisible()) {
				await smoothMouseMoveTo(
					page,
					"button:has-text('✓ 登録'), button:has-text('登録')",
				);
				await saveScanBtn.click();
				await page
					.waitForSelector("text=スキャン結果の確認", {
						state: "detached",
						timeout: 5000,
					})
					.catch(() => {});
				await page.waitForTimeout(1500);
			}
		}
	}

	// エンディング余韻
	await page.waitForTimeout(1500);

	await context.close();

	// 生成された動画ファイルを desktop_demo.webm に移動
	const recordedPath = await video.path();
	const finalPath = path.join(VIDEO_DIR, "desktop_demo.webm");
	if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
	fs.renameSync(recordedPath, finalPath);

	try {
		fs.rmdirSync(tempDir);
	} catch (e) {}

	console.log(`✅ [Desktop] 動画保存完了: ${finalPath}`);
}

async function run() {
	console.log("==================================================");
	console.log("🎬 WalletWise Journal デモ動画自動収録スクリプト開始");
	console.log("==================================================");

	ensureDirs();

	const browser = await chromium.launch({
		headless: true,
		args: [
			"--font-render-hinting=none",
			"--enable-font-antialiasing",
			"--high-dpi-support=1",
			"--force-device-scale-factor=2",
			"--disable-gpu-vsync",
		],
	});

	try {
		await recordMobile(browser);
		await recordDesktop(browser);

		console.log("\n==================================================");
		console.log("🎉 全てのデモ動画の自動収録が完了しました！");
		console.log(`📁 保存先: ${VIDEO_DIR}`);
		console.log("==================================================");
	} catch (err) {
		console.error("収録エラー:", err);
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
}

run();
