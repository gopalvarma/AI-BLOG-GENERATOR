import React, { useState, useCallback, useEffect, useRef } from 'react';
import BrandVoiceInput from './components/InputForm';
import BrandComponentDisplay from './components/StepDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import EditModal from './components/EditModal';
import { BotIcon, AlertTriangleIcon, CopyIcon, CheckIcon, SparklesIcon, SearchIcon, TrophyIcon, KeyIcon, ListChecksIcon, FileTextIcon, LinkIcon, CheckCircleIcon, RefreshCwIcon, SaveIcon, HistoryIcon, XIcon, TrashIcon, ImageIcon } from './components/icons';
import {
  BrandVoiceSystem,
  ExpertBrandInputs,
  GenerationStep,
  PLATFORMS,
  Platform,
  CommentReply,
  BlogGenerationProcess,
  SavedBrandVoice
} from './types';
import * as geminiService from './services/geminiService';

// --- Utils ---

const processInline = (text: string): string => {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#1a73e8] hover:underline font-medium">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-medium text-gray-900">$1</strong>')
    .replace(/\*(.*?)\*\*/g, '<em class="italic text-gray-800">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 text-gray-700 text-[0.9em] rounded px-1.5 py-0.5 font-mono border border-gray-200">$1</code>');
};

const markdownToHtml = (md: string): string => {
  if (!md) return '';
  return md.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (block.startsWith('# ')) return `<h1 class="text-4xl font-normal text-[#202124] mb-6 mt-4 tracking-tight">${processInline(block.slice(2))}</h1>`;
    if (block.startsWith('## ')) return `<h2 class="text-2xl font-normal text-[#202124] mt-10 mb-5 tracking-tight">${processInline(block.slice(3))}</h2>`;
    if (block.startsWith('### ')) return `<h3 class="text-xl font-medium text-[#202124] mt-8 mb-4 tracking-tight">${processInline(block.slice(4))}</h3>`;
    if (block.match(/^(\*|-|\+) .+/)) {
      const items = block.split('\n').map(item => `<li class="ml-5 pl-2 relative marker:text-gray-400">${processInline(item.replace(/^(\*|-|\+) /, ''))}</li>`).join('');
      return `<ul class="list-disc list-outside text-[#5f6368] mb-5 space-y-2.5 leading-relaxed">${items}</ul>`;
    }
    if (block.match(/^\d+\. .+/)) {
      const items = block.split('\n').map(item => `<li class="ml-5 pl-2 marker:text-gray-500">${processInline(item.replace(/^\d+\\. /, ''))}</li>`).join('');
      return `<ol class="list-decimal list-outside text-[#5f6368] mb-5 space-y-2.5 leading-relaxed">${items}</ul>`;
    }
    return `<p class="mb-5 text-[#3c4043] leading-7 text-[16px]">${processInline(block.replace(/\n/g, '<br />'))}</p>`;
  }).join('');
};

// --- Typewriter Component ---
const TypewriterEffect = ({ text, onComplete }: { text: string, onComplete?: () => void }) => {
    const [displayedText, setDisplayedText] = useState('');
    const intervalRef = useRef<number | null>(null);
    const indexRef = useRef(0);

    useEffect(() => {
        if (!text) return;
        setDisplayedText('');
        indexRef.current = 0;

        // Calculate speed based on text length to keep animation time reasonable
        const totalDuration = 3000; // 3 seconds max
        const speed = Math.max(10, Math.min(50, totalDuration / text.length));

        intervalRef.current = window.setInterval(() => {
            const chunkSize = Math.max(1, Math.floor(text.length / 100)); // Write chunks
            indexRef.current += chunkSize;
            
            if (indexRef.current >= text.length) {
                setDisplayedText(text);
                if (intervalRef.current) clearInterval(intervalRef.current);
                onComplete && onComplete();
            } else {
                setDisplayedText(text.slice(0, indexRef.current));
            }
        }, 15); // Fast tick rate

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [text]);

    return (
        <div className="prose prose-slate max-w-none">
            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(displayedText) }} />
            <div className={`inline-block w-1.5 h-5 bg-[#1a73e8] ml-1 animate-pulse ${displayedText.length === text.length ? 'opacity-0' : 'opacity-100'}`}></div>
        </div>
    );
};


// --- Types & Helpers ---
type View = 'define' | 'content' | 'reply';
type InputMode = 'beginner' | 'expert' | 'url';
type StepName = 'research' | 'competition' | 'keywords' | 'outline' | 'generation';
type StepStatus = 'pending' | 'in_progress' | 'done' | 'error';
const stepOrder: StepName[] = ['research', 'competition', 'keywords', 'outline', 'generation'];

const getStepStatus = (stepName: StepName, currentStep: StepName | 'done' | null, overallStatus: GenerationStep): StepStatus => {
    if (overallStatus === 'error' && currentStep === stepName) return 'error';
    if (currentStep === stepName && overallStatus === 'loading') return 'in_progress';
    
    const stepOrderWithDone: (StepName | 'done')[] = [...stepOrder, 'done'];
    const stepIndex = stepOrderWithDone.indexOf(stepName);
    const currentIndex = currentStep ? stepOrderWithDone.indexOf(currentStep) : -1;

    if (currentIndex > stepIndex) return 'done';
    if (currentIndex === stepIndex && overallStatus === 'loading') return 'in_progress';

    return 'pending';
};

// --- Components ---

const BrandVoiceContext = ({ system }: { system: BrandVoiceSystem }) => {
  if (!system) return null;
  return (
    <div className="bg-[#f8f9fa] border border-gray-200 rounded-2xl p-6 mb-8 animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-[#e8f0fe] rounded-full">
                <SparklesIcon className="w-4 h-4 text-[#1a73e8]" />
            </div>
            <span className="text-xs font-bold text-[#1a73e8] uppercase tracking-widest">Active Voice Calibration</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
                <span className="block text-[11px] text-gray-500 uppercase font-bold mb-3 tracking-wider">Personality</span>
                <div className="flex flex-wrap gap-2">
                    {system.personalityTraits.map(t => (
                        <span key={t} className="px-3 py-1 bg-white text-gray-700 border border-gray-200 rounded-full text-xs font-medium shadow-sm">{t}</span>
                    ))}
                </div>
            </div>
            <div>
                <span className="block text-[11px] text-gray-500 uppercase font-bold mb-3 tracking-wider">Tone</span>
                <div className="flex flex-wrap gap-2">
                    {system.toneGuidelines.map(t => (
                        <span key={t.name} title={t.description} className="px-3 py-1 bg-white text-gray-700 border border-gray-200 rounded-full text-xs font-medium shadow-sm cursor-help">{t.name}</span>
                    ))}
                </div>
            </div>
            <div>
                 <span className="block text-[11px] text-gray-500 uppercase font-bold mb-3 tracking-wider">Vocabulary</span>
                 <p className="text-gray-600 text-xs leading-relaxed bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-[#188038] font-semibold">Use:</span> {system.vocabulary.use.join(', ')}
                 </p>
            </div>
        </div>
    </div>
  );
};

