import React from 'react';

interface EditModalProps {
  title: string;
  value: string;
  setValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ title, value, setValue, onSave, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn transition-all">
      <div className="bg-white rounded-[28px] shadow-2xl p-8 w-full max-w-2xl scale-100 animate-scaleIn">
        <h2 className="text-2xl font-normal mb-6 text-[#202124]">Edit {title}</h2>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full h-80 bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-2xl px-6 py-5 text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] transition-all duration-200 font-mono text-sm outline-none resize-none leading-relaxed"
          aria-label={`Edit ${title}`}
        />
        <p className="text-xs text-gray-500 mt-4 ml-2 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-gray-400"></span>
            Supports comma-separated lists or JSON format.
        </p>
        <div className="mt-10 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-[#1a73e8] hover:bg-blue-50 rounded-full font-medium text-sm transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-8 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] rounded-full font-medium text-white text-sm shadow-sm hover:shadow-md transition-all duration-200"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;