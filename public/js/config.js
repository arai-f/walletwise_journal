export const config = {
	// 資産: 残高を追跡する対象
	assets: [
		"現金",
		"ゆうちょ銀行",
		"三菱UFJ銀行",
		"PayPay",
		"ANA Pay",
		"楽天証券",
	],
	// 負債: クレジットカードなど、マイナス残高を追跡する対象
	liabilities: ["ANA JCB", "JAL VISA"],
	// 各資産のアイコン
	accountIcons: {
		現金: "fa-solid fa-wallet",
		ゆうちょ銀行: "fa-solid fa-building-columns",
		三菱UFJ銀行: "fa-solid fa-building-columns",
		PayPay: "fa-brands fa-paypal",
		"ANA Pay": "fa-solid fa-plane",
		"ANA JCB": "fa-brands fa-cc-jcb",
		"JAL VISA": "fa-brands fa-cc-visa",
		楽天証券: "fa-solid fa-chart-line",
	},
	// 収入カテゴリ
	incomeCategories: [
		"給与",
		"賞与",
		"副業",
		"臨時収入",
		"奨学金",
		"受取・その他入金",
	],
	// 支出カテゴリ
	expenseCategories: [
		"食費",
		"日用品",
		"趣味・娯楽",
		"交際費",
		"交通費",
		"衣服・美容",
		"健康・医療",
		"教養・教育",
		"水道・光熱費",
		"通信費",
		"家賃",
		"税金・社会保険",
		"保険",
		"特別な支出",
		"その他支出",
	],
	// クレジットカードの締め日と支払日のルール
	creditCardRules: {
		"ANA JCB": {
			closingDay: 15, // 毎月15日締め
			paymentDay: 10, // 支払日（日付の目安）
			paymentMonthOffset: 1,
			defaultPaymentAccount: "ゆうちょ銀行",
		},
		"JAL VISA": {
			closingDay: 15,
			paymentDay: 10,
			paymentMonthOffset: 1,
			defaultPaymentAccount: "ゆうちょ銀行",
		},
	},
};
