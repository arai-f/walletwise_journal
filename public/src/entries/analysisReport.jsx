import { createRoot } from 'react-dom/client';
import AnalysisReport from '../components/AnalysisReport.jsx';

/**
 * Renders the AnalysisReport component.
 * @param {string} elementId - DOM Element ID.
 * @param {object} props - Component Props.
 */
export function renderAnalysisReport(elementId, props) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (!container._reactRoot) {
        container._reactRoot = createRoot(container);
    }
    container._reactRoot.render(<AnalysisReport {...props} />);
}
