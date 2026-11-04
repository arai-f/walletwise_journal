<h1 align="center">WalletWise Journal <img src="./public/favicon/favicon.ico" alt="WalletWise Journal logo" width="24"/></h1>

<p align="center">
WalletWise Journalは、モダンなUIであなたのお金の流れをシンプルに記録・管理できる、高機能なシングルページアプリケーション（SPA）の家計簿です。FirebaseとReact (Vite)で構築されており、PWAとしてホーム画面に追加してネイティブアプリのように使用することを想定しています。
</p>

## 🎬 Live Demo & 📱 App Showcase

アプリの実際の操作アニメーションや各種画面のスクリーンショットは、以下のショーケースページをご覧ください。

👉 **[操作デモ動画 & 画面ギャラリーはこちら (docs/SHOWCASE.md)](./docs/SHOWCASE.md)**
- **🎬 操作デモ動画**: Playwright で自動収録されたスマホ版 (786×1704 @2x Retina) および PC版 (2880×1800 @2x Retina) の操作フロー（WebM）
- **📱 画面ギャラリー**: ダッシュボード、残高推移チャート、収支レポート、レシートAIスキャン照合、AIアドバイザー対話などの高解像度画面一覧

## ✨ 主な機能

### 🤖 AI パートナー機能

- **AI アドバイザー (Chatbot)**:
  - **専属 FP のような対話体験**: 「先月より使いすぎ？」「食費の内訳を教えて」など、自然な会話で家計状況を確認・相談できます。
  - **コンテキスト認識**: 設定した表示期間のデータに基づいて分析を行うため、直近の家計状況に即した的確なアドバイスが可能です。
- **AI スキャン入力**:
  - **Gemini 3.1 Flash Lite 搭載**: レシートや明細書の画像を撮影するだけで、日付・金額・店名・カテゴリを AI が瞬時に解析して自動入力。
  - **学習する自動分類**: 「除外キーワード」や「カテゴリ分類ルール」を設定することで、使えば使うほど入力がスムーズに。

### 📊 資産管理・分析

- **インタラクティブな資産コックピット**:
  - **資産サマリー**: 総資産・総負債・純資産をリアルタイムに集計し、美しいUIで表示。
  - **口座別推移チャート**: 各口座のカードを選択するだけで、その口座の残高推移グラフを即座に展開・表示。資産の増減トレンドを直感的に把握できます。
- **詳細な分析レポート**:
  - **月次・期間別分析**: 指定した月の収支バランスや、カテゴリ別の支出内訳を詳細に分析。長期的な資産推移もグラフで確認可能です。

### 🛡️ 安心・安全設計

- **強固なセキュリティ**:
  - **Firebase App Check (reCAPTCHA v3)** により、不正なアクセスや Bot から API を保護。
  - **Firestore セキュリティルール** でデータの整合性とアクセス権を厳格に管理。
- **堅牢なデータ整合性**:
  - **Cloud Functions** によるサーバーサイド自動計算を導入。クライアント側のバグや不正操作による残高不整合を防止します。
  - **リアルタイム同期**: WebSocket を活用し、計算結果を即座に全デバイスへ反映。

### 📱 快適な UX

- **取引の記録**:
  - 直感的な UI で「支出」「収入」「振替」を簡単に追加・編集・削除。
- **高度な管理機能**:
  - **口座・カテゴリ管理**: アイコン設定やドラッグ＆ドロップでの並べ替えに対応。
  - **クレジットカード管理**: 締め日・支払日を設定すると、「次回の支払い予定」を自動計算してリスト表示。
- **PWA & オフライン対応**:
  - インストールしてネイティブアプリのように動作。電波の悪い場所でも閲覧・入力が可能。
  - データの入力忘れを防ぐリマインダー通知機能も搭載。
- **インタラクティブガイド**:
  - 初回利用時にアプリの主要機能をスライド形式で分かりやすく解説するオンボーディング機能を搭載。

## 🛠️ 使用技術

