import { createRoot } from 'react-dom/client';
import BillingList from '../components/BillingList.jsx';

/**
 * Renders the BillingList component.
 * @param {string} elementId - The DOM element ID.
 * @param {object} props - Component props.
 */
export function renderBillingList(elementId, props) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<BillingList {...props} />);
}
