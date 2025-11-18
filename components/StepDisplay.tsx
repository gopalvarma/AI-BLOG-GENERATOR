
import React from 'react';
import { RefreshCwIcon, EditIcon } from './icons';

interface BrandComponentDisplayProps {
  title: string;
  onRegenerate?: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
}

const BrandComponentDisplay: React.FC<BrandComponentDisplayProps> = ({ title, onRegenerate, onEdit, children }) => {
  return (
    <div className="border border-slate-700 bg-slate-800/30 rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="font-semibold text-lg text-slate-200">{title}</h3>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-slate-400 hover:text-indigo-400 transition-colors p-1 rounded-full hover:bg-slate-700"
              title={`Edit ${title}`}
            >
              <EditIcon className="w-4 h-4" />
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-slate-400 hover:text-indigo-400 transition-colors p-1 rounded-full hover:bg-slate-700"
              title={`Regenerate ${title}`}
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default BrandComponentDisplay;
