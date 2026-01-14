import { createRoot } from 'react-dom/client';
import DashboardSummary from '../components/DashboardSummary.jsx';

/**
 * ダッシュボードの資産サマリコンポーネントを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素ID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderDashboardSummary(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<DashboardSummary {...props} />);
}
