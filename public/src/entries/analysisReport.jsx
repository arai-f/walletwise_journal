import { createRoot } from 'react-dom/client';
import AnalysisReport from '../components/AnalysisReport.jsx';

/**
 * 分析レポートコンポーネントを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素ID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderAnalysisReport(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<AnalysisReport {...props} />);
}
