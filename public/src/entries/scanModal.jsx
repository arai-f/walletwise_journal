import { createRoot } from 'react-dom/client';
import ScanModal from '../components/ScanModal.jsx';

let scanModalRoot = null;

let appGetLuts = () => ({ accounts: new Map(), categories: new Map() });
let appGetConfig = () => ({});
let appOnSave = async () => {};

let isOpen = false;

/**
 * スキャンモーダルを初期化し、イベントハンドラを設定する。
 * アプリケーションからのデータ取得関数やコールバックを設定する。
 * @param {object} params
 * @param {Function} params.getConfig - 設定取得関数。
 * @param {Function} params.getLuts - LUT取得関数。
 * @param {Function} params.onSave - 保存時コールバック。
 */
export function init({ getConfig, getLuts, onSave }) {
    if (getConfig) appGetConfig = getConfig;
    if (getLuts) appGetLuts = getLuts;
    if (onSave) appOnSave = onSave;
}

/**
 * スキャンモーダルを開く。
 */
export function openModal() {
    isOpen = true;
    updateRender();
}

/**
 * スキャンモーダルを閉じる。
 */
export function closeModal() {
    isOpen = false;
    updateRender();
}

/**
 * スキャンモーダルを更新する。
 */
function updateRender() {
    const container = document.getElementById('scan-modal-root');
    if (!container) return;
    
    if (!scanModalRoot) {
        scanModalRoot = createRoot(container);
    }

    // レンダリング時に常に最新データを取得する
    const luts = appGetLuts();
    const config = appGetConfig();
    const scanSettings = config ? config.scanSettings : {};

    scanModalRoot.render(
        <ScanModal
            isOpen={isOpen}
            onClose={closeModal}
            luts={luts}
            scanSettings={scanSettings}
            onSave={appOnSave}
        />
    );
}

// 後方互換性のため
export const initData = init;
