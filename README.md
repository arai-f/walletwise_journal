<h1 align="center">WalletWise Journal <img src="./public/favicon/favicon.ico" alt="WalletWise Journal logo" width="24"/></h1>

<p align="center">
WalletWise Journalは、モダンなUIであなたのお金の流れをシンプルに記録・管理できる、高機能なシングルページアプリケーション（SPA）の家計簿です。FirebaseとReact (Vite)で構築されており、PWAとしてホーム画面に追加してネイティブアプリのように使用することを想定しています。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Gemini-2.5_Flash-8E75B2?style=for-the-badge&logo=google-gemini&logoColor=white" alt="Powered by Gemini 2.5 Flash">
  <img src="https://img.shields.io/badge/Firebase-App_Check-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Secured by App Check">
</p>

## ✨ 主な機能

### 🤖 AI パートナー機能

- **AI アドバイザー (Chatbot)**:
  - **専属 FP のような対話体験**: 「先月より使いすぎ？」「食費の内訳を教えて」など、自然な会話で家計状況を確認・相談できます。
  - **コンテキスト認識**: 設定した表示期間のデータに基づいて分析を行うため、直近の家計状況に即した的確なアドバイスが可能です。
- **AI スキャン入力**:
  - **Gemini 2.5 Flash 搭載**: レシートや明細書の画像を撮影するだけで、日付・金額・店名・カテゴリを AI が瞬時に解析して自動入力。
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

