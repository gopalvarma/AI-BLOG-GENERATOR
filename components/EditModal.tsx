
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 text-white">Edit {title}</h2>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full h-48 bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 focus:ring-2 focus:ring-teal-500 transition font-mono text-sm"
          aria-label={`Edit ${title}`}
        />
        <p className="text-xs text-slate-400 mt-2">
            For items with multiple entries (like Personality Traits), use a comma-separated list. For more complex items (like Tone Guidelines), edit the JSON directly.
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-md font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md font-semibold text-white transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
