<h1 align="center">WalletWise Journal <img src="./public/favicon/favicon.ico" alt="InOculus logo" width="24"/></h1>

<p align="center">
WalletWise Journalは、モダンなUIであなたのお金の流れをシンプルに記録・管理できる、高機能なシングルページアプリケーション（SPA）の家計簿です。FirebaseとVanilla JavaScriptで構築されており、PWAとしてホーム画面に追加してネイティブアプリのように使用することを想定しています。
</p>

## ✨ 主な機能

- **認証機能**: Google アカウントを使った安全なログイン。
- **取引の記録**: 直感的な UI で「支出」「収入」「振替」を簡単に追加・編集・削除。
- **ダッシュボード**:
  - 純資産、総資産、月ごとの収支を一目で把握。
  - 純資産・総収入・総支出の推移を示すインタラクティブな複合グラフ。
- **口座管理**:
  - 現金、銀行、電子マネーなどの「資産」と、クレジットカードなどの「負債」を管理。
  - 各口座にアイコンを設定可能。
  - ドラッグ＆ドロップで自由自在に並べ替え。
- **カテゴリ管理**:
  - 収入・支出のカテゴリを自由に追加・編集・削除。
  - ドラッグ＆ドロップで並べ替え可能。
- **クレジットカード支払い管理**:
  - カードごとの締め日、支払日、支払元口座を詳細に設定。
  - 設定に基づき、「次回の支払い予定」をダッシュボードに自動で計算・表示。
- **高度な設定機能**:
  - **残高調整**: 実際の残高とのズレをワンクリックで修正。
  - **表示期間設定**: パフォーマンスとコストを考慮し、データの読み込み期間を選択可能。
- **使い方ガイド**: いつでも参照できる、詳細な機能説明書。
- **ローカル開発モード**: Firebase に接続せず、ローカルの JSON ファイルだけで開発・デバッグが可能。
- **レスポンシブデザイン**: PC からスマホまで、あらゆるデバイスで快適な操作を提供。

## 🛠️ 使用技術

| カテゴリ      | 詳細                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**  | ![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E) ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white) |
| **Backend**   | ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase&logoColor=white)                                                                                                                                                                                                                                                                                                                                                         |
| **Libraries** | ![Chart.js](https://img.shields.io/badge/chart.js-F5788D.svg?style=for-the-badge&logo=chart.js&logoColor=white) ![SortableJS](https://img.shields.io/badge/SortableJS-3068b2.svg?style=for-the-badge&logo=javascript&logoColor=white)                                                                                                                                                                                                                                      |
| **DevOps**    | ![GitHub Actions](https://img.shields.io/badge/github%20actions-%232671E5.svg?style=for-the-badge&logo=githubactions&logoColor=white)                                                                                                                                                                                                                                                                                                                                      |
| **Editor**    | ![Visual Studio Code](https://img.shields.io/badge/Visual%20Studio%20Code-0078d7.svg?style=for-the-badge&logo=visual-studio-code&logoColor=white)                                                                                                                                                                                                                                                                                                                          |

## 🚀 セットアップ方法

1.  **リポジトリをクローン:**

    ```bash
    git clone https://github.com/arai-f/walletwise_journal.git
    cd walletwise_journal
    ```

2.  **Firebase プロジェクトの作成:**

    - [Firebase コンソール](https://console.firebase.google.com/)で新しいプロジェクトを作成します。
    - ウェブアプリを追加し、Firebase SDK の`firebaseConfig`オブジェクトを取得します。
    - **Authentication**を有効化し、「Google」をログインプロバイダとして追加します。
    - **Firestore Database**を有効化します。

3.  **Firebase 設定ファイルの作成:**

    - `public/js/firebase.template.js`をコピーして、`public/js/firebase.js`という名前の新しいファイルを作成します。
    - `firebase.js`内のプレースホルダー（`__API_KEY__`など）を、あなたの Firebase プロジェクトの`firebaseConfig`の値で置き換えます。

    <!-- end list -->

    ```javascript
    // public/js/firebase.js

    const firebaseConfig = {
    	apiKey: "YOUR_API_KEY",
    	authDomain: "YOUR_AUTH_DOMAIN",
    	projectId: "YOUR_PROJECT_ID",
    	// ...
    };
    ```

4.  **ローカルサーバーで起動:**

    - VSCode の[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)などの拡張機能を使って、`public`ディレクトリをルートとしてサーバーを起動します。
    - `public/index.html`にアクセスすると、アプリが表示されます。

## Firestore の構造

このアプリケーションは、以下のコレクションを使用します。

- `transactions`: すべての取引記録。
- `user_accounts/{userId}`: ユーザーごとの口座情報（LUT）。
- `user_categories/{userId}`: ユーザーごとのカテゴリ情報（LUT）。
- `user_configs/{userId}`: クレジットカードルールなどのユーザーごとの設定。
- `account_balances/{userId}`: 各口座の残高。

## 📄 ライセンス

このプロジェクトは[MIT ライセンス](https://opensource.org/licenses/MIT)の下で公開されています。
