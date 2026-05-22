import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">{label}</label>}
      <input
        className={`w-full styled-input text-slate-100 rounded-xl px-4.5 py-3 text-sm placeholder-slate-500 focus:outline-none ${error ? 'styled-input-error' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">{label}</label>}
      <textarea
        className={`w-full styled-input text-slate-100 rounded-xl px-4.5 py-3 text-sm placeholder-slate-500 focus:outline-none min-h-[110px] custom-scrollbar ${error ? 'styled-input-error' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
};