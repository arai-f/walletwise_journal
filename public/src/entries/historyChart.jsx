import { createRoot } from 'react-dom/client';
import HistoryChart from '../components/HistoryChart';

let chartRoot = null;

/**
 * 資産推移チャートを指定されたDOM要素にレンダリングする。
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderHistoryChart(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!chartRoot) {
        chartRoot = createRoot(container);
    }    
    chartRoot.render(<HistoryChart {...props} />);
}
