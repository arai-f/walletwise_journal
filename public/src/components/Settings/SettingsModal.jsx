import { useEffect, useState } from 'react';
import CreditCardRules from './CreditCardRules';
import GeneralSettings from './GeneralSettings';
import ListSettings from './ListSettings';
import ScanSettings from './ScanSettings';
import SettingsMenu from './SettingsMenu';
// import IconPicker from './IconPicker'; // Will implement later

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  store, 
  getState, 
  refreshApp, 
  requestNotification, 
  disableNotification,
  openGuide,
  openTerms
}) {
  const [currentView, setCurrentView] = useState('menu'); // menu, general, assets, liabilities, income, expense, scan, cards
  const [title, setTitle] = useState('設定');

  // Reset view when closed
  useEffect(() => {
    if (!isOpen) { 
        // Delay reset to allow animation if needed, or just reset
        setTimeout(() => {
            setCurrentView('menu');
            setTitle('設定');
        }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
             // If we are in sub-view, go back. If in menu (or other logic), maybe close?
             // User requested "Escape operation reflected". 
             // Standard modal behavior: Escape closes modal. 
             // But if in subview, maybe back is better? 
             // Let's implement: If in Menu -> Close. If in Subview -> Back.
             if (currentView === 'menu') {
                 onClose();
             } else {
                 handleBack();
             }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentView]);

  if (!isOpen) return null;

  const navigateTo = (view, newTitle) => {
    setCurrentView(view);
    setTitle(newTitle);
  };

  const handleBack = () => {
    setCurrentView('menu');
    setTitle('設定');
  };

  return (
    <div 
      className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-4 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full h-[90vh] md:h-[90vh] md:max-w-2xl rounded-2xl md:rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-white md:rounded-t-lg">
          <div className="flex items-center gap-3">
            {currentView !== 'menu' && (
              <button 
                onClick={handleBack}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-600"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
            )}
            <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 transition text-neutral-400 hover:text-neutral-600"
          >
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="grow overflow-y-auto bg-neutral-50 md:rounded-b-lg">
          {currentView === 'menu' && (
            <SettingsMenu 
              onNavigate={navigateTo} 
              store={store} 
              getState={getState}
              openGuide={openGuide}
              openTerms={openTerms}
            />
          )}

          {currentView === 'general' && (
            <GeneralSettings 
              store={store} 
              getState={getState}
              reloadApp={refreshApp} // General settings might need reload or refresh
              requestNotification={requestNotification}
              disableNotification={disableNotification}
            />
          )}

          {currentView === 'assets' && (
             <ListSettings 
                type="asset" 
                title="資産口座" 
                store={store} 
                getState={getState} 
                refreshApp={refreshApp}
             />
          )}
          
          {currentView === 'liabilities' && (
             <ListSettings 
                type="liability" 
                title="負債口座" 
                store={store} 
                getState={getState} 
                refreshApp={refreshApp}
             />
          )}

          {currentView === 'income' && (
             <ListSettings 
                type="income" 
                title="収入カテゴリ" 
                store={store} 
                getState={getState} 
                refreshApp={refreshApp}
             />
          )}

          {currentView === 'expense' && (
             <ListSettings 
                type="expense" 
                title="支出カテゴリ" 
                store={store} 
                getState={getState} 
                refreshApp={refreshApp}
             />
          )}

          {currentView === 'cards' && (
            <CreditCardRules 
                store={store} 
                getState={getState} 
                refreshApp={refreshApp}
            />
          )}

          {currentView === 'scan' && (
            <ScanSettings 
                store={store} 
                getState={getState} 
                refreshApp={refreshApp}
            />
          )}
        </div>
      </div>
    </div>
  );
}
