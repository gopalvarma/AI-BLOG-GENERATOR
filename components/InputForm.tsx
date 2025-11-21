
import React, { useState, useEffect } from 'react';
import { SparklesIcon, TrashIcon, BookTextIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import { ExpertBrandInputs, BrandVoiceSystem, SavedBrandVoice } from '../types';

interface BrandVoiceInputProps {
  onGenerate: (data: { name: string; industry: string; expertInputs?: ExpertBrandInputs }) => void;
  isLoading: boolean;
  generatedSystem: BrandVoiceSystem | null;
  savedVoices: SavedBrandVoice[];
  onLoadVoice: (voice: SavedBrandVoice) => void;
  onDeleteVoice: (id: string) => void;
  brandName: string;
  setBrandName: (value: string) => void;
  industry: string;
  setIndustry: (value: string) => void;
}

const InputField = ({ label, placeholder, value, onChange, type = 'text' }: { label: string, placeholder: string, value: string, onChange: (value: string) => void, type?: 'text' | 'textarea' }) => (
  <div className="relative group mb-2">
    <label className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-500 group-focus-within:text-[#1a73e8] transition-colors z-10">
      {label}
    </label>
    {type === 'textarea' ? (
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[120px] bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] transition-all duration-200 outline-none resize-y text-sm leading-relaxed hover:border-gray-400"
      />
    ) : (
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] transition-all duration-200 outline-none text-sm hover:border-gray-400"
      />
    )}
  </div>
);

