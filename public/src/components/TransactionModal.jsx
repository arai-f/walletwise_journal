import { useEffect, useRef, useState } from 'react';
import * as utils from '../utils.js';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';

export default function TransactionModal({
  isOpen,
  onClose,
  transaction,
  prefillData,
  onSave,
  onDelete,
  luts
}) {
  const getSortedAccounts = () => {
    if (!luts || !luts.accounts) return [];
    return utils.sortItems([...luts.accounts.values()].filter(a => !a.isDeleted));
  };
  
  const getSortedCategories = (type) => {
    if (!luts || !luts.categories) return [];
    return utils.sortItems([...luts.categories.values()].filter(c => !c.isDeleted && c.type === type));
  };

  const getDefaultCategory = (type) => {
      const cats = getSortedCategories(type);
      return cats.length > 0 ? cats[0].id : '';
  };

  const [formData, setFormData] = useState({
    type: 'expense',
    date: utils.getLocalToday(),
    amount: '',
    categoryId: '',
    accountId: '', // For payment method
    fromAccountId: '',
    toAccountId: '',
    description: '',
    memo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('create'); // create, edit, prefill, copy
  const [showCopyBanner, setShowCopyBanner] = useState(false);

  const modalRef = useRef(null);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      const accounts = getSortedAccounts();
      setShowCopyBanner(false);
      
      if (transaction) {
        setMode('edit');
        setFormData({
          type: transaction.type,
          date: transaction.date ? utils.toYYYYMMDD(new Date(transaction.date)) : utils.getLocalToday(),
          amount: transaction.amount || '',
          categoryId: transaction.categoryId || '',
          accountId: transaction.accountId || '',
          fromAccountId: transaction.fromAccountId || '',
          toAccountId: transaction.toAccountId || '',
          description: transaction.description || '',
          memo: transaction.memo || '',
          id: transaction.id
        });
      } else if (prefillData) {
        setMode('prefill');
        setFormData({
            type: prefillData.type || 'expense',
            date: prefillData.date ? utils.toYYYYMMDD(new Date(prefillData.date)) : utils.getLocalToday(),
            amount: prefillData.amount || '',
            categoryId: prefillData.categoryId || getDefaultCategory(prefillData.type || 'expense'),
            accountId: prefillData.accountId || (accounts.length > 0 ? accounts[0].id : ''),
            fromAccountId: prefillData.fromAccountId || (accounts.length > 0 ? accounts[0].id : ''),
            toAccountId: prefillData.toAccountId || (accounts.length > 1 ? accounts[1].id : (accounts.length > 0 ? accounts[0].id : '')),
            description: prefillData.description || '',
            memo: prefillData.memo || '',
            id: ''
        });
      } else {
        setMode('create');
        // Defaults
        const defaultAccount = accounts.length > 0 ? accounts[0].id : '';
        
        setFormData({
          type: 'expense',
          date: utils.getLocalToday(),
          amount: '',
          categoryId: getDefaultCategory('expense'),
          accountId: defaultAccount,
          fromAccountId: defaultAccount,
          toAccountId: accounts.length > 1 ? accounts[1].id : defaultAccount,
          description: '',
          memo: ''
        });
      }
    }
  }, [isOpen, transaction, prefillData]);

  // Focus management
  useEffect(() => {
      if (isOpen) {
          // Prevent scroll on body
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
  }, [isOpen]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAmountChange = (e) => {
      const val = e.target.value;
      const sanitized = utils.sanitizeNumberInput(val);
      setFormData(prev => ({ ...prev, amount: sanitized }));
  };

  const handleTypeChange = (newType) => {
      setFormData(prev => ({
          ...prev, 
          type: newType, 
          categoryId: newType !== 'transfer' ? getDefaultCategory(newType) : ''
      }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation
    if (!formData.date || !formData.amount) {
        alert('日付と金額は必須です');
        return;
    }

    setIsSubmitting(true);
    try {
        await onSave({
            ...formData,
        });
    } catch (err) {
        console.error(err);
        alert('保存に失敗しました');
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDelete = () => {
      if (formData.id && onDelete) {
          onDelete(formData.id);
      }
  };

  const handleCopy = () => {
      setMode('copy');
      setFormData(prev => ({
          ...prev,
          id: null,
          date: utils.toYYYYMMDD(new Date()),
      }));
      setShowCopyBanner(true);
      setTimeout(() => setShowCopyBanner(false), 3000);
  };

  if (!isOpen) return null;

  const accounts = getSortedAccounts();
  const categories = getSortedCategories(formData.type);
  
  const isBalanceAdjustment = mode === 'edit' && formData.categoryId === utils.SYSTEM_BALANCE_ADJUSTMENT_CATEGORY_ID;

  // Determining title
  let title = "取引を追加";
  if (mode === 'edit') {
      title = isBalanceAdjustment ? "残高調整（表示のみ）" : "取引を編集";
  } else if (mode === 'prefill' || (mode === 'copy') || (mode === 'create' && !transaction && prefillData)) { 
     const isBillingPayment = formData.type === 'transfer' && formData.description && formData.description.includes('支払い');
     title = isBillingPayment ? '振替の確認・登録' : '取引を追加 (コピー)';
  }

  // Styles for Segmented Control
  const getTypeBtnClass = (type) => {
      const isActive = formData.type === type;
      // Pill shape with solid colors for active state
      const base = "flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-2 relative z-10";
      
      if (!isActive) {
          return `${base} text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50`;
      }

      // Active styles - Solid background colors
      if (type === 'expense') return `${base} bg-red-500 text-white shadow-lg shadow-red-500/30 transform scale-[1.02]`;
      if (type === 'income') return `${base} bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transform scale-[1.02]`;
      if (type === 'transfer') return `${base} bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transform scale-[1.02]`;
      
      return base;
  };

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex justify-center items-center p-4 " onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full overflow-y-auto transform transition-all border border-neutral-200" role="dialog" aria-modal="true" ref={modalRef}>
        <form className="p-6" onSubmit={handleSubmit}>
            {showCopyBanner && (
              <div className="mb-4 bg-indigo-50 border-l-4 border-indigo-500 text-indigo-700 px-4 py-3 rounded-r-lg flex items-center gap-3 animate-pulse">
                <i className="fas fa-copy"></i>
                <span className="text-sm font-bold">元の取引をコピーしました</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
                <button 
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition"
                  aria-label="閉じる"
                >
                   <i className="fas fa-times text-xl"></i>
                </button>
            </div>

            <div className="space-y-5">
               {/* Type Selector (Segmented Control) */}
               {!isBalanceAdjustment && (
                   <div className="bg-neutral-100 p-1.5 rounded-full flex border border-neutral-100/50 relative">
                       <button
                           type="button"
                           onClick={() => handleTypeChange('expense')}
                           className={getTypeBtnClass('expense')}
                       >
                           <i className={`fas fa-minus-circle ${formData.type === 'expense' ? 'text-white/90' : 'text-neutral-400'}`}></i>
                           <span>支出</span>
                       </button>
                       <button
                           type="button"
                           onClick={() => handleTypeChange('income')}
                           className={getTypeBtnClass('income')}
                       >
                           <i className={`fas fa-plus-circle ${formData.type === 'income' ? 'text-white/90' : 'text-neutral-400'}`}></i>
                           <span>収入</span>
                       </button>
                       <button
                           type="button"
                           onClick={() => handleTypeChange('transfer')}
                           className={getTypeBtnClass('transfer')}
                       >
                           <i className={`fas fa-exchange-alt ${formData.type === 'transfer' ? 'text-white/90' : 'text-neutral-400'}`}></i>
                           <span>振替</span>
                       </button>
                   </div>
               )}

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <Input
                       label="日付"
                       type="date"
                       name="date"
                       value={formData.date}
                       onChange={handleChange}
                       required
                       disabled={isBalanceAdjustment}
                   />
                   <Input
                       label="金額"
                       type="tel"
                       inputMode="decimal"
                       name="amount"
                       value={formData.amount}
                       onChange={handleAmountChange}
                       placeholder="0"
                       required
                       disabled={isBalanceAdjustment}
                       startAdornment="¥"
                   />
               </div>

               <div className="grid grid-cols-2 gap-4">
                   {formData.type !== 'transfer' ? (
                       <>
                           <Select
                               label="支払方法"
                               name="accountId"
                               value={formData.accountId}
                               onChange={handleChange}
                               disabled={isBalanceAdjustment}
                           >
                               {accounts.map(acc => (
                                   <option key={acc.id} value={acc.id}>{acc.name}</option>
                               ))}
                           </Select>
                           <Select
                               label="カテゴリ"
                               name="categoryId"
                               value={formData.categoryId}
                               onChange={handleChange}
                               disabled={isBalanceAdjustment}
                           >
                               {categories.length === 0 && <option value="" disabled>カテゴリなし</option>}
                               {categories.map(cat => (
                                   <option key={cat.id} value={cat.id}>{cat.name}</option>
                               ))}
                           </Select>
                       </>
                   ) : (
                       <>
                           <Select
                               label="振替元"
                               name="fromAccountId"
                               value={formData.fromAccountId}
                               onChange={handleChange}
                               disabled={isBalanceAdjustment}
                           >
                               {accounts.map(acc => (
                                   <option key={acc.id} value={acc.id}>{acc.name}</option>
                               ))}
                           </Select>
                           <Select
                               label="振替先"
                               name="toAccountId"
                               value={formData.toAccountId}
                               onChange={handleChange}
                               disabled={isBalanceAdjustment}
                           >
                               {accounts.map(acc => (
                                   <option key={acc.id} value={acc.id}>{acc.name}</option>
                               ))}
                           </Select>
                       </>
                   )}
               </div>

               <Input
                   label="詳細 (任意)"
                   type="text"
                   name="description"
                   value={formData.description}
                   onChange={handleChange}
                   placeholder="店名や内容など"
                   disabled={isBalanceAdjustment}
               />
               <Input
                   label="メモ (任意)"
                   type="text"
                   name="memo"
                   value={formData.memo}
                   onChange={handleChange}
                   placeholder="メモやタグなど"
                   disabled={isBalanceAdjustment}
               />
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-8 border-t border-neutral-100">
               {mode === 'edit' && !isBalanceAdjustment && (
                   <>
                       <Button
                           variant="danger-ghost"
                           onClick={handleDelete}
                       >
                           削除
                       </Button>
                       <Button
                           variant="secondary"
                           onClick={handleCopy}
                       >
                           <i className="fas fa-copy"></i>複製
                       </Button>
                   </>
               )}
               
               {!isBalanceAdjustment && (
                   <Button
                       type="submit"
                       variant="primary"
                       disabled={isSubmitting}
                       className="px-6 py-2 shadow-md hover:shadow-lg transform active:scale-95"
                   >
                       {isSubmitting && <i className="fas fa-spinner fa-spin"></i>}
                       保存
                   </Button>
               )}
            </div>
        </form>
      </div>
    </div>
  );
}
