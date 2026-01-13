import { createRoot } from 'react-dom/client';
import AccountBalances from '../components/AccountBalances.jsx';

/**
 * Renders the AccountBalances component into the specified element.
 * @param {string} elementId - The ID of the DOM element to render into.
 * @param {object} props - The props to pass to the component.
 */
export function renderAccountBalances(elementId, props) {
    const container = document.getElementById(elementId);
    if (!container) return;

    // Destroy existing root if any (managed by react-dom/client usually, but here we just re-render)
    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<AccountBalances {...props} />);
}