const StepCard = ({ title, icon, status, children, onRerun }: { title: string, icon: React.ReactNode, status: StepStatus, children?: React.ReactNode, onRerun?: () => void }) => {
    const isThinking = status === 'in_progress';
    
    return (
        <div className={`relative rounded-2xl overflow-hidden transition-all duration-700 mb-4 ${
            status === 'pending' ? 'bg-transparent opacity-60' : 
            isThinking ? 'bg-white border-[#1a73e8]/30 shadow-lg ring-4 ring-blue-500/5' :
            'bg-white border border-gray-200 shadow-sm'
        }`}>
            {isThinking && <div className="absolute top-0 left-0 w-full h-1 shimmer-bg z-10"></div>}
            
            <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-full transition-colors duration-500 ${
                        status === 'done' ? 'bg-[#e6f4ea] text-[#188038]' : 
                        status === 'in_progress' ? 'bg-[#e8f0fe] text-[#1a73e8]' : 
                        status === 'error' ? 'bg-[#fce8e6] text-[#d93025]' : 
                        'bg-gray-100 text-gray-400'
                    }`}>
                        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-5 h-5` })}
                    </div>
                    <h3 className={`flex items-center font-medium text-[16px] tracking-tight ${status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                        {title}
                        {isThinking && (
                            <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white animate-shimmer-button shadow-sm">
                                <SparklesIcon className="w-3 h-3 mr-1.5" />
                                Thinking...
                            </span>
                        )}
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    {status === 'done' && onRerun && (
                         <button onClick={onRerun} className="text-gray-400 hover:text-[#1a73e8] transition-colors p-2 rounded-full hover:bg-gray-50" title="Regenerate Step">
                             <RefreshCwIcon className="w-4 h-4" />
                         </button>
                    )}
                    {status === 'done' && !onRerun && <CheckCircleIcon className="w-6 h-6 text-[#188038] animate-scaleIn" />}
                    {status === 'error' && <AlertTriangleIcon className="w-6 h-6 text-[#d93025] animate-scaleIn" />}
                </div>
            </div>
            
            {(status === 'done' || isThinking) && children && (
                <div className="px-6 pb-6 ml-[3.25rem] animate-fadeIn">
                     {isThinking ? (
                         <div className="space-y-3 py-2">
                            <div className="h-2 bg-gray-100 rounded w-3/4 shimmer-bg"></div>
                            <div className="h-2 bg-gray-100 rounded w-1/2 shimmer-bg"></div>
                         </div>
                     ) : (
                        children
                     )}
                </div>
            )}
        </div>
    );
};

const BlogGenerationProcessView = ({ process, onRerunStep }: { process: BlogGenerationProcess, onRerunStep: (step: StepName) => void }) => {
    const canRerun = process.status === 'done';
    return (
        <div className="space-y-4 max-w-4xl mx-auto animate-slideUp">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-normal text-[#202124] tracking-tight">Developing Content for <span className="font-medium text-[#1a73e8]">{process.platform}</span></h2>
                <p className="text-[#5f6368] mt-2 text-sm">{process.topic}</p>
            </div>
            
            <StepCard title="Research" icon={<SearchIcon />} status={getStepStatus('research', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('research') : undefined}>
                {process.research && (
                    <div className="space-y-4">
                         <div className="flex flex-wrap gap-2 mb-4">
                            {process.research.groundingSources?.map((source, i) => (
                                <a key={i} href={source.web?.uri || '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-[#1a73e8] hover:bg-[#f8fbff] hover:border-blue-200 transition-colors shadow-sm">
                                    <LinkIcon className="w-3 h-3" /> <span className="truncate max-w-[180px]">{source.web?.title || 'Source'}</span>
                                </a>
                            ))}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Key Insights</h4>
                            <ul className="space-y-2">
                                {process.research.insights.map((insight, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full mt-1.5 flex-shrink-0"></span>
                                        {insight}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </StepCard>

            <StepCard title="Competitive Analysis" icon={<TrophyIcon />} status={getStepStatus('competition', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('competition') : undefined}>
                {process.competition && (
                     <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl italic leading-relaxed">
                        "{process.competition.analysis}"
                    </div>
                )}
            </StepCard>
            
            <StepCard title="Keyword Strategy" icon={<KeyIcon />} status={getStepStatus('keywords', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('keywords') : undefined}>
                {process.keywords && (
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="px-4 py-1.5 bg-[#e8f0fe] text-[#1967d2] rounded-full font-medium text-sm">{process.keywords.primary}</span>
                        <span className="text-gray-300 text-xl font-light">|</span>
                        {process.keywords.secondary.map(k => <span key={k} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{k}</span>)}
                    </div>
                )}
            </StepCard>
            
            <StepCard title="Strategic Outline" icon={<ListChecksIcon />} status={getStepStatus('outline', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('outline') : undefined}>
                {process.outline && (
                    <div className="space-y-2">
                        {process.outline.map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors group">
                                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium flex-shrink-0 group-hover:bg-[#e8f0fe] group-hover:text-[#1a73e8] transition-colors">{i + 1}</div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900">{item.sectionTitle}</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">{item.intent}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </StepCard>

            <StepCard title="Content Drafting & Imagery" icon={<FileTextIcon />} status={getStepStatus('generation', process.currentStep, process.status)}>
                {/* This card content is handled by the parent view when done, or by the loader when in progress */}
                 {process.system && process.status === 'done' && (
                     <div className="mt-2">
                        <BrandVoiceContext system={process.system} />
                     </div>
                )}
            </StepCard>
        </div>
    );
};


const App: React.FC = () => {
  const [view, setView] = useState<View>('define');
  const [status, setStatus] = useState<GenerationStep>('idle');
  const [error, setError] = useState<string | null>(null);

  // Brand Voice State
  const [brandVoiceSystem, setBrandVoiceSystem] = useState<BrandVoiceSystem | null>(null);
  const [brandName, setBrandName] = useState<string>(''); 
  const [brandIndustry, setBrandIndustry] = useState<string>(''); 
  
  // Persistent Form State
  const [formBrandName, setFormBrandName] = useState<string>('');
  const [formIndustry, setFormIndustry] = useState<string>('');

  const [editingComponent, setEditingComponent] = useState<{key: keyof BrandVoiceSystem, title: string} | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [regeneratingComponent, setRegeneratingComponent] = useState<keyof BrandVoiceSystem | null>(null);
  const [savedVoices, setSavedVoices] = useState<SavedBrandVoice[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Content Generation State
  const [contentTopic, setContentTopic] = useState('');
  const [contentPlatform, setContentPlatform] = useState<Platform>('Blog / Article');
  const [generationHistory, setGenerationHistory] = useState<BlogGenerationProcess[]>([]);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<GenerationStep>('idle');
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  // Comment Reply State
  const [postText, setPostText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentPlatform, setCommentPlatform] = useState<Platform>('Instagram Post');
  const [replyObjective, setReplyObjective] = useState('');
  const [generatedReply, setGeneratedReply] = useState<CommentReply | null>(null);
  const [objectiveSuggestions, setObjectiveSuggestions] = useState<string[]>([]);
  const [objectiveStatus, setObjectiveStatus] = useState<GenerationStep>('idle');
  const [objectiveError, setObjectiveError] = useState<string | null>(null);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    try {
        const savedHistory = localStorage.getItem('blogGenerationHistory');
        if (savedHistory) {
            const parsedHistory = JSON.parse(savedHistory);
            if (Array.isArray(parsedHistory)) setGenerationHistory(parsedHistory);
        }
        const savedVoicesData = localStorage.getItem('savedBrandVoices');
        if (savedVoicesData) {
            const parsedVoices = JSON.parse(savedVoicesData);
            if (Array.isArray(parsedVoices)) setSavedVoices(parsedVoices);
        }
    } catch (e) {
        console.error("Failed to load data", e);
    }
  }, []);

  useEffect(() => {
      localStorage.setItem('blogGenerationHistory', JSON.stringify(generationHistory));
  }, [generationHistory]);

  useEffect(() => {
      localStorage.setItem('savedBrandVoices', JSON.stringify(savedVoices));
  }, [savedVoices]);

  const handleSaveVoice = () => {
      if (!brandVoiceSystem || !brandName || !brandIndustry) return;
      const newVoice: SavedBrandVoice = {
          id: Date.now().toString(),
          name: brandName,
          industry: brandIndustry,
          system: brandVoiceSystem,
          createdAt: Date.now()
      };
      const existingIndex = savedVoices.findIndex(v => v.name.toLowerCase() === brandName.toLowerCase());
      if (existingIndex >= 0) {
          const updatedVoices = [...savedVoices];
          updatedVoices[existingIndex] = { ...updatedVoices[existingIndex], system: brandVoiceSystem };
          setSavedVoices(updatedVoices);
      } else {
          setSavedVoices(prev => [...prev, newVoice]);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleLoadVoice = (voice: SavedBrandVoice) => {
      setBrandName(voice.name);
      setBrandIndustry(voice.industry);
      setFormBrandName(voice.name);
      setFormIndustry(voice.industry);
      setBrandVoiceSystem(voice.system);
      setView('define');
      setGeneratedReply(null);
      setActiveProcessId(null);
  };

  const handleDeleteVoice = (id: string) => {
      setSavedVoices(prev => prev.filter(v => v.id !== id));
  };

  const handleGenerateBrandVoice = useCallback(async (data: { name: string; industry: string; expertInputs?: ExpertBrandInputs }) => {
    setStatus('loading');
    setError(null);
    setBrandVoiceSystem(null);
    setBrandName(data.name);
    setBrandIndustry(data.industry);
    try {
      const system = await geminiService.generateBrandVoiceSystem(data.name, data.industry, data.expertInputs);
      setBrandVoiceSystem(system);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate brand voice system.');
      setStatus('error');
    }
  }, []);
  
  const handleRegenerateComponent = useCallback(async (key: keyof BrandVoiceSystem) => {
    if (!brandVoiceSystem) return;
    setRegeneratingComponent(key);
    setError(null);
    try {
        const updatedPart = await geminiService.regenerateBrandVoiceComponent(brandVoiceSystem, key);
        setBrandVoiceSystem(prev => ({...prev!, ...updatedPart}));
    } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to regenerate ${key}.`);
    } finally {
        setRegeneratingComponent(null);
    }
  }, [brandVoiceSystem]);
  
  const handleOpenEditModal = (key: keyof BrandVoiceSystem, title: string) => {
    if (!brandVoiceSystem) return;
    const value = brandVoiceSystem[key];
    let stringValue;
    if (Array.isArray(value)) {
      if(value.length > 0 && typeof value[0] === 'object') {
        stringValue = JSON.stringify(value, null, 2);
      } else {
        stringValue = value.join(', ');
      }
    } else if (typeof value === 'object') {
        stringValue = JSON.stringify(value, null, 2);
    } else {
        stringValue = String(value);
    }
    setEditingValue(stringValue);
    setEditingComponent({ key, title });
  };
  
  const handleSaveEdit = () => {
    if (!editingComponent || !brandVoiceSystem) return;
    const { key } = editingComponent;
    let newValue;
    try {
      const originalValue = brandVoiceSystem[key];
       if (Array.isArray(originalValue)) {
         if(originalValue.length > 0 && typeof originalValue[0] === 'object') {
            newValue = JSON.parse(editingValue);
         } else {
            newValue = editingValue.split(',').map(s => s.trim()).filter(Boolean);
         }
       } else if (typeof originalValue === 'object') {
         newValue = JSON.parse(editingValue);
       } else {
         newValue = editingValue;
       }
       setBrandVoiceSystem(prev => ({ ...prev!, [key]: newValue }));
       setEditingComponent(null);
    } catch (e) {
      setError("Invalid format. For complex items, ensure it's valid JSON.");
    }
  };

  const updateProcessInHistory = (processId: string, updater: (draft: BlogGenerationProcess) => void) => {
    setGenerationHistory(currentHistory =>
        currentHistory.map(p => {
            if (p.id === processId) {
                const updatedProcess = { ...p };
                updater(updatedProcess);
                return updatedProcess;
            }
            return p;
        })
    );
  };
  
  const handleGenerateContent = useCallback(async () => {
    if (!brandVoiceSystem || !contentTopic) return;
    const newProcess: BlogGenerationProcess = {
        id: Date.now().toString(),
        topic: contentTopic,
        brandName: brandName,
        platform: contentPlatform,
        status: 'loading',
        currentStep: 'research',
        error: null, research: null, competition: null, keywords: null, outline: null, blogPost: null, imageUrl: null,
        system: brandVoiceSystem, 
    };
    setGenerationHistory(prev => [newProcess, ...prev]);
    setActiveProcessId(newProcess.id);
    setView('content'); 
    try {
        const researchData = await geminiService.performResearch(contentTopic, brandVoiceSystem, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => { draft.research = researchData; draft.currentStep = 'competition'; });
        
        const competitionData = await geminiService.analyzeCompetition(contentTopic, researchData, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => { draft.competition = competitionData; draft.currentStep = 'keywords'; });
        
        const keywordsData = await geminiService.identifyKeywords(contentTopic, researchData, competitionData);
        updateProcessInHistory(newProcess.id, draft => { draft.keywords = keywordsData; draft.currentStep = 'outline'; });
        
        const outlineData = await geminiService.createOutlineWithIntent(contentTopic, keywordsData, researchData, brandVoiceSystem, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => { draft.outline = outlineData; draft.currentStep = 'generation'; });
        
        // Generate text and image in parallel (or sequence if preferred, parallel is faster)
        const [blogPost, imageUrl] = await Promise.all([
            geminiService.generateFullBlogPost(contentTopic, brandVoiceSystem, researchData, keywordsData, outlineData, contentPlatform),
            geminiService.generateBlogImage(contentTopic, brandVoiceSystem)
        ]);

        updateProcessInHistory(newProcess.id, draft => { 
            draft.blogPost = blogPost; 
            draft.imageUrl = imageUrl;
            draft.status = 'done'; 
            draft.currentStep = 'done'; 
        });
    } catch(e) {
        const message = e instanceof Error ? e.message : 'An error occurred.';
        updateProcessInHistory(newProcess.id, draft => { draft.error = message; draft.status = 'error'; });
    }
  }, [brandVoiceSystem, contentTopic, contentPlatform, brandName]);

  const handleRerunStep = useCallback(async (processId: string, stepToRerun: StepName) => {
    const processToRerun = generationHistory.find(p => p.id === processId);
    const systemToUse = processToRerun?.system || brandVoiceSystem;
    if (!systemToUse || !processToRerun) return;
    const { platform } = processToRerun;
    updateProcessInHistory(processId, draft => {
        const rerunIndex = stepOrder.indexOf(stepToRerun);
        stepOrder.forEach((step, index) => { if (index >= rerunIndex) (draft as any)[step] = null; });
        draft.status = 'loading'; draft.currentStep = stepToRerun; draft.error = null; draft.blogPost = null; draft.imageUrl = null;
    });
    const updatedProcess = generationHistory.find(p => p.id === processId)!;
    try {
        let { research: researchData, competition: competitionData, keywords: keywordsData, outline: outlineData } = updatedProcess;
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('research')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'research'; });
            researchData = await geminiService.performResearch(updatedProcess.topic, systemToUse, platform);
            updateProcessInHistory(processId, d => { d.research = researchData; });
        }
        if (!researchData) throw new Error("Research data missing.");
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('competition')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'competition'; });
            competitionData = await geminiService.analyzeCompetition(updatedProcess.topic, researchData, platform);
            updateProcessInHistory(processId, d => { d.competition = competitionData; });
        }
        if (!competitionData) throw new Error("Competition data missing.");
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('keywords')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'keywords'; });
            keywordsData = await geminiService.identifyKeywords(updatedProcess.topic, researchData, competitionData);
            updateProcessInHistory(processId, d => { d.keywords = keywordsData; });
        }
        if (!keywordsData) throw new Error("Keywords data missing.");
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('outline')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'outline'; });
            outlineData = await geminiService.createOutlineWithIntent(updatedProcess.topic, keywordsData, researchData, systemToUse, platform);
            updateProcessInHistory(processId, d => { d.outline = outlineData; });
        }
        if (!outlineData) throw new Error("Outline data missing.");
        
        updateProcessInHistory(processId, d => { d.currentStep = 'generation'; });
        
        const [blogPost, imageUrl] = await Promise.all([
            geminiService.generateFullBlogPost(updatedProcess.topic, systemToUse, researchData, keywordsData, outlineData, platform),
            geminiService.generateBlogImage(updatedProcess.topic, systemToUse)
        ]);

        updateProcessInHistory(processId, d => { 
            d.blogPost = blogPost; 
            d.imageUrl = imageUrl;
            d.status = 'done'; 
            d.currentStep = 'done'; 
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Error during re-generation.';
        updateProcessInHistory(processId, draft => { draft.error = message; draft.status = 'error'; });
    }
  }, [brandVoiceSystem, generationHistory]);

  const handleGenerateTopicSuggestions = useCallback(async () => {
    if (!brandIndustry || !brandName) return;
    setSuggestionStatus('loading');
    setSuggestionError(null);
    setTopicSuggestions([]);
    try {
        const suggestions = await geminiService.generateTopicSuggestions(brandIndustry, brandName);
        setTopicSuggestions(suggestions);
        setSuggestionStatus('done');
    } catch (e) {
        setSuggestionError(e instanceof Error ? e.message : 'Failed to generate suggestions.');
        setSuggestionStatus('error');
    }
  }, [brandIndustry, brandName]);

  const handleGenerateReply = useCallback(async () => {
    if (!brandVoiceSystem || !commentText) return;
    setStatus('loading');
    setError(null);
    setGeneratedReply(null);
    try {
        const reply = await geminiService.generateCommentReply(brandVoiceSystem, commentPlatform, postText, commentText, replyObjective);
        setGeneratedReply(reply);
        setStatus('done');
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Failed to generate reply.');
        setStatus('error');
    }
  }, [brandVoiceSystem, commentPlatform, postText, commentText, replyObjective]);

  const handleGenerateReplyObjectives = useCallback(async () => {
    if (!postText || !commentText) return;
    setObjectiveStatus('loading');
    setObjectiveError(null);
    setObjectiveSuggestions([]);
    try {
        const suggestions = await geminiService.generateReplyObjectives(commentPlatform, postText, commentText);
        setObjectiveSuggestions(suggestions);
        setObjectiveStatus('done');
    } catch (e) {
        setObjectiveError(e instanceof Error ? e.message : 'Failed to suggest objectives.');
        setObjectiveStatus('error');
    }
  }, [commentPlatform, postText, commentText]);

  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  const handleNewPost = () => {
    setActiveProcessId(null);
    setContentTopic('');
    setTopicSuggestions([]);
    setSuggestionStatus('idle');
    setView('content');
  };

  const handleDeleteHistoryItem = (idToDelete: string) => {
    setGenerationHistory(prev => prev.filter(p => p.id !== idToDelete));
    if (activeProcessId === idToDelete) setActiveProcessId(null);
  };

  const NavButton = ({ currentView, targetView, children }: { currentView: View; targetView: View; children?: React.ReactNode; }) => (
    <button
      onClick={() => setView(targetView)}
      className={`relative flex-1 py-4 text-sm font-medium transition-all outline-none ${currentView === targetView ? 'text-[#1a73e8]' : 'text-[#5f6368] hover:text-[#202124]'} ${!brandVoiceSystem && targetView !== 'define' ? 'opacity-40 cursor-not-allowed' : ''}`}
      disabled={!brandVoiceSystem && targetView !== 'define'}
    >
      {children}
      {currentView === targetView && (
          <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#1a73e8] rounded-t-full animate-scaleIn"></span>
      )}
    </button>
  );
  
  const activeProcess = generationHistory.find(p => p.id === activeProcessId);
  const isGenerating = activeProcess?.status === 'loading';

  return (
    <div className="min-h-screen">
        {editingComponent && (
            <EditModal 
                title={editingComponent.title}
                value={editingValue}
                setValue={setEditingValue}
                onSave={handleSaveEdit}
                onCancel={() => setEditingComponent(null)}
            />
        )}
        {isHistoryVisible && (
            <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md border border-gray-100 h-[70vh] flex flex-col animate-scaleIn overflow-hidden">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-normal text-[#202124]">History</h2>
                <button onClick={() => setIsHistoryVisible(false)} className="text-gray-400 hover:text-gray-700 p-2 rounded-full hover:bg-gray-50 transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {generationHistory.length > 0 ? generationHistory.map(p => (
                    <div key={p.id} className="group">
                    <button
                        onClick={() => {
                        setActiveProcessId(p.id);
                        setIsHistoryVisible(false);
                        setView('content');
                        }}
                        className={`w-full text-left p-4 rounded-2xl transition-all text-sm flex items-start gap-3 border ${activeProcessId === p.id ? 'bg-[#e8f0fe] border-[#1a73e8] text-[#1967d2]' : 'bg-white border-gray-200 hover:border-gray-300 text-[#3c4043]'}`}
                    >
                        <FileTextIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${activeProcessId === p.id ? 'text-[#1a73e8]' : 'text-gray-400'}`} />
                        <div className="truncate flex-grow">
                             <div className="font-medium truncate">{p.topic}</div>
                             <div className="text-xs opacity-70 mt-0.5">{p.platform}</div>
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(p.id); }} className="text-gray-400 hover:text-[#d93025] opacity-0 group-hover:opacity-100 transition p-1.5 rounded-full hover:bg-red-50">
                            <TrashIcon className="w-4 h-4" />
                        </div>
                    </button>
                    </div>
                )) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <HistoryIcon className="w-10 h-10 mb-3 opacity-20"/>
                        <p className="text-sm">No history available</p>
                    </div>
                )}
                </div>
            </div>
            </div>
        )}
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                 <BotIcon className="w-6 h-6 text-[#1a73e8]" />
            </div>
            <div>
                <h1 className="text-2xl font-normal text-[#202124] tracking-tight">
                Bellbird
                </h1>
                <p className="text-sm text-[#5f6368] mt-0.5">Powered by Gemini 2.5</p>
            </div>
          </div>
        </header>

        <div className="flex justify-center mb-10">
             <nav className="flex w-full max-w-lg border-b border-gray-200">
                <NavButton currentView={view} targetView="define">Define Voice</NavButton>
                <NavButton currentView={view} targetView="content">Create Content</NavButton>
                <NavButton currentView={view} targetView="reply">Comment</NavButton>
            </nav>
        </div>

        {error && (
            <div className="bg-[#fce8e6] border border-[#f1998e] text-[#c5221f] p-4 rounded-2xl flex items-center mb-8 animate-scaleIn">
            <AlertTriangleIcon className="w-5 h-5 mr-3 text-[#d93025]"/>
            <div>
                <h3 className="font-medium text-sm">Something went wrong</h3>
                <p className="text-sm opacity-90 mt-0.5">{error}</p>
            </div>
            </div>
        )}
         {activeProcess?.error && (
             <div className="bg-[#fce8e6] border border-[#f1998e] text-[#c5221f] p-4 rounded-2xl flex items-center mb-8 animate-scaleIn">
                <AlertTriangleIcon className="w-5 h-5 mr-3 text-[#d93025]"/>
                <div>
                    <h3 className="font-medium text-sm">Generation Error</h3>
                    <p className="text-sm opacity-90 mt-0.5">{activeProcess.error}</p>
                </div>
             </div>
         )}

        <div className={view === 'define' ? 'block' : 'hidden'}>
          <BrandVoiceInput 
            onGenerate={handleGenerateBrandVoice} 
            isLoading={status === 'loading'} 
            generatedSystem={brandVoiceSystem}
            savedVoices={savedVoices}
            onLoadVoice={handleLoadVoice}
            onDeleteVoice={handleDeleteVoice}
            brandName={formBrandName}
            setBrandName={setFormBrandName}
            industry={formIndustry}
            setIndustry={setFormIndustry}
          />
        </div>

        {brandVoiceSystem && (
          <>
            {view === 'content' && (
              <div className="animate-fadeIn">
                <div className={`flex justify-between items-center mb-6 mx-auto transition-all duration-500 ease-in-out ${activeProcess ? 'max-w-4xl' : 'max-w-3xl'}`}>
                    <h2 className="text-2xl font-normal text-[#202124] tracking-tight">
                    {activeProcess ? '' : 'Content Studio'}
                    </h2>
                    <button 
                    onClick={() => setIsHistoryVisible(true)} 
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 text-[#5f6368] font-medium py-2 px-5 rounded-full border border-gray-200 hover:border-gray-300 transition-all text-sm shadow-sm"
                    >
                        <HistoryIcon className="w-4 h-4" />
                        <span>History</span>
                    </button>
                </div>
                
                <div>
                    {!activeProcessId ? (
                        <div className="bg-white p-8 rounded-[24px] shadow-sm border border-gray-200 max-w-3xl mx-auto animate-slideUp">
                            <div className="space-y-8">
                                <div>
                                    <label htmlFor="contentPlatform" className="block text-sm font-medium text-[#202124] mb-3 ml-1">Platform</label>
                                    <div className="relative">
                                        <select 
                                            id="contentPlatform" 
                                            value={contentPlatform} 
                                            onChange={e => setContentPlatform(e.target.value as Platform)} 
                                            className="w-full bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-xl px-4 py-4 text-[#202124] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] transition outline-none appearance-none text-sm"
                                        >
                                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="topic" className="block text-sm font-medium text-[#202124] mb-3 ml-1">Topic or Goal</label>
                                    <textarea 
                                        id="topic" 
                                        value={contentTopic} 
                                        onChange={e => setContentTopic(e.target.value)} 
                                        placeholder="e.g., 5 Best Study Apps for College Students in 2025" 
                                        className="w-full h-40 bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-xl px-4 py-4 text-[#202124] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] transition outline-none resize-none text-sm leading-relaxed" 
                                    />
                                </div>
                                
                                <div className="pt-2">
                                    <div className="flex items-center gap-2 mb-4">
                                        <SparklesIcon className="w-4 h-4 text-[#1a73e8]" />
                                         <span className="text-xs font-bold text-[#1a73e8] uppercase tracking-widest">AI Suggestions</span>
                                    </div>
                                    
                                    {topicSuggestions.length === 0 && (
                                        <button 
                                            onClick={handleGenerateTopicSuggestions} 
                                            disabled={suggestionStatus === 'loading'} 
                                            className={`text-sm px-4 py-2 rounded-full transition-all flex items-center gap-2 font-medium ${
                                                suggestionStatus === 'loading' 
                                                ? 'animate-shimmer-button text-white shadow-md border-transparent' 
                                                : 'bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#202124] border border-transparent'
                                            }`}
                                        >
                                            {suggestionStatus === 'loading' ? (
                                                <>
                                                    <SparklesIcon className="w-4 h-4 animate-pulse" />
                                                    <span>Thinking...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <SparklesIcon className="w-4 h-4 text-[#1a73e8]" />
                                                    <span>Get Topic Ideas</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                    
                                    {suggestionError && <p className="text-[#d93025] text-sm mt-2">{suggestionError}</p>}
                                    
                                    {topicSuggestions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 animate-fadeIn">
                                            {topicSuggestions.map((topic, index) => (
                                                <button key={index} onClick={() => setContentTopic(topic)} className="bg-white text-[#3c4043] hover:text-[#1a73e8] hover:border-[#1a73e8] hover:bg-[#f8fbff] text-sm px-4 py-2 rounded-full transition-all border border-gray-200 shadow-sm text-left">
                                                    {topic}
                                                </button>
                                            ))}
                                             <button onClick={handleGenerateTopicSuggestions} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors" title="Refresh ideas"><RefreshCwIcon className="w-4 h-4"/></button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-10 pt-6 border-t border-gray-100">
                                <button 
                                    onClick={handleGenerateContent} 
                                    disabled={!contentTopic || isGenerating} 
                                    className={`w-full flex items-center justify-center text-white font-medium py-3.5 px-6 rounded-full transition-all shadow-md hover:shadow-lg active:scale-[0.99] ${
                                        (!contentTopic && !isGenerating) 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                        : 'animate-shimmer-button hover:opacity-90'
                                    }`}
                                >
                                    {isGenerating ? <LoadingSpinner className="mr-2 w-5 h-5 text-white"/> : <SparklesIcon className="mr-2 w-5 h-5"/>}
                                    {isGenerating ? <span className="animate-pulse">Crafting Content...</span> : 'Start Generation'}
                                </button>
                            </div>
                        </div>
                    ) : activeProcess && (
                        activeProcess.status !== 'done' ? (
                            <BlogGenerationProcessView process={activeProcess} onRerunStep={(step) => handleRerunStep(activeProcess.id, step)} />
                        ) : (
                            <div className="space-y-8 max-w-4xl mx-auto animate-slideUp">
                                <BlogGenerationProcessView process={activeProcess} onRerunStep={(step) => handleRerunStep(activeProcess.id, step)} />
                                
                                <div className="bg-white rounded-[24px] shadow-md border border-gray-200 overflow-hidden">
                                     <div className="bg-[#f8f9fa] border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-[#e6f4ea] p-1.5 rounded-full">
                                                <CheckIcon className="w-4 h-4 text-[#188038]" />
                                            </div>
                                            <span className="text-sm font-medium text-[#202124]">
                                                Generated Content
                                            </span>
                                        </div>
                                        <button onClick={() => handleCopy(activeProcess.blogPost!)} className="text-[#5f6368] hover:text-[#1a73e8] transition-colors flex items-center gap-2 text-sm bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm hover:shadow">
                                            {copyStatus === 'copied' ? <><CheckIcon className="w-4 h-4" /> Copied</> : <><CopyIcon className="w-4 h-4" /> Copy Text</>}
                                        </button>
                                     </div>
                                     <div className="p-10 bg-white min-h-[200px]">
                                        {activeProcess.imageUrl && (
                                            <div className="mb-8 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                                                <img src={activeProcess.imageUrl} alt="Generated Blog Header" className="w-full h-auto object-cover max-h-[400px]" />
                                            </div>
                                        )}
                                        <TypewriterEffect text={activeProcess.blogPost!} />
                                     </div>
                                </div>
                                
                                <div className="flex justify-center pb-12">
                                    <button onClick={handleNewPost} className="relative overflow-hidden flex items-center gap-2 text-white font-medium py-3 px-8 rounded-full transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98] animate-shimmer-button hover:opacity-90">
                                        <SparklesIcon className="w-5 h-5" /> Create Another Post
                                    </button>
                                </div>
                            </div>
                        )
                    )}
                 </div>
              </div>
            )}

            {view === 'reply' && (
              <div className="max-w-3xl mx-auto animate-slideUp">
                <div className="bg-white p-8 rounded-[24px] shadow-sm border border-gray-200 mb-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-[#e8f0fe] rounded-xl">
                            <BotIcon className="w-6 h-6 text-[#1a73e8]"/>
                        </div>
                        <h2 className="text-xl font-normal text-[#202124]">Comment</h2>
                    </div>
                    
                    <div className="space-y-6">
                         <div>
                            <label className="block text-sm font-medium text-[#202124] mb-3 ml-1">Platform</label>
                            <div className="relative">
                                <select value={commentPlatform} onChange={e => setCommentPlatform(e.target.value as Platform)} className="w-full bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-xl px-4 py-3.5 text-[#202124] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] outline-none appearance-none text-sm">
                                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#202124] mb-3 ml-1">Original Post Context</label>
                            <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="Paste the original post content here..." className="w-full h-28 bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-xl px-4 py-3 text-[#202124] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] outline-none resize-none text-sm leading-relaxed" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#202124] mb-3 ml-1">User Comment</label>
                            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Paste the user's comment here..." className="w-full h-24 bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-xl px-4 py-3 text-[#202124] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] outline-none resize-none text-sm leading-relaxed" />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#202124] mb-3 ml-1">Reply Objective</label>
                            <div className="flex gap-2">
                               <input value={replyObjective} onChange={e => setReplyObjective(e.target.value)} placeholder="e.g. Acknowledge and thank" className="flex-grow bg-[#f8f9fa] border border-transparent focus:bg-white border-gray-200 rounded-xl px-4 py-3 text-[#202124] focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a73e8] outline-none text-sm" />
                               <button 
                                    onClick={handleGenerateReplyObjectives} 
                                    disabled={objectiveStatus === 'loading' || status === 'loading' || !postText || !commentText}
                                    className={`flex-shrink-0 rounded-xl px-4 transition-all duration-200 border border-transparent ${
                                        objectiveStatus === 'loading' 
                                        ? 'animate-shimmer-button text-white shadow-md cursor-wait' 
                                        : 'bg-[#f1f3f4] text-[#1a73e8] hover:bg-[#e8f0fe] hover:border-blue-100 disabled:opacity-50'
                                    }`}
                                >
                                    <SparklesIcon className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {objectiveStatus === 'done' && objectiveSuggestions.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2 animate-fadeIn">
                                    {objectiveSuggestions.map((objective, index) => (
                                        <button key={index} onClick={() => setReplyObjective(objective)} className="bg-white border border-gray-200 hover:border-[#1a73e8] text-gray-600 hover:text-[#1a73e8] text-xs px-3 py-1.5 rounded-full transition-colors duration-200">
                                            {objective}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-gray-100">
                        <button 
                            onClick={handleGenerateReply} 
                            disabled={status === 'loading' || objectiveStatus === 'loading' || !commentText || !postText || !replyObjective} 
                            className={`w-full flex items-center justify-center font-medium py-3 px-6 rounded-full transition-all shadow-md hover:shadow-lg ${
                                ((objectiveStatus === 'loading' || !commentText || !postText || !replyObjective) && status !== 'loading')
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'animate-shimmer-button text-white hover:opacity-90'
                            }`}
                        >
                            {status === 'loading' ? (
                                <>
                                    <SparklesIcon className="mr-2 w-5 h-5 animate-pulse"/>
                                    <span className="animate-pulse">Analyzing...</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="mr-2 w-5 h-5"/>
                                    Generate Replies
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {generatedReply && (
                    <div className="bg-white p-8 rounded-[24px] shadow-sm border border-gray-200 relative overflow-hidden animate-slideUp">
                        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                             <div className="bg-[#e6f4ea] text-[#188038] px-3 py-1 rounded-full text-[11px] font-bold border border-green-100 uppercase tracking-wide flex-shrink-0 mt-0.5">
                                Analysis
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed flex-grow">
                                <strong className="text-gray-900 font-medium">{generatedReply.analysis.sentiment} Sentiment.</strong> {generatedReply.analysis.notes}
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            {generatedReply.variations.map((reply, i) => (
                                <div key={i} className="p-5 bg-[#f8f9fa] rounded-2xl border border-transparent hover:border-blue-200 hover:bg-white hover:shadow-sm transition-all duration-300 group relative">
                                    <p className="text-gray-800 leading-relaxed text-sm pr-8">{reply}</p>
                                    <button onClick={() => handleCopy(reply)} className="absolute top-4 right-4 text-gray-400 hover:text-[#1a73e8] p-1.5 rounded-full hover:bg-blue-50 transition opacity-0 group-hover:opacity-100">
                                        {copyStatus === 'copied' ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            )}

            <div className={`mt-16 transition-all duration-700 ease-out ${!brandVoiceSystem ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                <div className="flex items-center justify-between mb-8 border-b border-gray-200 pb-4">
                    <div>
                        <h2 className="text-2xl font-normal text-[#202124]">System Overview</h2>
                        <p className="text-sm text-[#5f6368] mt-1">Core components of your generated brand identity</p>
                    </div>
                    <button
                        onClick={handleSaveVoice}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all shadow-sm ${saveStatus === 'saved' ? 'bg-[#34a853] text-white border border-transparent' : 'bg-white text-[#1a73e8] border border-gray-200 hover:bg-[#f8fbff] hover:border-[#1a73e8]'}`}
                    >
                        {saveStatus === 'saved' ? (
                            <><CheckCircleIcon className="w-4 h-4" /> Saved</>
                        ) : (
                            <><SaveIcon className="w-4 h-4" /> Save Voice</>
                        )}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 stagger-children">
                    <div className="animate-slideUp delay-100"><BrandComponentDisplay title="Brand Essence" onEdit={() => handleOpenEditModal('essence', 'Brand Essence')} onRegenerate={() => handleRegenerateComponent('essence')}>{regeneratingComponent === 'essence' ? <LoadingSpinner/> : <p className="text-lg font-normal leading-relaxed text-[#202124]">{brandVoiceSystem.essence}</p>}</BrandComponentDisplay></div>
                    <div className="animate-slideUp delay-200"><BrandComponentDisplay title="Personality Traits" onEdit={() => handleOpenEditModal('personalityTraits', 'Personality Traits')} onRegenerate={() => handleRegenerateComponent('personalityTraits')}>{regeneratingComponent === 'personalityTraits' ? <LoadingSpinner/> : <div className="flex flex-wrap gap-2">{brandVoiceSystem.personalityTraits.map(t => <span key={t} className="bg-[#e8f0fe] text-[#1a73e8] border border-blue-100 px-3 py-1.5 rounded-full text-sm font-medium">{t}</span>)}</div>}</BrandComponentDisplay></div>
                    <div className="animate-slideUp delay-300">
                        <BrandComponentDisplay title="Tone Guidelines" onEdit={() => handleOpenEditModal('toneGuidelines', 'Tone Guidelines')} onRegenerate={() => handleRegenerateComponent('toneGuidelines')}>
                        {regeneratingComponent === 'toneGuidelines' ? <LoadingSpinner/> : (
                            <ul className="space-y-3">
                                {brandVoiceSystem.toneGuidelines.map(t => (
                                    <li key={t.name} className="flex flex-col gap-1 p-3 bg-[#f8f9fa] rounded-xl border border-transparent hover:border-gray-200 transition-colors">
                                        <strong className="text-[#1a73e8] text-xs uppercase tracking-wider">{t.name}</strong>
                                        <span className="text-[#3c4043]">{t.description}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </BrandComponentDisplay>
                    </div>
                    <div className="animate-slideUp delay-300">
                        <BrandComponentDisplay title="Writing Style" onEdit={() => handleOpenEditModal('writingStyle', 'Writing Style')} onRegenerate={() => handleRegenerateComponent('writingStyle')}>
                        {regeneratingComponent === 'writingStyle' ? <LoadingSpinner/> : <p className="leading-relaxed text-[#3c4043]">{brandVoiceSystem.writingStyle}</p>}
                        </BrandComponentDisplay>
                    </div>
                    <BrandComponentDisplay title="Do & Don't Rules" onEdit={() => handleOpenEditModal('keyRules', "Do & Don't Rules")} onRegenerate={() => handleRegenerateComponent('keyRules')}>
                         {regeneratingComponent === 'keyRules' ? <LoadingSpinner/> : (
                            <ul className="space-y-2.5">
                                {brandVoiceSystem.keyRules && brandVoiceSystem.keyRules.length > 0 ? brandVoiceSystem.keyRules.map((r, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <ListChecksIcon className="w-5 h-5 text-[#1a73e8] flex-shrink-0 mt-0.5"/>
                                        <span className="text-[#3c4043]">{r}</span>
                                    </li>
                                )) : <p className="text-gray-400 italic">No specific rules generated.</p>}
                            </ul>
                         )}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Vocabulary" onEdit={() => handleOpenEditModal('vocabulary', 'Vocabulary')} onRegenerate={() => handleRegenerateComponent('vocabulary')}>
                        {regeneratingComponent === 'vocabulary' ? <LoadingSpinner/> : (
                            <div className="space-y-5">
                                <div>
                                    <h4 className="text-[10px] font-bold text-[#188038] uppercase tracking-widest mb-3">Use</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {brandVoiceSystem.vocabulary.use.map(v => <span key={v} className="bg-white border border-[#ceead6] text-[#137333] px-3 py-1 rounded-full text-sm shadow-sm">{v}</span>)}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-[#d93025] uppercase tracking-widest mb-3">Avoid</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {brandVoiceSystem.vocabulary.avoid.map(v => <span key={v} className="bg-white border border-[#fad2cf] text-[#c5221f] px-3 py-1 rounded-full text-sm line-through opacity-80">{v}</span>)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Messaging Pillars" onEdit={() => handleOpenEditModal('messagingPillars', 'Messaging Pillars')} onRegenerate={() => handleRegenerateComponent('messagingPillars')}>
                        {regeneratingComponent === 'messagingPillars' ? <LoadingSpinner/> : (
                            <ul className="space-y-2">
                                {brandVoiceSystem.messagingPillars.map((p, i) => (
                                     <li key={i} className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] mt-2 flex-shrink-0"></span>
                                        <span className="text-[#3c4043] leading-relaxed">{p}</span>
                                     </li>
                                ))}
                            </ul>
                        )}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Target Audience" onEdit={() => handleOpenEditModal('targetAudience', 'Target Audience')} onRegenerate={() => handleRegenerateComponent('targetAudience')}>
                        {regeneratingComponent === 'targetAudience' ? <LoadingSpinner/> : <p className="leading-relaxed text-[#3c4043]">{brandVoiceSystem.targetAudience}</p>}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Audience Resonance" onEdit={() => handleOpenEditModal('audienceResonance', 'Audience Resonance')} onRegenerate={() => handleRegenerateComponent('audienceResonance')}>
                        {regeneratingComponent === 'audienceResonance' ? <LoadingSpinner/> : <p className="leading-relaxed text-[#3c4043]">{brandVoiceSystem.audienceResonance}</p>}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Voice in Action" onEdit={() => handleOpenEditModal('voiceInActionExamples', 'Voice in Action Examples')} onRegenerate={() => handleRegenerateComponent('voiceInActionExamples')}>
                        {regeneratingComponent === 'voiceInActionExamples' ? <LoadingSpinner/> : (
                            <div className="space-y-4">
                                {brandVoiceSystem.voiceInActionExamples.map((ex, i) => (
                                    <div key={i} className="pl-4 border-l-[3px] border-[#8ab4f8] italic text-[#5f6368] py-1">
                                        "{ex}"
                                    </div>
                                ))}
                            </div>
                        )}
                    </BrandComponentDisplay>
                </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;