| カテゴリ      | 詳細                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend**  | ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white) ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)             |
| **Backend**   | ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white)                                                                                                                                                                                                                                                                                                                                                        |
| **AI / ML**   | ![Vertex AI](https://img.shields.io/badge/Vertex_AI-%234285F4.svg?style=for-the-badge&logo=google-cloud&logoColor=white)                                                                                                                                                                                                                                                                                                                                                  |
| **Libraries** | ![Recharts](https://img.shields.io/badge/Recharts-22b5bf?style=for-the-badge&logo=react&logoColor=white) ![SortableJS](https://img.shields.io/badge/SortableJS-3068b2.svg?style=for-the-badge&logo=javascript&logoColor=white) ![date-fns](https://img.shields.io/badge/date--fns-770C56.svg?style=for-the-badge&logo=javascript&logoColor=white) ![Font Awesome](https://img.shields.io/badge/Font_Awesome-528DD7?style=for-the-badge&logo=font-awesome&logoColor=white) |
| **DevOps**    | ![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)                                                                                                                                                                                                                                                                                                                                     |

## 🚀 セットアップ方法

### 1. 前提ツールのインストール

#### Node.js のインストール

本プロジェクトは `functions/package.json` で **Node.js v22** を指定しています。

- **Mac:**
  - `nodenv` や `nvm` などのバージョン管理ツールを使用してインストールすることを推奨します。
  - 例: `nodenv install 22.x.x`
- **Windows:**
  - **nvm-windows** を使用することを強く推奨します。公式サイトのインストーラーを直接使うと、バージョンの切り替えが困難になります。
  - nvm-windows リリースぺージ から `nvm-setup.exe` をダウンロードしてインストール。
  - コマンド: `nvm install 22` -> `nvm use 22`

#### Java Development Kit (JDK) のインストール

Firebase エミュレータ（Firestore, Auth, Functions 等のローカル実行環境）を動かすために **Java** が必須です。

- **Mac:**
  - `brew install openjdk@11` など。
- **Windows:**
  - Oracle の JDK または OpenJDK をインストールし、環境変数 `JAVA_HOME` を設定してください。
  - これがないと `firebase emulators:start` でエラーになります。

### 2. Firebase CLI のセットアップ

```bash
npm install -g firebase-tools
firebase login
```

ブラウザが開き、Google アカウントでの認証を求められます。

### 3. プロジェクトのセットアップ

1.  **リポジトリをクローン:**

    ```bash
    git clone https://github.com/arai-f/walletwise_journal.git
    cd walletwise_journal
    ```

2.  **依存関係のインストール:**
    ルートディレクトリと `functions` ディレクトリの両方でインストールが必要です。

    ```bash
    # ルートディレクトリ (フロントエンド等)
    npm install

    # Functions (バックエンド)
    cd functions
    npm install
    cd ..
    ```

### 4. Firebase プロジェクトの作成と設定

1.  Firebase コンソールで新しいプロジェクトを作成します。
2.  以下の機能を有効化・設定します：
    - **Authentication**: 「Google」をログインプロバイダとして追加。
    - **Firestore Database**: データベースを作成。
    - **App Check**: reCAPTCHA v3 のサイトキーを取得・登録。
    - **Vertex AI**: 有効化。
    - **Cloud Messaging**: 有効化。
    - **Cloud Functions**: 有効化（Blaze プランへのアップグレードが必要）。
3.  ウェブアプリを追加し、Firebase SDK の設定値（`firebaseConfig`）を取得します。

### 5. 環境設定ファイルの作成

`public/src/firebase-config.js` を作成し、Firebase コンソールの設定値を貼り付けます（このファイルは `.gitignore` 対象です）。

```javascript
// public/src/firebase-config.js

export const firebaseConfig = {
	apiKey: "YOUR_API_KEY",
	authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
	projectId: "YOUR_PROJECT_ID",
	storageBucket: "YOUR_PROJECT_ID.appspot.com",
	messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
	appId: "YOUR_APP_ID",
	measurementId: "YOUR_MEASUREMENT_ID",
};

// ローカル開発用の設定
export const recaptchaSiteKey = "YOUR_RECAPTCHA_SITE_KEY";
export const vapidKey = "YOUR_VAPID_KEY"; // Cloud Messaging用
export const isLocalDevelopment = true; // ローカルでは true にする
```

### 6. ローカルサーバーの起動

開発には「バックエンド（Firebase エミュレータ）」と「フロントエンド（Vite）」の両方を起動する必要があります。

**A. Firebase エミュレータの起動 (バックエンド)**
Firestore, Auth, Functions をローカルでエミュレートします。

```bash
# プロジェクトルートで実行
firebase emulators:start --only=auth,functions,firestore --import=./firebase-data --export-on-exit
```

- **Mac:** そのまま実行可能です。
- **Windows:** PowerShell のセキュリティ設定によりエラーになる場合、管理者権限で以下を実行して許可を与えてください。
  ```PowerShell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **App Check デバッグトークン:** 初回起動時、ブラウザのコンソールに出力されるトークンを Firebase コンソールの「App Check > アプリ > デバッグトークンの管理」に登録してください。これを行わないと、ローカル環境からの AI 呼び出しやデータベースアクセスがブロックされます。

**B. 開発サーバーの起動 (フロントエンド)**
別のターミナルを開いて実行します。

```bash
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスしてください。

### 7. 本番環境へのデプロイ

残高の自動計算ロジック（Cloud Functions）やフロントエンドを本番環境へ反映させます。

**Cloud Functions の準備 (初回または依存関係変更時):**

```bash
cd functions
npm install
cd ..
```

**ビルドとデプロイ:**

```bash
npm run build
firebase deploy
```

※ `firebase deploy` は Hosting、Firestore、Functions など全てをデプロイします。

### 💡 OS 間の主な差異と注意点

#### A. 改行コード (Line Endings)

Git の設定によっては、Windows でチェックアウトした際に改行コードが CRLF に変換され、ESLint 等でエラーになる可能性があります。

- **対策:** Git の設定で `autocrlf` を `false` または `input` に設定し、コード上は `LF` で統一することを推奨します。
  ```bash
  git config --global core.autocrlf false
  ```

#### B. 環境変数の設定方法

コマンドラインで環境変数を設定する場合、OS によって構文が異なります。

- **Mac (Bash/Zsh):** `MY_VAR=123 npm start`
- **Windows (PowerShell):** `$env:MY_VAR="123"; npm start`
- **共通化:** `cross-env` パッケージを使用すると両 OS に対応できます。

#### C. ファイルパスの区切り文字

- JavaScript (`import` や `require`) 内では `/` (スラッシュ) が両 OS で使えます。
- Node.js でファイルパスを操作する場合、Windows は `\` (バックスラッシュ) を使うため、`path.join()` モジュールを使って吸収する必要があります。

## Firestore の構造

- `account_balances`: 各口座の最新残高。
- `notifications`: プッシュ通知の登録情報。
- `processed_events`: Cloud Functions が処理済みのイベント ID を保存し、重複処理を防止（定期的にクリーンアップが必要）。
- `transactions`: すべての取引記録。
- `user_accounts`: ユーザーごとの口座情報（LUT）。
- `user_categories`: ユーザーごとのカテゴリ情報（LUT）。
- `user_configs`: クレジットカードルールなどのユーザーごとの設定。
- `user_fcm_tokens`: プッシュ通知のデバイストークン。

## 🛠️ コーディングガイドライン

- **[🎨 UI デザインガイドライン](./docs/DESIGN_GUIDELINES.md)**
  - 配色（Color Palette）、タイポグラフィ、フォーム要素、ボタン、リストなどのスタイル定義。
  - 一貫性のある美しい UI を実現するための基準を定めています。

- **[📝 ドキュメント・コメントガイドライン](./docs/DOCUMENTATION_GUIDELINES.md)**
  - JSDoc の記述ルール、インラインコメントの方針について。
  - コードの可読性と保守性を高めるための基準を定めています。

## 📄 ライセンス

[GNU Affero General Public License v3.0 (AGPL v3)](./LICENSE)
