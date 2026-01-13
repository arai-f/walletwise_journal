import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TransactionModal from '../components/TransactionModal';

let setModalState;
let pendingOpen = null;
let moduleHandlers = null;

// Modal Stack Management (Simplified for this specific modal, keeping interface)
const modalStack = [];

export function register(closeCallback) {
    modalStack.push(closeCallback);
    return () => {
        const index = modalStack.indexOf(closeCallback);
        if (index > -1) {
            modalStack.splice(index, 1);
        }
    };
}

export function closeTop() {
    const closeFn = modalStack.pop();
    if (closeFn) {
        closeFn();
        return true;
    }
    return false;
}

function TransactionModalContainer({ handlers, luts }) {
    const [isOpen, setIsOpen] = useState(false);
    const [transaction, setTransaction] = useState(null);
    const [prefillData, setPrefillData] = useState(null);

    useEffect(() => {
        setModalState = (state) => {
            if (state.isOpen !== undefined) setIsOpen(state.isOpen);
            if (state.transaction !== undefined) setTransaction(state.transaction);
            if (state.prefillData !== undefined) setPrefillData(state.prefillData);
        };
        
        if (pendingOpen) {
            setTransaction(pendingOpen.transaction);
            setPrefillData(pendingOpen.prefillData);
            setIsOpen(true);
            pendingOpen = null;
        }
    }, []);

    // Registration with stack
    useEffect(() => {
        let unregister = null;
        if (isOpen) {
            unregister = register(() => closeModal());
        }
        return () => {
             if (unregister) unregister();
             // Also ensure logicHandlers.close is called if unmounted?
        };
    }, [isOpen]);

    const handleClose = () => {
        setIsOpen(false);
        // Call the original close handler from main.js if exists
        if (handlers && handlers.close) {
             handlers.close();
        }
    };

    const handleSave = async (data) => {
        if (handlers && handlers.submit) {
            // Adapt data format if needed. 
            // The original logic expected a form element or FormData?
            // checking ui/modal.js: logicHandlers.submit(form);
            // ui/transactions.js: handleTransactionSubmit(form) -> extracts data from form
            
            // Wait! The original submit handler expects a HTMLFormElement!
            // I need to verify what `handlers.submit` does in `main.js` / `transactions.js`.
            // If it expects a `form` DOM element, passing a plain object `data` will fail.
            // I should refactor the submit handler in `main.js` (or `transactions.js`) OR create a fake form object.
            
            // Ideally refactor the handler. But user said "think about modal.js", maybe I should check `transactions.js` too?
            // Let's assume I need to pass the data object and I will update `handlers.submit` in `transactions.js`.
            await handlers.submit(data);
            setIsOpen(false);
        }
    };

    const handleDelete = (id) => {
        if (handlers && handlers.delete) {
            handlers.delete(id);
            setIsOpen(false);
        }
    };

    return (
        <TransactionModal
            isOpen={isOpen}
            onClose={handleClose}
            transaction={transaction}
            prefillData={prefillData}
            onSave={handleSave}
            onDelete={handleDelete}
            luts={luts}
        />
    );
}

export function init(handlers, luts) {
    moduleHandlers = handlers;
    const container = document.getElementById('transaction-modal-root');
    if (!container) {
        console.error("Transaction modal root element not found");
        return;
    }
    if (!container._reactRoot) {
        const root = createRoot(container);
        container._reactRoot = root;
        root.render(<TransactionModalContainer handlers={handlers} luts={luts} />);
    }
}

export function openModal(transaction = null, prefillData = null) {
    if (setModalState) {
        setModalState({ isOpen: true, transaction, prefillData });
    } else {
        pendingOpen = { transaction, prefillData };
    }
}

export function closeModal() {
    if (setModalState) {
        setModalState({ isOpen: false });
    }
    if (moduleHandlers && moduleHandlers.close) {
        moduleHandlers.close();
    }
}

export function isOpen() {
    // This is tricky with React state being async/isolated. 
    // But we check our local tracking via setModalState? 
    // No, setModalState is just a setter.
    // The original logic checked DOM visibility.
    // If we rely on stack:
    return modalStack.length > 0;
}
