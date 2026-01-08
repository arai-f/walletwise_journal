<h1 align="center">WalletWise Journal <img src="./public/favicon/favicon.ico" alt="WalletWise Journal logo" width="24"/></h1>

<p align="center">
WalletWise Journalは、モダンなUIであなたのお金の流れをシンプルに記録・管理できる、高機能なシングルページアプリケーション（SPA）の家計簿です。FirebaseとVanilla JavaScriptで構築されており、PWAとしてホーム画面に追加してネイティブアプリのように使用することを想定しています。
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

- **リアルタイム資産推移**:
  - 長期的な資産の増減トレンドを可視化。純資産・収入・支出の推移を複合グラフで表示し、資産形成のモチベーションを高めます。
- **多角的なレポート**:
  - **月次レポート**: 収入と支出のバランスが直感的にわかる「筆算形式サマリー」と、カテゴリ別ランキングを搭載。
  - **年間収支**: 過去 5 年分のデータを集計。確定申告にも使える CSV エクスポート機能付き。
- **ホーム（資産一覧）**:
  - 現在の「総資産」「純資産」と、全口座の最新残高を一目で把握できるシンプルなダッシュボード。

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

| カテゴリ      | 詳細                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**  | ![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)                                                                                                                            |
| **Backend**   | ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white) (Auth, Firestore, Cloud Functions, Hosting, App Check)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **AI / ML**   | ![Vertex AI](https://img.shields.io/badge/Vertex_AI-%234285F4.svg?style=for-the-badge&logo=google-cloud&logoColor=white) (Gemini 2.5 Flash)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Libraries** | ![Chart.js](https://img.shields.io/badge/chart.js-F5788D.svg?style=for-the-badge&logo=chart.js&logoColor=white) ![SortableJS](https://img.shields.io/badge/SortableJS-3068b2.svg?style=for-the-badge&logo=javascript&logoColor=white) ![date-fns](https://img.shields.io/badge/date--fns-770C56.svg?style=for-the-badge&logo=javascript&logoColor=white) <br> ![Viewer.js](https://img.shields.io/badge/Viewer.js-009688?style=for-the-badge&logo=javascript&logoColor=white) ![Font Awesome](https://img.shields.io/badge/Font_Awesome-528DD7?style=for-the-badge&logo=font-awesome&logoColor=white) |
| **DevOps**    | ![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 🚀 セットアップ方法

1.  **リポジトリをクローン:**

    ```bash
    git clone [https://github.com/arai-f/walletwise_journal.git](https://github.com/arai-f/walletwise_journal.git)
    cd walletwise_journal
    ```

2.  **Firebase プロジェクトの作成:**

    - [Firebase コンソール](https://console.firebase.google.com/)で新しいプロジェクトを作成します。
    - ウェブアプリを追加し、Firebase SDK の設定値（`firebaseConfig`）を取得します。
    - **Authentication**を有効化し、「Google」をログインプロバイダとして追加します。
    - **Firestore Database**を有効化します。
    - **App Check**を開始し、reCAPTCHA v3 のサイトキーを取得・登録します。
    - **Vertex AI**を有効化します。
    - **Cloud Functions を有効化**します（Node.js ランタイムを使用するため、プロジェクトを **Blaze プラン（従量課金）** にアップグレードする必要があります。※無料枠の範囲内であれば課金は発生しません）

3.  **設定ファイルの作成 (ローカル開発用):**

    - `public/js/` ディレクトリ内に `firebase-config.js` というファイルを新規作成します。
    - 以下のコードを貼り付け、あなたの Firebase プロジェクトの設定値と reCAPTCHA サイトキーを入力してください。

    ```javascript
    // public/js/firebase-config.js

    export const firebaseConfig = {
    	apiKey: "YOUR_API_KEY",
    	authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    	projectId: "YOUR_PROJECT_ID",
    	storageBucket: "YOUR_PROJECT_ID.appspot.com",
    	messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    	appId: "YOUR_APP_ID",
    	measurementId: "YOUR_MEASUREMENT_ID",
    };

    export const recaptchaSiteKey = "YOUR_RECAPTCHA_SITE_KEY";
    export const isLocalDevelopment = true;
    ```

4.  **ローカル開発環境の設定:**

    - ローカル（`localhost`）で実行する場合、ブラウザのコンソールに出力される **App Check デバッグトークン** を Firebase コンソールの [App Check] > [アプリ] > [デバッグトークンの管理] に登録してください。
    - これを行わないと、ローカル環境からの AI 呼び出しやデータベースアクセスがブロックされます。

5.  **Cloud Functions のデプロイ (必須):**

    残高の自動計算ロジックをサーバーに反映させるため、以下のコマンドを実行します。

    ```bash
    # Functionsの依存関係をインストール
    cd functions
    npm install
    cd ..

    # Cloud Functions をデプロイ
    firebase deploy --only functions
    ```

6.  **ローカルサーバーで起動:**

    - VSCode の Live Server などを使って `public` ディレクトリをルートとして起動します。

## Firestore の構造

- `transactions`: すべての取引記録。
- `user_accounts/{userId}`: ユーザーごとの口座情報（LUT）。
- `user_categories/{userId}`: ユーザーごとのカテゴリ情報（LUT）。
- `user_configs/{userId}`: クレジットカードルールなどのユーザーごとの設定。
- `account_balances/{userId}`: 各口座の残高。

## 🛠️ コーディングガイドライン

- **[🎨 UI デザインガイドライン](./docs/DESIGN_GUIDELINES.md)**

  - 配色（Color Palette）、タイポグラフィ、フォーム要素、ボタン、リストなどのスタイル定義。
  - 一貫性のある美しい UI を実現するための基準を定めています。

- **[📝 ドキュメント・コメントガイドライン](./docs/DOCUMENTATION_GUIDELINES.md)**
  - JSDoc の記述ルール、インラインコメントの方針について。
  - コードの可読性と保守性を高めるための基準を定めています。

## 📄 ライセンス

[MIT ライセンス](https://opensource.org/licenses/MIT)
