import { createRoot } from 'react-dom/client';
import Advisor from '../components/Advisor';

let advisorRoot = null;

/**
 * AIアドバイザーコンポーネントを指定されたDOM要素にレンダリングする。
 * 既にルートが作成されている場合は、再レンダリング（アップデート）を行う。
 * @param {string} containerId - マウント対象のDOM要素のID。
 * @param {object} props - コンポーネントに渡すプロパティ。
 */
export function renderAdvisor(containerId, props) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!advisorRoot) {
        advisorRoot = createRoot(container);
    }
    advisorRoot.render(<Advisor {...props} />);
}
