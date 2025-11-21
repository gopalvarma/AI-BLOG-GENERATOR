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
    <div className="group bg-white border border-gray-200 rounded-2xl hover:border-blue-200 hover:shadow-lg transition-all duration-300 ease-out flex flex-col h-full transform hover:-translate-y-1">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
        <h3 className="font-medium text-[15px] text-gray-800 tracking-tight">{title}</h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-gray-400 hover:text-[#1a73e8] hover:bg-blue-50 p-2 rounded-full transition-all"
              title={`Edit ${title}`}
            >
              <EditIcon className="w-4 h-4" />
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-gray-400 hover:text-[#1a73e8] hover:bg-blue-50 p-2 rounded-full transition-all"
              title={`Regenerate ${title}`}
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="p-6 text-gray-600 text-sm leading-relaxed flex-grow">
        {children}
      </div>
    </div>
  );
};

export default BrandComponentDisplay;