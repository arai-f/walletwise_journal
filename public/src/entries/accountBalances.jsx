import { createRoot } from 'react-dom/client';
import AccountBalances from '../components/AccountBalances.jsx';

/**
 * 口座残高一覧コンポーネントを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素ID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @return {void}
 */
export function renderAccountBalances(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<AccountBalances {...props} />);
}
