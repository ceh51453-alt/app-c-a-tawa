import React, { useRef, useEffect, useState } from 'react';

interface CodeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const CodeTextarea: React.FC<CodeTextareaProps> = ({ value, onChange, className = '', ...props }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(Math.max(lines, 1));
  }, [value]);

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={`relative flex font-mono text-sm border border-white/5 bg-[#050711] rounded-xl overflow-hidden h-[400px] focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 ${className}`}>
      {/* Line Numbers column */}
      <div
        ref={lineNumbersRef}
        className="w-12 code-editor-line-col border-r border-white/5 text-slate-500 text-right pr-3.5 py-3.5 select-none overflow-hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {lineNumbers.map((num) => (
          <div key={num} className="h-5 leading-5 text-[10.5px] font-semibold opacity-70">
            {num}
          </div>
        ))}
      </div>

      {/* Editor Area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        className="flex-grow bg-transparent text-slate-200 p-3.5 outline-none resize-none overflow-y-auto whitespace-pre leading-5 h-full custom-scrollbar font-mono text-[13px]"
        spellCheck="false"
        {...props}
      />
    </div>
  );
};
