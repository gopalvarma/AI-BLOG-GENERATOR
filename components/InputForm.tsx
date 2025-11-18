import React, { useState } from 'react';
import { BotIcon, SparklesIcon, LinkIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import { ExpertBrandInputs } from '../types';

type Mode = 'beginner' | 'expert' | 'url';

interface BrandVoiceInputProps {
  onGenerate: (data: { mode: Mode; name: string; industry: string; url?: string; expertInputs?: ExpertBrandInputs }) => void;
  isLoading: boolean;
}

const ExpertInput = ({ label, placeholder, value, onChange, type = 'text' }: { label: string, placeholder: string, value: string, onChange: (value: string) => void, type?: 'text' | 'textarea' }) => (
  <div>
    <label className="block text-sm font-medium text-teal-300 mb-2">{label}</label>
    {type === 'textarea' ? (
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-24 bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
      />
    ) : (
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
      />
    )}
  </div>
);

const BrandVoiceInput: React.FC<BrandVoiceInputProps> = ({ onGenerate, isLoading }) => {
  const [mode, setMode] = useState<Mode>('beginner');
  const [brandName, setBrandName] = useState('');
  const [industry, setIndustry] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [expertInputs, setExpertInputs] = useState<ExpertBrandInputs>({
    essence: '', personalityTraits: '', tonePreferences: '', targetAudience: '',
    vocabularyUse: '', vocabularyAvoid: '', rules: '', messagingPillars: '',
    competitors: '', story: '', values: '', positioning: '',
  });

  const handleInputChange = (field: keyof ExpertBrandInputs, value: string) => {
    setExpertInputs(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = () => {
    if (!brandName || !industry) return;
    if (mode === 'url' && !blogUrl) return;

    onGenerate({
      mode,
      name: brandName,
      industry,
      url: mode === 'url' ? blogUrl : undefined,
      expertInputs: mode === 'expert' ? expertInputs : undefined,
    });
  };

  const isSubmittable = !isLoading && brandName && industry && (mode !== 'url' || blogUrl);

  const ModeButton = ({ targetMode, children }: { targetMode: Mode, children: React.ReactNode }) => (
      <button 
        onClick={() => setMode(targetMode)} 
        className={`px-3 py-2 rounded-md text-sm font-semibold transition ${mode === targetMode ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}>
        {children}
      </button>
  );

  return (
    <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
      <div className="flex justify-center mb-6">
        <div className="bg-slate-700 p-1 rounded-lg flex gap-1">
          {/* FIX: Added children to ModeButton components to provide button labels and resolve missing property errors. */}
          <ModeButton targetMode="beginner">Beginner</ModeButton>
          <ModeButton targetMode="expert">Expert</ModeButton>
          <ModeButton targetMode="url">Analyze URL</ModeButton>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ExpertInput label="Brand Name" placeholder="e.g., 'Starlight Coffee'" value={brandName} onChange={setBrandName} />
          <ExpertInput label="Industry" placeholder="e.g., 'Specialty Coffee Roasters'" value={industry} onChange={setIndustry} />
        </div>
        
        {mode === 'url' && (
          <div className="border-t border-slate-700 pt-6">
             <div>
                <label className="block text-sm font-medium text-teal-300 mb-2">Blog Post URL to Analyze</label>
                <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/>
                    <input
                        type="url"
                        placeholder="https://yourbrand.com/blog/post-title"
                        value={blogUrl}
                        onChange={(e) => setBlogUrl(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md pl-10 pr-4 py-2 text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    />
                </div>
            </div>
          </div>
        )}

        {mode === 'expert' && (
          <div className="space-y-6 border-t border-slate-700 pt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ExpertInput label="Brand Essence" placeholder="Core identity, the 'why'" value={expertInputs.essence} onChange={(v) => handleInputChange('essence', v)} />
              <ExpertInput label="Personality Traits" placeholder="e.g., 'Witty, encouraging, knowledgeable'" value={expertInputs.personalityTraits} onChange={(v) => handleInputChange('personalityTraits', v)} />
              <ExpertInput label="Tone Preferences" placeholder="e.g., 'Playful but not childish, use emojis sparingly'" value={expertInputs.tonePreferences} onChange={(v) => handleInputChange('tonePreferences', v)} />
              <ExpertInput label="Target Audience" placeholder="e.g., 'Young professionals, creative freelancers'" value={expertInputs.targetAudience} onChange={(v) => handleInputChange('targetAudience', v)} />
              <ExpertInput label="Vocabulary to Use" placeholder="e.g., 'Artisanal, craft, single-origin'" value={expertInputs.vocabularyUse} onChange={(v) => handleInputChange('vocabularyUse', v)} />
              <ExpertInput label="Vocabulary to Avoid" placeholder="e.g., 'Burnt, basic, mainstream'" value={expertInputs.vocabularyAvoid} onChange={(v) => handleInputChange('vocabularyAvoid', v)} />
              <ExpertInput label="Do & Don't Rules" placeholder="e.g., 'Do: Use storytelling. Don't: Make medical claims.'" value={expertInputs.rules} onChange={(v) => handleInputChange('rules', v)} type="textarea" />
              <ExpertInput label="Messaging Pillars" placeholder="e.g., 'Quality, Sustainability, Community'" value={expertInputs.messagingPillars} onChange={(v) => handleInputChange('messagingPillars', v)} type="textarea" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={!isSubmittable}
          className="w-full flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-all duration-300 shadow-lg hover:shadow-teal-500/30"
        >
          <SparklesIcon className="mr-2 h-5 w-5" />
          {isLoading ? 'Generating System...' : 'Generate Brand Voice System'}
        </button>
      </div>
    </div>
  );
};

export default BrandVoiceInput;