const BrandVoiceInput: React.FC<BrandVoiceInputProps> = ({ 
  onGenerate, 
  isLoading, 
  generatedSystem, 
  savedVoices, 
  onLoadVoice, 
  onDeleteVoice, 
  brandName, 
  setBrandName, 
  industry, 
  setIndustry 
}) => {
  const [showDetailed, setShowDetailed] = useState(false);
  const [expertInputs, setExpertInputs] = useState<ExpertBrandInputs>({
    essence: '', personalityTraits: '', tonePreferences: '', targetAudience: '',
    vocabularyUse: '', vocabularyAvoid: '', rules: '', messagingPillars: '',
    competitors: '', story: '', values: '', positioning: '',
  });

  useEffect(() => {
    if (generatedSystem) {
      setExpertInputs(prev => ({
        ...prev,
        essence: generatedSystem.essence || prev.essence,
        personalityTraits: generatedSystem.personalityTraits.join(', ') || prev.personalityTraits,
        tonePreferences: generatedSystem.toneGuidelines.map(t => `${t.name}: ${t.description}`).join('\n') || prev.tonePreferences,
        targetAudience: generatedSystem.targetAudience || prev.targetAudience,
        vocabularyUse: generatedSystem.vocabulary.use.join(', ') || prev.vocabularyUse,
        vocabularyAvoid: generatedSystem.vocabulary.avoid.join(', ') || prev.vocabularyAvoid,
        rules: generatedSystem.keyRules ? generatedSystem.keyRules.join('\n') : prev.rules,
        messagingPillars: generatedSystem.messagingPillars.join('\n') || prev.messagingPillars,
      }));
    }
  }, [generatedSystem]);

  const handleInputChange = (field: keyof ExpertBrandInputs, value: string) => {
    setExpertInputs(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = () => {
    if (!brandName || !industry) return;
    const hasExpertData = Object.values(expertInputs).some(val => val.trim() !== '');

    onGenerate({
      name: brandName,
      industry,
      expertInputs: hasExpertData ? expertInputs : undefined,
    });
  };

  const isSubmittable = !isLoading && brandName && industry;

  return (
    <div className="bg-white p-6 md:p-10 rounded-[24px] shadow-sm border border-gray-100 max-w-4xl mx-auto animate-slideUp transition-all duration-500 hover:shadow-md">
      
      {savedVoices.length > 0 && (
          <div className="mb-8 pb-6 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BookTextIcon className="w-4 h-4" />
              Saved Voices
            </h3>
            <div className="flex flex-wrap gap-3">
              {savedVoices.map(voice => (
                <div 
                    key={voice.id} 
                    onClick={() => onLoadVoice(voice)} 
                    className="group flex items-center gap-3 bg-white border border-gray-200 rounded-xl pl-4 pr-2 py-2 hover:border-[#1a73e8] hover:bg-[#f8fbff] cursor-pointer transition-all duration-200 shadow-sm hover:shadow"
                >
                  <div className="max-w-[120px]">
                    <div className="font-medium text-gray-900 text-sm truncate">{voice.name}</div>
                    <div className="text-[10px] text-gray-500 truncate uppercase">{voice.industry}</div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteVoice(voice.id); }}
                    className="text-gray-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                    title="Delete voice"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
      )}

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="Brand Name" placeholder="e.g. Starlight Coffee" value={brandName} onChange={setBrandName} />
          <InputField label="Industry" placeholder="e.g. Specialty Coffee" value={industry} onChange={setIndustry} />
        </div>
        
        <div className="animate-fadeIn">
             <button 
                onClick={() => setShowDetailed(!showDetailed)}
                className="flex items-center justify-between w-full text-left p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group border border-transparent hover:border-gray-200"
             >
                 <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Detailed Attributes (Optional)</span>
                 <svg 
                    className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${showDetailed ? 'rotate-180' : ''}`} 
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                 </svg>
             </button>
             
             <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 pt-4 px-1 transition-all duration-500 ease-in-out overflow-hidden ${showDetailed ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}>
              <InputField label="Brand Essence" placeholder="Core identity (e.g. Making mornings magical)" value={expertInputs.essence} onChange={(v) => handleInputChange('essence', v)} />
              <InputField label="Personality" placeholder="e.g. Witty, knowledgeable, warm" value={expertInputs.personalityTraits} onChange={(v) => handleInputChange('personalityTraits', v)} />
              <InputField label="Tone" placeholder="e.g. Playful, Casual" value={expertInputs.tonePreferences} onChange={(v) => handleInputChange('tonePreferences', v)} />
              <InputField label="Audience" placeholder="e.g. Young professionals" value={expertInputs.targetAudience} onChange={(v) => handleInputChange('targetAudience', v)} />
              <InputField label="Vocabulary to Use" placeholder="e.g. Artisanal, craft" value={expertInputs.vocabularyUse} onChange={(v) => handleInputChange('vocabularyUse', v)} />
              <InputField label="Vocabulary to Avoid" placeholder="e.g. Cheap, basic" value={expertInputs.vocabularyAvoid} onChange={(v) => handleInputChange('vocabularyAvoid', v)} />
              <div className="md:col-span-2">
                <InputField label="Key Rules (Do's & Don'ts)" placeholder="e.g. Do: Use storytelling. Don't: Use jargon." value={expertInputs.rules} onChange={(v) => handleInputChange('rules', v)} type="textarea" />
              </div>
              <div className="md:col-span-2">
                 <InputField label="Messaging Pillars" placeholder="e.g. Sustainability, Quality" value={expertInputs.messagingPillars} onChange={(v) => handleInputChange('messagingPillars', v)} type="textarea" />
              </div>
            </div>
          </div>
      </div>

      <div className="mt-10 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!isSubmittable}
          className={`relative overflow-hidden flex items-center justify-center text-white font-medium py-3 px-10 rounded-full transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98] ${
            (!brandName || !industry) && !isLoading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'animate-shimmer-button hover:opacity-90'
          }`}
        >
          {isLoading ? (
             <>
                <SparklesIcon className="mr-2 h-5 w-5 animate-pulse" />
                <span className="animate-pulse">Analyzing...</span>
             </>
          ) : (
             <>
                <SparklesIcon className="mr-2 h-5 w-5" />
                Generate Voice
             </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BrandVoiceInput;
