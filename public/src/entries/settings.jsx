import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SettingsModal from '../components/Settings/SettingsModal';

let setModalOpen;
let pendingOpen = false;

function SettingsContainer({ dependencies }) {
    const [isOpen, setIsOpen] = useState(false);
    
    useEffect(() => {
        setModalOpen = setIsOpen;
        if (pendingOpen) {
            setIsOpen(true);
            pendingOpen = false;
        }
    }, []);

    return (
        <SettingsModal 
            isOpen={isOpen} 
            onClose={() => setIsOpen(false)} 
            {...dependencies} 
        />
    );
}

export function init(dependencies) {
    const container = document.getElementById('settings-root');
    if (!container) {
        console.error("Settings root element not found");
        return;
    }
    // Check if already initialized to avoid double render if init called twice? 
    // React 18 createRoot warns if you createRoot on container that already has root.
    // But here we might just want to render once.
    if (!container._reactRoot) {
        const root = createRoot(container);
        container._reactRoot = root;
        root.render(<SettingsContainer dependencies={dependencies} />);
    }
}

export function openModal() {
    if (setModalOpen) {
        setModalOpen(true);
    } else {
        pendingOpen = true;
    }
}

export function closeModal() {
    if (setModalOpen) setModalOpen(false);
}

export function isOpen() {
    const root = document.getElementById('settings-root');
    return !!root && root.children.length > 0;
}
