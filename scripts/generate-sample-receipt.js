/**
 * WalletWise Journal - サンプルレシート画像生成スクリプト
 *
 * Playwright を使用してリアルな日本のスーパー（ライフ）のレシート画像を
 * docs/assets/sample_receipt.png として自動生成します。
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUTPUT_DIR = path.join(__dirname, "../docs/assets");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "sample_receipt.png");

async function generateSampleReceipt() {
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({
		viewport: { width: 480, height: 800 },
		deviceScaleFactor: 2, // 高解像度 Retina
	});

	const receiptHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    background-color: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", -apple-system, monospace;
    padding: 20px;
  }
  .receipt-container {
    width: 360px;
    background: #ffffff;
    padding: 32px 28px 40px;
    border-radius: 4px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
    color: #1e293b;
    position: relative;
    border-top: 6px solid #10b981;
  }
  .receipt-header {
    text-align: center;
    margin-bottom: 20px;
  }
  .receipt-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: #10b981;
    color: white;
    font-weight: 900;
    font-size: 22px;
    margin-bottom: 8px;
    box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
  }
  .store-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #0f172a;
  }
  .store-branch {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    margin-top: 2px;
  }
  .store-info {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 6px;
    line-height: 1.4;
  }
  .divider {
    border-bottom: 1px dashed #cbd5e1;
    margin: 14px 0;
  }
  .double-divider {
    border-bottom: 2px solid #0f172a;
    margin: 14px 0;
  }
  .meta-info {
    font-size: 11px;
    color: #475569;
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
  }
  .items-table {
    width: 100%;
    margin-top: 10px;
    font-size: 13px;
  }
  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 5px 0;
    color: #334155;
  }
  .item-name {
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .item-price {
    font-weight: 700;
    font-family: monospace;
    font-size: 14px;
  }
  .tax-mark {
    font-size: 10px;
    color: #10b981;
    font-weight: bold;
    margin-left: 2px;
  }
  .summary-section {
    margin-top: 8px;
    font-size: 13px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    color: #64748b;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    padding: 8px 0;
  }
  .total-amount {
    font-size: 24px;
    font-family: monospace;
    color: #047857;
  }
  .payment-section {
    background: #f8fafc;
    border-radius: 8px;
    padding: 10px 12px;
    margin-top: 12px;
    font-size: 12px;
    color: #475569;
  }
  .payment-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .barcode-section {
    text-align: center;
    margin-top: 24px;
  }
  .barcode {
    display: inline-flex;
    gap: 2px;
    height: 38px;
    align-items: stretch;
    justify-content: center;
  }
  .bar {
    background: #1e293b;
    border-radius: 1px;
  }
  .barcode-number {
    font-size: 10px;
    color: #94a3b8;
    font-family: monospace;
    letter-spacing: 0.15em;
    margin-top: 4px;
  }
  .footer-msg {
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
    margin-top: 16px;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="receipt-container" id="receipt">
    <div class="receipt-header">
      <div class="receipt-logo">☘</div>
      <div class="store-title">スーパー ライフ</div>
      <div class="store-branch">渋谷東店</div>
      <div class="store-info">
        東京都渋谷区東1-26-22<br>
        TEL: 03-5468-3921 / 登録番号: T1010001004567
      </div>
    </div>

    <div class="divider"></div>

    <div class="meta-info">
      <span>2026年09月13日(日) 14:35</span>
      <span>レシート No. 8924</span>
    </div>
    <div class="meta-info">
      <span>レジ: 003</span>
      <span>担当: 鈴木</span>
    </div>

    <div class="divider"></div>

    <div class="items-table">
      <div class="item-row">
        <span class="item-name">国産豚ロース生姜焼用 (320g)</span>
        <span class="item-price">¥428<span class="tax-mark">軽</span></span>
      </div>
      <div class="item-row">
        <span class="item-name">プレミアム生乳牛乳 (1000ml)</span>
        <span class="item-price">¥248<span class="tax-mark">軽</span></span>
      </div>
      <div class="item-row">
        <span class="item-name">新鮮こだわり赤たまご (10個)</span>
        <span class="item-price">¥278<span class="tax-mark">軽</span></span>
      </div>
      <div class="item-row">
        <span class="item-name">新潟県魚沼産こしひかり (5kg)</span>
        <span class="item-price">¥2,180<span class="tax-mark">軽</span></span>
      </div>
      <div class="item-row">
        <span class="item-name">国産キャベツ (1/2カット)</span>
        <span class="item-price">¥128<span class="tax-mark">軽</span></span>
      </div>
      <div class="item-row">
        <span class="item-name">極小粒納豆 (3パック)</span>
        <span class="item-price">¥108<span class="tax-mark">軽</span></span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="summary-section">
      <div class="summary-row">
        <span>小計 (税抜)</span>
        <span style="font-family: monospace;">¥3,370</span>
      </div>
      <div class="summary-row">
        <span>(内 8%消費税等対象 ¥3,370)</span>
        <span style="font-family: monospace;">¥269</span>
      </div>
    </div>

    <div class="double-divider"></div>

    <div class="total-row">
      <span>合計 (税込)</span>
      <span class="total-amount">¥3,639</span>
    </div>

    <div class="payment-section">
      <div class="payment-row">
        <span>支払方法: クレジット一括</span>
        <span style="font-weight: 700; font-family: monospace;">¥3,639</span>
      </div>
      <div class="payment-row" style="font-size: 11px; color: #64748b;">
        <span>楽天カード (Mastercard)</span>
        <span style="font-family: monospace;">****-****-****-1234</span>
      </div>
      <div class="payment-row" style="font-size: 11px; color: #64748b;">
        <span>承認番号: 890124</span>
        <span>取扱 No. 0418</span>
      </div>
    </div>

    <div class="barcode-section">
      <div class="barcode">
        <div class="bar" style="width: 2px;"></div>
        <div class="bar" style="width: 4px;"></div>
        <div class="bar" style="width: 1px;"></div>
        <div class="bar" style="width: 3px;"></div>
        <div class="bar" style="width: 5px;"></div>
        <div class="bar" style="width: 2px;"></div>
        <div class="bar" style="width: 1px;"></div>
        <div class="bar" style="width: 4px;"></div>
        <div class="bar" style="width: 2px;"></div>
        <div class="bar" style="width: 3px;"></div>
        <div class="bar" style="width: 1px;"></div>
        <div class="bar" style="width: 4px;"></div>
        <div class="bar" style="width: 2px;"></div>
        <div class="bar" style="width: 5px;"></div>
        <div class="bar" style="width: 1px;"></div>
        <div class="bar" style="width: 3px;"></div>
        <div class="bar" style="width: 2px;"></div>
        <div class="bar" style="width: 4px;"></div>
        <div class="bar" style="width: 2px;"></div>
        <div class="bar" style="width: 1px;"></div>
        <div class="bar" style="width: 4px;"></div>
        <div class="bar" style="width: 3px;"></div>
        <div class="bar" style="width: 1px;"></div>
        <div class="bar" style="width: 5px;"></div>
        <div class="bar" style="width: 2px;"></div>
      </div>
      <div class="barcode-number">4 901234 567890</div>
    </div>

    <div class="footer-msg">
      上記正に領収いたしました。<br>
      お買い上げありがとうございました。<br>
      またのお越しをお待ち申し上げております。
    </div>
  </div>
</body>
</html>
`;

	await page.setContent(receiptHtml);
	await page.waitForTimeout(500);

	const receiptElement = await page.$("#receipt");
	await receiptElement.screenshot({
		path: OUTPUT_FILE,
	});

	console.log(`✅ サンプルレシート画像を生成しました: ${OUTPUT_FILE}`);
	await browser.close();
}

generateSampleReceipt().catch((err) => {
	console.error("❌ レシート生成エラー:", err);
	process.exit(1);
});
