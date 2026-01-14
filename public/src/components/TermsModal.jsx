import { useEffect, useRef, useState } from 'react';
import { config as appConfig } from '../config.js';

const TermsModal = ({ isOpen, onClose, mode = 'viewer', onAgree, onDisagree }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && !htmlContent && !isLoading) {
            setIsLoading(true);
            fetch('terms.html')
                .then(res => {
                   if (!res.ok) throw new Error("Failed to load terms");
                   return res.text();
                })
                .then(html => {
                    setHtmlContent(html);
                    setIsLoading(false);
                })
                .catch(err => {
                    setHtmlContent(`<p class="text-red-500">${err.message}</p>`);
                    setIsLoading(false);
                });
        }
    }, [isOpen, htmlContent, isLoading]);

    const contentRef = useRef(null);
    
    useEffect(() => {
        if (contentRef.current && appConfig.termsVersion) {
            const el = contentRef.current.querySelector('#terms-version-display');
            if (el) el.textContent = appConfig.termsVersion;
        }
    }, [htmlContent, isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 modal-overlay z-99 flex justify-center items-center p-0 md:p-4"
            onClick={(e) => { if(e.target === e.currentTarget && mode === 'viewer') onClose(); }}
        >
             <div className="bg-white w-full h-full md:h-auto md:max-w-3xl md:max-h-[90vh] md:rounded-lg md:shadow-xl flex flex-col">
                <div className="p-4 border-b border-neutral-200 shrink-0 flex justify-between items-center md:rounded-t-lg">
                    <h2 className="text-xl font-bold text-neutral-900">
                        {mode === 'agreement' ? '利用規約への同意' : '利用規約'}
                    </h2>
                    {mode === 'viewer' && (
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full hover:bg-neutral-100 shrink-0 p-1 flex items-center justify-center transition"
                            aria-label="閉じる"
                        >
                            <i className="fas fa-times text-2xl text-neutral-500"></i>
                        </button>
                    )}
                </div>
                
                <div 
                    ref={contentRef}
                    className="grow overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full"
                    dangerouslySetInnerHTML={{ __html: htmlContent || '<p>読み込んでいます...</p>' }} 
                />

                {mode === 'agreement' && (
                    <div className="p-4 bg-white border-t border-neutral-200 flex justify-end gap-3 shrink-0 md:rounded-b-lg">
                         <button 
                             onClick={onDisagree}
                             className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-600 font-bold hover:bg-neutral-50 transition"
                         >
                             同意しない
                         </button>
                         <button 
                             onClick={onAgree}
                             className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow transition"
                         >
                             同意する
                         </button>
                    </div>
                )}
             </div>
        </div>
    );
};

export default TermsModal;
