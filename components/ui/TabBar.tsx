import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  visible?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onChange }) => {
  const visibleTabs = tabs.filter(tab => tab.visible !== false);

  return (
    <div className="flex border-b border-white/5 bg-[#0b0f1e]/65 backdrop-blur-md sticky top-0 z-40 overflow-x-auto scrollbar-none px-4">
      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2.5 px-6 py-4 border-b-2 font-semibold text-sm transition-all duration-300 whitespace-nowrap outline-none relative click-bounce ${
              isActive
                ? 'border-transparent text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
            }`}
          >
            {tab.icon && <span className={`${isActive ? 'text-indigo-400' : 'text-slate-450'}`}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]"></span>
            )}
          </button>
        );
      })}
    </div>
  );
};
