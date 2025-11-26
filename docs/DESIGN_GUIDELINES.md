# WalletWise Journal UI Design Guidelines

## 1. カラーパレット (Color Palette)

Tailwind CSS の設定に基づき、以下のカラーコードを厳守する。

### テーマカラー

| **用途**          | **クラス名**                  | **カラーコード / 変数** | **備考**                     |
| ----------------- | ----------------------------- | ----------------------- | ---------------------------- |
| **Primary**       | `text-primary` / `bg-primary` | `#4f46e5` (Indigo-600)  | メインアクション、アクセント |
| **Primary Dark**  | `bg-primary-dark`             | `#4338ca` (Indigo-700)  | ホバー時の背景色             |
| **Primary Light** | `bg-primary-light`            | `#eef2ff` (Indigo-50)   | 背景、選択状態               |
| **Success**       | `text-success` / `bg-success` | `#16a34a` (Green-600)   | 収入、完了、ポジティブな値   |
| **Danger**        | `text-danger` / `bg-danger`   | `#dc2626` (Red-600)     | 支出、削除、エラー、警告     |

### ニュートラルカラー (テキスト & 背景)

視認性を確保するため、テキストには高いコントラスト比を持つ色を使用する。

| **用途**                 | **クラス名**         | **カラーコード** | **適用箇所**                         |
| ------------------------ | -------------------- | ---------------- | ------------------------------------ |
| **Main Text**            | `text-neutral-900`   | `#111827`        | 見出し、入力値、主要なラベル         |
| **Body Text**            | `text-neutral-800`   | `#1f2937`        | 一般的な本文                         |
| **Sub Text**             | `text-neutral-600`   | `#4b5563`        | 補足説明、ラベル（非強調）、アイコン |
| **Disabled/Placeholder** | `text-neutral-400`   | `#9ca3af`        | プレースホルダー、無効状態           |
| **Background (Base)**    | `bg-white`           | `#ffffff`        | カード背景、モーダル、入力欄         |
| **Background**           | `bg-neutral-50`      | `#f9fafb`        | ページ背景                           |
| **Border**               | `border-neutral-200` | `#e5e7eb`        | 区切り線、カード枠線                 |
| **Input Border**         | `border-neutral-300` | `#d1d5db`        | 入力フォームの枠線                   |

## 2. タイポグラフィ (Typography)

- **Font Family**: `Inter`, `BIZ UDPGothic`, sans-serif
- **Font Weight**:
  - **Bold (`font-bold`)**: ページタイトル、強調ボタン（Primary Button）
  - **Medium (`font-medium`)**: リストの項目名、小見出し、ラベル
  - **Regular (`font-normal`)**: 本文、補足説明

## 3. フォームエレメント (Form Elements)

入力フォーム（Input, Select）は、操作しやすく、かつ画面を圧迫しないサイズに統一する。

### 基本スタイル (Base Style)

すべての入力要素（`input[type="text"]`, `input[type="number"]`, `input[type="date"]`, `select`）に適用する。

- **高さ (Height)**: `h-9` (36px)
- **文字サイズ**: `text-sm` (14px)
- **文字色**: `text-neutral-900` (入力値はくっきりと)
- **背景色**: `bg-white`
- **枠線**: `border border-neutral-300`
- **角丸**: `rounded-lg`
- **パディング**: `px-2` (左右 8px)

### フォーカス状態 (Focus State)

- **Ring**: `focus:ring-2` `focus:ring-primary` (インディゴ系のリング)
- **Border**: `focus:border-primary`

### コード例 (Tailwind)

HTML

```
<input type="text" class="h-9 w-full border border-neutral-300 rounded-lg px-2 text-sm text-neutral-900 focus:ring-2 focus:ring-primary focus:border-primary">
```

## 4. ボタン (Buttons)

### Primary Button (保存、登録、主要アクション)

- **背景**: `bg-primary` → Hover: `bg-primary-dark`
- **文字**: `text-white` `font-bold`
- **影**: `shadow-sm`
- **角丸**: `rounded-lg`
- **パディング**: `px-4 py-1.5` (テキストサイズや配置により微調整可)

### Secondary / Cancel Button (キャンセル、戻る)

- **背景**: `bg-white` → Hover: `bg-neutral-50`
- **枠線**: `border border-neutral-300`
- **文字**: `text-neutral-700` `font-bold`
- **角丸**: `rounded-lg`

### Icon Button (リスト内の編集・削除など)

- **サイズ**: `p-2`  または  `w-8 h-8`  で正方形に近い形を保つ
- **背景**: 透明 → Hover: `bg-white` (リスト背景が  `bg-neutral-50`  の場合)
- **アイコン色**:
  - 編集: `text-primary`
  - 削除: `text-danger`
  - その他: `text-neutral-600`

## 5. リスト・カード (Lists & Cards)

設定画面や一覧画面で使用するリスト項目のスタイル。

### リストアイテム (List Item Container)

- **背景**: `bg-neutral-50` (真っ白ではなく淡いグレー)
- **枠線**: なし、または  `border border-neutral-200` (背景とのコントラストが必要な場合)
- **角丸**: `rounded-md`
- **パディング**: `p-3`
- **マージン**: 下部に  `mb-2`

### ドラッグハンドル (Drag Handle)

- **アイコン**: `<i class="fas fa-grip-vertical"></i>`
- **色**: `text-neutral-500` (常時視認可能にする) → Hover: `text-neutral-700`
- **カーソル**: `cursor-move`

### 情報の階層構造

1. **メイン情報 (名前など)**: `font-medium text-neutral-900`
2. **サブ情報 (日付、金額など)**: `text-xs`  または  `text-sm`、`text-neutral-600`

## 6. モーダル (Modals)

- **オーバーレイ**: `bg-black/50` (Tailwind の opacity modifier を使用)
- **コンテナ背景**: `bg-white`
- **角丸**: `rounded-lg` (スマホ全画面時は  `rounded-none`)
- **影**: `shadow-xl`
- **ヘッダー**: タイトルは  `text-xl font-bold text-neutral-800`、下線  `border-b border-neutral-200`

### 運用ルール

- **数値を直接書かない**: 色を指定する際は HEX コードを直接書かず、必ず定義済みのクラス（`text-neutral-900`等）を使用する。
- **不透明度の統一**: 薄くしたい場合は  `text-neutral-400`  のように色自体を変えるか、`opacity-50`  のようにユーティリティを使う。
- **スマホファースト**: 複雑なレイアウト（テーブルや横並び）は、スマホ表示時に  `flex-col`  等で縦積みに切り替えることを基本とする。
