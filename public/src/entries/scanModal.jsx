import { createRoot } from 'react-dom/client';
import ScanModal from '../components/ScanModal.jsx';

let root = null;

// Callbacks to fetching latest data from main.js
let appGetLuts = () => ({ accounts: new Map(), categories: new Map() });
let appGetConfig = () => ({});
let appOnSave = async () => {};

// State
let isOpen = false;

// Initialize is called once from main.js loadScanModule
export function init({ getConfig, getLuts, onSave }) {
    if (getConfig) appGetConfig = getConfig;
    if (getLuts) appGetLuts = getLuts;
    if (onSave) appOnSave = onSave;
}

export function openModal() {
    isOpen = true;
    updateRender();
}

export function closeModal() {
    isOpen = false;
    updateRender();
}

function updateRender() {
    const container = document.getElementById('scan-modal-root');
    if (!container) return;
    
    if (!root) {
        root = createRoot(container);
    }

    // Always fetch fresh data on render
    const luts = appGetLuts();
    const config = appGetConfig();
    const scanSettings = config ? config.scanSettings : {};

    root.render(
        <ScanModal
            isOpen={isOpen}
            onClose={closeModal}
            luts={luts}
            scanSettings={scanSettings}
            onSave={appOnSave}
        />
    );
}

// Ensure compatibility if anything calls initData
export const initData = init;
