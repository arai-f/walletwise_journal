/**
 * AIアドバイザーのReactコンポーネントをマウントするためのエントリーポイント。
 * 従来のDOM操作ベースのコードからReactコンポーネントを呼び出すためのブリッジとして機能する。
 * @module entries/advisor
 */
import { createRoot } from 'react-dom/client';
import Advisor from '../components/Advisor';

/**
 * AIアドバイザーのReactルートインスタンス。
 * シングルトンとして保持し、再レンダリング時に再利用する。
 * @type {import('react-dom/client').Root | null}
 */
let advisorRoot = null;

/**
 * AIアドバイザーコンポーネントを指定されたDOM要素にレンダリングする。
 * 既にルートが作成されている場合は、再レンダリング（アップデート）を行う。
 * 
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - Advisorコンポーネントに渡すプロパティ。
 * @param {object} props.config - アプリケーション設定。
 * @param {Array} props.transactions - 取引データの配列。
 * @param {Map|Object} props.categories - カテゴリデータ。
 * @returns {void}
 */
export function renderAdvisor(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!advisorRoot) {
        advisorRoot = createRoot(container);
    }
    
    advisorRoot.render(<Advisor {...props} />);
}