| カテゴリ     | 詳細                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend** | ![React](https://img.shields.io/badge/React-%2320232a.svg?logo=react&logoColor=%2361DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=fff) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-%2338B2AC.svg?logo=tailwind-css&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000) |
| **Backend**  | ![Firebase](https://img.shields.io/badge/Firebase-039BE5?logo=Firebase&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)                                                                                                                                                                                                                                                                                      |
| **AI**       | ![Google Gemini](https://img.shields.io/badge/Google%20Gemini-886FBF?logo=googlegemini&logoColor=fff)                                                                                                                                                                                                                                                                                                                                                                    |
| **DevOps**   | ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=github-actions&logoColor=white)                                                                                                                                                                                                                                                                                                                                                                |

## 🚀 セットアップ方法 (Quick Start)

### 1. 前提条件
- **Node.js**: v22+
- **Java**: JDK 11+（Firebase Emulator の実行に必須）
- **Firebase CLI**: `npm install -g firebase-tools`

### 2. インストール
リポジトリをクローンし、フロントエンドとバックエンドの依存関係を一括インストールします。

```bash
git clone https://github.com/arai-f/walletwise_journal.git
cd walletwise_journal

# フロントエンド & バックエンドのパッケージをインストール
npm install && cd functions && npm install && cd ..
```

### 3. ローカル開発サーバーの起動
ターミナルを2つ開いて実行します。

```bash
# ターミナル 1: Firebase エミュレータ (バックエンド)
firebase emulators:start --only=auth,functions,firestore --import=./firebase-data --export-on-exit

# ターミナル 2: Vite 開発サーバー (フロントエンド)
npm run dev
```

ブラウザで **`http://localhost:5173`** にアクセスすると、ローカル環境でアプリが利用可能です。

---

### 💡 便利な開発コマンド

| コマンド | 説明 |
| :--- | :--- |
| `npm run seed:demo` | 12ヶ月分（約380件）のリアルなデモ家計簿データをエミュレータに投入 |
| `npm run generate:receipt` | AIスキャン検証用のリアルなサンプルレシート画像 (`sample_receipt.png`) を生成 |
| `npm run capture:screenshots` | スマホ・PCの全21枚の高解像度スクリーンショットを一括自動撮影 |
| `npm run record:videos` | スマホ・PCの操作デモ動画（Retina 2x WebM）を一括自動収録 |

---

<details>
<summary><b>🔧 本番デプロイ・詳細設定・OS固有の注意点（クリックで展開）</b></summary>

### 本番環境へのデプロイ
```bash
npm run build
firebase deploy
```

### 環境設定ファイル (`public/src/firebase-config.ts`)
本番プロジェクトに接続する場合は、Firebase コンソールから取得した設定値で `public/src/firebase-config.ts` を更新し、`isLocalDevelopment = false` に設定してください。

### OS 固有の注意点
- **Windows (PowerShell)**: エミュレータ起動時にスクリプト実行権限エラーが出る場合は、以下を実行してください。
  ```PowerShell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **改行コード (Line Endings)**: Windows では Git 設定で `autocrlf = false` または `input` を推奨します。
  ```bash
  git config --global core.autocrlf false
  ```
</details>

## 🗄️ データベース設計 (Firestore)

WalletWise Journal の Cloud Firestore スキーマ設計、コレクション詳細、および Mermaid による E-R 図は、以下のドキュメントをご覧ください。

👉 **[Firestore データ構造 & E-R 図はこちら (docs/FIRESTORE.md)](./docs/FIRESTORE.md)**
- **📊 E-R ダイアグラム**: エンティティ間のリレーション（1:N, 1:1）、PK/FK、データ型の可視化
- **📁 コレクション詳細**: `transactions`, `user_accounts`, `user_categories`, `account_balances` などの設計解説

## 🛠️ コーディングガイドライン

- **[🎨 UI デザインガイドライン](./docs/DESIGN_GUIDELINES.md)**
  - 配色（Color Palette）、タイポグラフィ、フォーム要素、ボタン、リストなどのスタイル定義。
  - 一貫性のある美しい UI を実現するための基準を定めています。

- **[📝 ドキュメント・コメントガイドライン](./docs/DOCUMENTATION_GUIDELINES.md)**
  - JSDoc の記述ルール、インラインコメントの方針について。
  - コードの可読性と保守性を高めるための基準を定めています。

## 📄 ライセンス

[GNU Affero General Public License v3.0 (AGPL v3)](./LICENSE)
