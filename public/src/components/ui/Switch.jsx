import React from 'react';

const Switch = React.forwardRef(({
    checked,
    onChange,
    className = "",
    disabled = false,
    ...props
}, ref) => {
    return (
        <label className={`relative inline-flex items-center cursor-pointer ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input 
                type="checkbox" 
                ref={ref}
                checked={checked} 
                onChange={onChange} 
                disabled={disabled}
                className="sr-only peer" 
                {...props}
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
    );
});

Switch.displayName = "Switch";
export default Switch;
