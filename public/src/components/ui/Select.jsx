import React from 'react';

const Select = React.forwardRef(({
    label,
    children,
    className = "",
    selectClassName = "",
    ...props
}, ref) => {
    return (
        <div className={className}>
            {label && (
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    ref={ref}
                    className={`h-9 w-full border border-neutral-300 rounded-lg pl-3 pr-8 py-1 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white disabled:bg-neutral-100 disabled:text-neutral-500 appearance-none cursor-pointer ${selectClassName}`}
                    {...props}
                >
                    {children}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
                    <i className="fas fa-chevron-down text-xs"></i>
                </div>
            </div>
        </div>
    );
});

Select.displayName = "Select";
export default Select;
