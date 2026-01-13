/**
 * 資産推移チャートのReactコンポーネントをマウントするためのエントリーポイント。
 * @module entries/historyChart
 */
import { createRoot } from 'react-dom/client';
import HistoryChart from '../components/HistoryChart';

/**
 * チャートのReactルートインスタンスのキャッシュ。
 * @type {import('react-dom/client').Root | null}
 */
let chartRoot = null;

/**
 * 資産推移チャートを指定されたDOM要素にレンダリングする。
 * 
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 * @param {Array<object>} props.historicalData - 月次履歴データ。
 * @param {boolean} props.isMasked - マスク表示フラグ。
 * @returns {void}
 */
export function renderHistoryChart(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!chartRoot) {
        chartRoot = createRoot(container);
    }
    
    chartRoot.render(<HistoryChart {...props} />);
}
