<h1 align="center">WalletWise Journal <img src="./public/favicon/favicon.ico" alt="WalletWise Journal logo" width="24"/></h1>

<p align="center">
WalletWise Journalは、モダンなUIであなたのお金の流れをシンプルに記録・管理できる、高機能なシングルページアプリケーション（SPA）の家計簿です。FirebaseとVanilla JavaScriptで構築されており、PWAとしてホーム画面に追加してネイティブアプリのように使用することを想定しています。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Gemini-2.0_Flash-8E75B2?style=for-the-badge&logo=google-gemini&logoColor=white" alt="Powered by Gemini 2.0 Flash">
  <img src="https://img.shields.io/badge/Firebase-App_Check-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Secured by App Check">
</p>

## ✨ 主な機能

- **🤖 AI スキャン入力 (New!)**:
  - **Gemini 2.0 Flash** を搭載。レシートや明細書の画像を撮影するだけで、日付・金額・店名・カテゴリを AI が瞬時に解析して自動入力。
  - 拡大・移動が自由自在な高機能ビューワーで、画像を確認しながら編集可能。
- **🔐 強固なセキュリティ**:
  - **Firebase App Check (reCAPTCHA v3)** により、不正なアクセスや Bot から API を保護。
  - **Firestore セキュリティルール** でデータの整合性とアクセス権を厳格に管理。
- **認証機能**: Google アカウントを使った安全なログイン。
- **取引の記録**: 直感的な UI で「支出」「収入」「振替」を簡単に追加・編集・削除。
- **ダッシュボード**:
  - 純資産、総資産、月ごとの収支が一目でわかるデザイン。
  - 純資産・総収入・総支出の推移を示すインタラクティブな複合グラフ。
- **口座管理**:
  - 現金、銀行、電子マネーなどの「資産」と、クレジットカードなどの「負債」を管理。
  - 各口座にアイコンを設定可能。ドラッグ＆ドロップで並べ替えも自由自在。
- **カテゴリ管理**:
  - 収入・支出のカテゴリを自由に追加・編集・削除。並べ替えも可能。
- **クレジットカード支払い管理**:
  - カードごとの締め日、支払日、支払元口座を設定すると、「次回の支払い予定」を自動計算してダッシュボードに表示。
- **高度な設定機能**:
  - **残高調整**: 実際の残高とのズレをワンクリックで修正。
  - **表示期間設定**: パフォーマンスとコストを考慮し、データの読み込み期間を選択可能。
- **オフライン対応**:
  - Firestore のオフライン永続化により、電波の悪い場所でも閲覧・入力が可能。
- **レスポンシブデザイン**: PC、タブレット、スマホ、あらゆるデバイスで快適な操作性。

## 🛠️ 使用技術

| カテゴリ      | 詳細                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**  | ![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white) |
| **Backend**   | ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white) (Auth, Firestore, Hosting, App Check)                                                                                                                                                                                                                                                                                                                   |
| **AI / ML**   | ![Vertex AI](https://img.shields.io/badge/Vertex_AI-%234285F4.svg?style=for-the-badge&logo=google-cloud&logoColor=white) (**Gemini 2.0 Flash**)                                                                                                                                                                                                                                                                                                                            |
| **Libraries** | ![Chart.js](https://img.shields.io/badge/chart.js-F5788D.svg?style=for-the-badge&logo=chart.js&logoColor=white) ![SortableJS](https://img.shields.io/badge/SortableJS-3068b2.svg?style=for-the-badge&logo=javascript&logoColor=white) ![date-fns](https://img.shields.io/badge/date--fns-770C56.svg?style=for-the-badge&logo=javascript&logoColor=white)                                                                                                                   |
| **DevOps**    | ![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)                                                                                                                                                                                                                                                                                                                                      |

## 🚀 セットアップ方法

1.  **リポジトリをクローン:**

    ```bash
    git clone [https://github.com/arai-f/walletwise_journal.git](https://github.com/arai-f/walletwise_journal.git)
    cd walletwise_journal
    ```

2.  **Firebase プロジェクトの作成:**

    - [Firebase コンソール](https://console.firebase.google.com/)で新しいプロジェクトを作成します。
    - ウェブアプリを追加し、Firebase SDK の`firebaseConfig`オブジェクトを取得します。
    - **Authentication**を有効化し、「Google」をログインプロバイダとして追加します。
    - **Firestore Database**を有効化します。
    - **App Check**を開始し、reCAPTCHA v3 のサイトキーを取得・登録します。
    - **Vertex AI**を有効化します（Blaze プランへのアップグレードが必要な場合があります）。

3.  **Firebase 設定ファイルの作成:**

    - `public/js/firebase.template.js`をコピーして、`public/js/firebase.js`という名前の新しいファイルを作成します。
    - `firebase.js`内のプレースホルダー（`__API_KEY__`など）を、あなたの Firebase プロジェクトの`firebaseConfig`の値で置き換えます。
    - `public/js/firebase.js` 内の `YOUR_RECAPTCHA_SITE_KEY` を取得したサイトキーに置き換えます。
    - `public/index.html` 内の reCAPTCHA スクリプトタグの `render=...` 部分もサイトキーに置き換えます。

4.  **ローカル開発環境の設定:**

    - ローカルで実行する場合、ブラウザのコンソールに出力される **App Check デバッグトークン** を Firebase コンソールに登録してください。これを行わないと、ローカルからの AI 呼び出しや DB アクセスがブロックされます。

5.  **ローカルサーバーで起動:**

    - VSCode の Live Server などを使って `public` ディレクトリをルートとして起動します。

## Firestore の構造

- `transactions`: すべての取引記録。
- `user_accounts/{userId}`: ユーザーごとの口座情報（LUT）。
- `user_categories/{userId}`: ユーザーごとのカテゴリ情報（LUT）。
- `user_configs/{userId}`: クレジットカードルールなどのユーザーごとの設定。
- `account_balances/{userId}`: 各口座の残高。

## 📄 ライセンス

[MIT ライセンス](https://opensource.org/licenses/MIT)
