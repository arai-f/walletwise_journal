import { createRoot } from 'react-dom/client';
import BillingList from '../components/BillingList.jsx';

/**
 * 請求予定リストコンポーネントを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素ID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderBillingList(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<BillingList {...props} />);
}
