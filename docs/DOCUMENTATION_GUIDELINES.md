# WalletWise Journal Documentation & Comment Guidelines

## 1. 基本方針 (General Principles)

- **言語**: すべて  **日本語**  で記述する。
- **文体**: 簡潔な  **常体**（「〜する」「〜を取得する」など）で統一する。「です・ます」調は使用しない。
- **目的**: コードの「動作（What）」だけでなく、背景にある「意図や理由（Why）」を伝えることに重点を置く。

## 2. JSDoc ガイドライン (JSDoc Guidelines)

エクスポートされる関数、クラス、主要な内部関数、および重要な定数オブジェクトには、必ず JSDoc 形式のコメントを付与します。

### フォーマット

- **概要**: 1 行目にその関数やオブジェクトの目的を簡潔に記述する。
- **`@param`**: 引数の型、名前、説明を記述する。
- **`@returns`**: 戻り値の型と説明を記述する。Promise を返す場合は、解決される値（Resolved Value）について説明する。
- **`@async`**: 非同期関数には必ず付与する。
- **副作用の明記**: Firestore や外部 API との通信、グローバルステートの変更などがある場合は、その旨を概要または  `@fires`  等で明記する。

### 記述例

```JavaScript
/**
 * 指定された期間の取引データをFirestoreから取得する。
 * 日付は日本時間を基準としてクエリを実行する。
 * * @async
 * @param {number} months - 取得する期間（現在から過去Nヶ月分）。
 * @returns {Promise<Array<object>>} 取引オブジェクトの配列。日付の降順でソートされる。
 * @throws {Error} 認証されていない場合にエラーを投げる。
 */
export async function fetchTransactionsForPeriod(months) {
    // ...
}
```

## 3. インラインコメント ガイドライン (Inline Comment Guidelines)

関数内部のロジックに対するコメントの記述ルールです。

### 推奨されるコメント

1. **意図の補足**: コードからは直感的に読み取れない複雑なロジックや、特定のビジネスルール（例：「API 仕様により UTC 変換が必要」など）がある場合、その「理由」を説明する。
2. **セクション区切り**: 処理の大きな塊（ブロック）の開始時に、何を行うブロックかを簡潔に示す。

### 非推奨・削除対象のコメント

1. **冗長な説明**: 変数定義や単純な計算など、コードを見れば自明な処理に対するコメントは記述しない（または削除する）。
2. **敬体（です・ます）**: 既存のコードに「〜します」といった記述がある場合は、「〜する」等の常体に修正する。

### 記述例

**良い例 (Good):**

```JavaScript
// APIの仕様により、日付文字列を日本時間として解釈し、UTCタイムスタンプに変換して保存
const date = Timestamp.fromDate(fromZonedTime(data.date, "Asia/Tokyo"));

// --- 編集モード ---
if (id) {
    await setDoc(docRef, transactionData, { merge: true });
}
```

**悪い例 (Bad):**

```JavaScript
// 日付を定義します
const date = new Date();

// idがある場合は編集モードとして処理します
if (id) { ... }
```
