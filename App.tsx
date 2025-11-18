
import React, { useState, useCallback, useEffect } from 'react';
import BrandVoiceInput from './components/InputForm';
import BrandComponentDisplay from './components/StepDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import EditModal from './components/EditModal';
import { BotIcon, AlertTriangleIcon, DownloadIcon, CopyIcon, CheckIcon, UsersIcon, BookTextIcon, SparklesIcon, SearchIcon, TrophyIcon, KeyIcon, ListChecksIcon, FileTextIcon, LinkIcon, CheckCircleIcon, RefreshCwIcon, PlusCircleIcon, TrashIcon, HistoryIcon, XIcon } from './components/icons';
import {
  BrandVoiceSystem,
  ExpertBrandInputs,
  GenerationStep,
  PLATFORMS,
  Platform,
  CommentReply,
  BlogGenerationProcess
} from './types';
import * as geminiService from './services/geminiService';

// (Markdown to HTML helper functions remain the same)
const processInline = (text: string): string => {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-700 text-sm rounded px-1 py-0.5">$1</code>');
};
const markdownToHtml = (md: string): string => {
  if (!md) return '';
  return md.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (block.startsWith('# ')) return `<h1 class="text-3xl font-bold mb-4">${processInline(block.slice(2))}</h1>`;
    if (block.startsWith('## ')) return `<h2 class="text-2xl font-bold mt-6 mb-3">${processInline(block.slice(3))}</h2>`;
    if (block.startsWith('### ')) return `<h3 class="text-xl font-bold mt-4 mb-2">${processInline(block.slice(4))}</h3>`;
    if (block.match(/^(\*|-|\+) .+/)) {
      const items = block.split('\n').map(item => `<li class="ml-5">${processInline(item.replace(/^(\*|-|\+) /, ''))}</li>`).join('');
      return `<ul class="list-disc pl-5 mb-4">${items}</ul>`;
    }
    if (block.match(/^\d+\. .+/)) {
      const items = block.split('\n').map(item => `<li class="ml-5">${processInline(item.replace(/^\d+\\. /, ''))}</li>`).join('');
      return `<ol class="list-decimal pl-5 mb-4">${items}</ul>`;
    }
    return `<p class="mb-4">${processInline(block.replace(/\n/g, '<br />'))}</p>`;
  }).join('');
};


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


const StepCard = ({ title, icon, status, children, onRerun }: { title: string, icon: React.ReactNode, status: StepStatus, children?: React.ReactNode, onRerun?: () => void }) => {
    const statusStyles = {
        pending: { border: 'border-slate-700', bg: 'bg-slate-800/30', text: 'text-slate-400' },
        in_progress: { border: 'border-indigo-500', bg: 'bg-indigo-900/20', text: 'text-indigo-300' },
        done: { border: 'border-teal-500', bg: 'bg-teal-900/20', text: 'text-teal-300' },
        error: { border: 'border-red-500', bg: 'bg-red-900/20', text: 'text-red-300' },
    };
    const currentStyle = statusStyles[status];
    
    return (
        <div className={`border ${currentStyle.border} ${currentStyle.bg} rounded-lg transition-all`}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <div className={`p-1 rounded-full ${currentStyle.bg}`}>
                        {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${currentStyle.text}` })}
                    </div>
                    <h3 className={`font-semibold text-lg ${currentStyle.text}`}>{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'in_progress' && <LoadingSpinner className={`w-5 h-5 ${currentStyle.text}`} />}
                    {status === 'done' && onRerun && (
                         <button onClick={onRerun} className="text-slate-400 hover:text-indigo-400 transition-colors p-1 rounded-full hover:bg-slate-700 flex items-center gap-1.5 text-xs px-2" title={`Re-run ${title}`}>
                             <RefreshCwIcon className="w-3 h-3" />
                             Re-run
                         </button>
                    )}
                    {status === 'done' && !onRerun && <CheckCircleIcon className="w-5 h-5 text-teal-500" />}
                    {status === 'error' && <AlertTriangleIcon className="w-5 h-5 text-red-500" />}
                </div>
            </div>
            {(status === 'done' || status === 'in_progress') && <div className="p-4">{children}</div>}
        </div>
    );
};

const BlogGenerationProcessView = ({ process, onRerunStep }: { process: BlogGenerationProcess, onRerunStep: (step: StepName) => void }) => {
    const canRerun = process.status === 'done';
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-center">Generating Your {process.platform}: "{process.topic}"</h2>
            
            <StepCard title="Research" icon={<SearchIcon />} status={getStepStatus('research', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('research') : undefined}>
                {process.research && (
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-teal-400 mb-2">Key Insights Gathered:</h4>
                            <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                {process.research.insights.map((insight, i) => <li key={i}>{insight}</li>)}
                            </ul>
                        </div>
                        <div>
                             <h4 className="font-semibold text-teal-400 mb-2">Sources Found:</h4>
                             <div className="flex flex-col gap-2">
                                {process.research.groundingSources?.map((source, i) => (
                                    <a key={i} href={source.web?.uri || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:underline flex items-center gap-2">
                                        <LinkIcon className="w-4 h-4" /> <span>{source.web?.title || 'Untitled Source'}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </StepCard>

            <StepCard title="Competitive Analysis" icon={<TrophyIcon />} status={getStepStatus('competition', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('competition') : undefined}>
                {process.competition && (
                     <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-teal-400 mb-2">Analysis Summary:</h4>
                            <p className="text-slate-300">{process.competition.analysis}</p>
                        </div>
                         <div>
                             <h4 className="font-semibold text-teal-400 mb-2">Top Competitor Posts:</h4>
                             <div className="flex flex-col gap-2">
                                {process.competition.groundingSources?.map((source, i) => (
                                     <a key={i} href={source.web?.uri || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:underline flex items-center gap-2">
                                        <LinkIcon className="w-4 h-4" /> <span>{source.web?.title || 'Untitled Source'}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </StepCard>
            
            <StepCard title="Keyword Identification" icon={<KeyIcon />} status={getStepStatus('keywords', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('keywords') : undefined}>
                {process.keywords && (
                    <div className="space-y-2">
                        <div>
                            <h4 className="font-semibold text-teal-400">Primary Keyword:</h4>
                            <p className="bg-teal-500/20 text-teal-300 px-2 py-1 rounded inline-block">{process.keywords.primary}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-teal-400">Secondary Keywords:</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {process.keywords.secondary.map(k => <span key={k} className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-sm">{k}</span>)}
                            </div>
                        </div>
                    </div>
                )}
            </StepCard>
            
            <StepCard title="Outline with Intent" icon={<ListChecksIcon />} status={getStepStatus('outline', process.currentStep, process.status)} onRerun={canRerun ? () => onRerunStep('outline') : undefined}>
                {process.outline && (
                    <ul className="space-y-3">
                        {process.outline.map((item, i) => (
                            <li key={i} className="p-2 bg-slate-900/50 rounded-md border-l-4 border-slate-700">
                                <h4 className="font-bold text-slate-200">{item.sectionTitle}</h4>
                                <p className="text-sm text-indigo-300 pl-2 border-l-2 border-indigo-800 ml-2 mt-1 italic"><strong>Intent:</strong> {item.intent}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </StepCard>

            <StepCard title="Content Generation" icon={<FileTextIcon />} status={getStepStatus('generation', process.currentStep, process.status)}>
                { getStepStatus('generation', process.currentStep, process.status) === 'in_progress' && 
                    <p className="text-slate-400">Writing the full content based on the structured plan...</p>
                }
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
  const [editingComponent, setEditingComponent] = useState<{key: keyof BrandVoiceSystem, title: string} | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [regeneratingComponent, setRegeneratingComponent] = useState<keyof BrandVoiceSystem | null>(null);


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

  // Load history from localStorage on initial mount
  useEffect(() => {
    try {
        const savedHistory = localStorage.getItem('blogGenerationHistory');
        if (savedHistory) {
            const parsedHistory = JSON.parse(savedHistory);
            if (Array.isArray(parsedHistory)) {
                setGenerationHistory(parsedHistory);
            } else {
                console.warn("History data in localStorage is not an array, discarding.");
                localStorage.removeItem('blogGenerationHistory');
            }
        }
    } catch (e) {
        console.error("Failed to load or parse history from localStorage", e);
        localStorage.removeItem('blogGenerationHistory');
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
      localStorage.setItem('blogGenerationHistory', JSON.stringify(generationHistory));
  }, [generationHistory]);

  const handleGenerateBrandVoice = useCallback(async (data: { mode: InputMode; name: string; industry: string; expertInputs?: ExpertBrandInputs; url?: string }) => {
    setStatus('loading');
    setError(null);
    setBrandVoiceSystem(null);
    setBrandName(data.name);
    setBrandIndustry(data.industry);
    try {
      let system;
      if (data.mode === 'url' && data.url) {
        system = await geminiService.generateBrandVoiceFromURL(data.url, data.name, data.industry);
      } else {
        system = await geminiService.generateBrandVoiceSystem(data.name, data.industry, data.expertInputs);
      }
      setBrandVoiceSystem(system);
      setStatus('done');
      setView('content'); // Move to content generation after defining voice
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
      setError("Invalid format. Please check your input. For complex items, ensure it's valid JSON.");
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
        platform: contentPlatform,
        status: 'loading',
        currentStep: 'research',
        error: null, research: null, competition: null, keywords: null, outline: null, blogPost: null,
    };

    setGenerationHistory(prev => [newProcess, ...prev]);
    setActiveProcessId(newProcess.id);

    try {
        const researchData = await geminiService.performResearch(contentTopic, brandVoiceSystem, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => {
            draft.research = researchData;
            draft.currentStep = 'competition';
        });
        
        const competitionData = await geminiService.analyzeCompetition(contentTopic, researchData, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => {
            draft.competition = competitionData;
            draft.currentStep = 'keywords';
        });

        const keywordsData = await geminiService.identifyKeywords(contentTopic, researchData, competitionData);
        updateProcessInHistory(newProcess.id, draft => {
            draft.keywords = keywordsData;
            draft.currentStep = 'outline';
        });

        const outlineData = await geminiService.createOutlineWithIntent(contentTopic, keywordsData, researchData, brandVoiceSystem, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => {
            draft.outline = outlineData;
            draft.currentStep = 'generation';
        });

        const blogPost = await geminiService.generateFullBlogPost(contentTopic, brandVoiceSystem, researchData, keywordsData, outlineData, contentPlatform);
        updateProcessInHistory(newProcess.id, draft => {
            draft.blogPost = blogPost;
            draft.status = 'done';
            draft.currentStep = 'done';
        });

    } catch(e) {
        const message = e instanceof Error ? e.message : 'An error occurred during blog generation.';
        updateProcessInHistory(newProcess.id, draft => {
            draft.error = message;
            draft.status = 'error';
        });
    }
  }, [brandVoiceSystem, contentTopic, contentPlatform]);

  const handleRerunStep = useCallback(async (processId: string, stepToRerun: StepName) => {
    const processToRerun = generationHistory.find(p => p.id === processId);
    if (!brandVoiceSystem || !processToRerun) return;

    const { platform } = processToRerun;

    // Reset state from the target step onwards
    updateProcessInHistory(processId, draft => {
        const rerunIndex = stepOrder.indexOf(stepToRerun);
        stepOrder.forEach((step, index) => {
            if (index >= rerunIndex) {
                (draft as any)[step] = null;
            }
        });
        draft.status = 'loading';
        draft.currentStep = stepToRerun;
        draft.error = null;
        draft.blogPost = null;
    });
    
    // We need the latest state for the async calls
    const updatedProcess = generationHistory.find(p => p.id === processId)!;

    try {
        let { research: researchData, competition: competitionData, keywords: keywordsData, outline: outlineData } = updatedProcess;
        
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('research')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'research'; });
            researchData = await geminiService.performResearch(updatedProcess.topic, brandVoiceSystem, platform);
            updateProcessInHistory(processId, d => { d.research = researchData; });
        }
        if (!researchData) throw new Error("Research data is missing to proceed.");
        
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('competition')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'competition'; });
            competitionData = await geminiService.analyzeCompetition(updatedProcess.topic, researchData, platform);
            updateProcessInHistory(processId, d => { d.competition = competitionData; });
        }
        if (!competitionData) throw new Error("Competition data is missing to proceed.");
        
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('keywords')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'keywords'; });
            keywordsData = await geminiService.identifyKeywords(updatedProcess.topic, researchData, competitionData);
            updateProcessInHistory(processId, d => { d.keywords = keywordsData; });
        }
        if (!keywordsData) throw new Error("Keywords data is missing to proceed.");
        
        if (stepOrder.indexOf(stepToRerun) <= stepOrder.indexOf('outline')) {
            updateProcessInHistory(processId, d => { d.currentStep = 'outline'; });
            outlineData = await geminiService.createOutlineWithIntent(updatedProcess.topic, keywordsData, researchData, brandVoiceSystem, platform);
            updateProcessInHistory(processId, d => { d.outline = outlineData; });
        }
        if (!outlineData) throw new Error("Outline data is missing to proceed.");
        
        updateProcessInHistory(processId, d => { d.currentStep = 'generation'; });
        const blogPost = await geminiService.generateFullBlogPost(updatedProcess.topic, brandVoiceSystem, researchData, keywordsData, outlineData, platform);
        updateProcessInHistory(processId, d => {
            d.blogPost = blogPost;
            d.status = 'done';
            d.currentStep = 'done';
        });

    } catch (e) {
        const message = e instanceof Error ? e.message : 'An error occurred during blog re-generation.';
        updateProcessInHistory(processId, draft => {
            draft.error = message;
            draft.status = 'error';
        });
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
        setSuggestionError(e instanceof Error ? e.message : 'Failed to generate topic suggestions.');
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
  };

  const handleDeleteHistoryItem = (idToDelete: string) => {
    setGenerationHistory(prev => prev.filter(p => p.id !== idToDelete));
    if (activeProcessId === idToDelete) {
        setActiveProcessId(null);
    }
  };

  const NavButton = ({ currentView, targetView, children }: { currentView: View; targetView: View; children?: React.ReactNode; }) => (
    <button
      onClick={() => setView(targetView)}
      className={`px-4 py-2 text-lg font-semibold transition rounded-t-lg border-b-4 ${currentView === targetView ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'} ${!brandVoiceSystem && targetView !== 'define' ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={!brandVoiceSystem && targetView !== 'define'}
    >
      {children}
    </button>
  );
  
  const activeProcess = generationHistory.find(p => p.id === activeProcessId);
  const isGenerating = activeProcess?.status === 'loading';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
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
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-slate-700 h-[70vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700">
                <h2 className="text-xl font-bold">Content History</h2>
                <button onClick={() => setIsHistoryVisible(false)} className="text-slate-400 hover:text-white">
                    <XIcon className="w-6 h-6" />
                </button>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1">
                {generationHistory.length > 0 ? generationHistory.map(p => (
                    <div key={p.id} className="group">
                    <button
                        onClick={() => {
                        setActiveProcessId(p.id);
                        setIsHistoryVisible(false);
                        }}
                        className={`w-full text-left p-2 rounded-md transition text-sm flex items-start gap-2 ${activeProcessId === p.id ? 'bg-teal-500/20 text-teal-300' : 'hover:bg-slate-700'}`}
                    >
                        <FileTextIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="truncate flex-grow" title={p.topic}>{p.topic} <span className="text-xs text-slate-400">({p.platform})</span></span>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(p.id); }} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <TrashIcon className="w-4 h-4" />
                        </button>
                    </button>
                    </div>
                )) : (
                    <p className="text-sm text-slate-400 text-center py-4">No content generated yet.</p>
                )}
                </div>
            </div>
            </div>
        )}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-10">
          <div className="flex justify-center items-center gap-4">
            <BotIcon className="w-10 h-10 text-teal-400" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-teal-300 to-indigo-400 text-transparent bg-clip-text">
              Brand Voice & Content Tool
            </h1>
          </div>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Define your brand voice, then generate perfectly-toned content and replies for any platform.
          </p>
        </header>

        <nav className="flex justify-center border-b border-slate-700 mb-8">
          <NavButton currentView={view} targetView="define">1. Define Voice</NavButton>
          <NavButton currentView={view} targetView="content">2. Generate Content</NavButton>
          <NavButton currentView={view} targetView="reply">3. Reply to Comments</NavButton>
        </nav>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex items-center mb-8">
            <AlertTriangleIcon className="w-6 h-6 mr-3"/>
            <div>
                <h3 className="font-bold">An Error Occurred</h3>
                <p>{error}</p>
            </div>
            </div>
        )}
         {activeProcess?.error && (
             <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex items-center mb-8">
                <AlertTriangleIcon className="w-6 h-6 mr-3"/>
                <div>
                    <h3 className="font-bold">An Error Occurred During Content Generation</h3>
                    <p>{activeProcess.error}</p>
                </div>
             </div>
         )}


        {view === 'define' && (
          <BrandVoiceInput onGenerate={handleGenerateBrandVoice} isLoading={status === 'loading'} />
        )}

        {brandVoiceSystem && (
          <>
            {view === 'content' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white truncate pr-4">
                    {activeProcess ? `Content Result for "${activeProcess.topic}"` : 'Generate New Content'}
                    </h2>
                    <button 
                    onClick={() => setIsHistoryVisible(true)} 
                    className="flex-shrink-0 flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-md transition"
                    aria-label="View content history"
                    >
                        <HistoryIcon className="w-5 h-5" />
                        <span>History</span>
                    </button>
                </div>
                
                 {/* Main Content Area */}
                <div>
                    {!activeProcessId ? (
                        <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700 space-y-4">
                            <h2 className="text-2xl font-bold text-white">Generate New Content</h2>
                            <div>
                                <label htmlFor="contentPlatform" className="block text-sm font-medium text-teal-300 mb-2">Platform</label>
                                <select 
                                    id="contentPlatform" 
                                    value={contentPlatform} 
                                    onChange={e => setContentPlatform(e.target.value as Platform)} 
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-2"
                                >
                                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="topic" className="block text-sm font-medium text-teal-300 mb-2">Topic / Goal</label>
                                <textarea id="topic" value={contentTopic} onChange={e => setContentTopic(e.target.value)} placeholder="e.g., '5 Best Study Apps for College Students in 2025'" className="w-full h-24 bg-slate-700 border border-slate-600 rounded-md px-4 py-2" />
                            </div>
                            
                            <div className="border-t border-slate-700 pt-4 space-y-4">
                                <button onClick={handleGenerateTopicSuggestions} disabled={suggestionStatus === 'loading'} className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-md transition-all text-sm">
                                    {suggestionStatus === 'loading' ? <LoadingSpinner className="w-5 h-5" /> : <><SparklesIcon className="mr-2 h-4 w-4"/>Suggest Topics</>}
                                </button>
                                {suggestionError && <p className="text-red-400 text-sm">{suggestionError}</p>}
                                {topicSuggestions.length > 0 && (
                                    <div>
                                        <p className="text-sm text-slate-400 mb-2">Click a suggestion to use it:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {topicSuggestions.map((topic, index) => (
                                                <button key={index} onClick={() => setContentTopic(topic)} className="bg-slate-700 hover:bg-teal-900/50 text-slate-300 hover:text-teal-300 text-sm px-3 py-1 rounded-full transition border border-slate-600 hover:border-teal-700">{topic}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleGenerateContent} disabled={!contentTopic || isGenerating} className="w-full flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-md transition-all">
                                <SparklesIcon className="mr-2"/>Start Generation
                            </button>
                        </div>
                    ) : activeProcess && (
                        activeProcess.status !== 'done' ? (
                            <BlogGenerationProcessView process={activeProcess} onRerunStep={(step) => handleRerunStep(activeProcess.id, step)} />
                        ) : (
                            <div className="space-y-6">
                                <BlogGenerationProcessView process={activeProcess} onRerunStep={(step) => handleRerunStep(activeProcess.id, step)} />
                                <div className="relative group">
                                    <div className="prose prose-invert prose-lg max-w-none bg-slate-800/50 p-6 md:p-8 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: markdownToHtml(activeProcess.blogPost!) }} />
                                    <button onClick={() => handleCopy(activeProcess.blogPost!)} title="Copy content" className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        {copyStatus === 'copied' ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                                <button onClick={handleNewPost} className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md transition-all">
                                    <SparklesIcon className="mr-2 h-5 w-5" /> Generate More Content
                                </button>
                            </div>
                        )
                    )}
                 </div>
              </div>
            )}

            {view === 'reply' && (
              <div className="space-y-6">
                <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700 space-y-4">
                    <h2 className="text-2xl font-bold text-white">Generate Comment Reply</h2>
                     <div>
                        <label htmlFor="commentPlatform" className="block text-sm font-medium text-teal-300 mb-2">Platform</label>
                        <select id="commentPlatform" value={commentPlatform} onChange={e => setCommentPlatform(e.target.value as Platform)} className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-2">
                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="postText" className="block text-sm font-medium text-teal-300 mb-2">Original Post Text</label>
                        <textarea id="postText" value={postText} onChange={e => setPostText(e.target.value)} placeholder="Paste the text of the post/article here for context..." className="w-full h-28 bg-slate-700 border border-slate-600 rounded-md px-4 py-2" />
                    </div>
                    <div>
                        <label htmlFor="comment" className="block text-sm font-medium text-teal-300 mb-2">Comment to Reply To</label>
                        <textarea id="comment" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Paste the user's comment here..." className="w-full h-24 bg-slate-700 border border-slate-600 rounded-md px-4 py-2" />
                    </div>
                    
                    <div className="border-t border-slate-700 pt-4 space-y-4">
                        <label htmlFor="objective" className="block text-sm font-medium text-teal-300 mb-2">Reply Objective</label>
                        <div className="flex gap-2">
                           <input id="objective" value={replyObjective} onChange={e => setReplyObjective(e.target.value)} placeholder="e.g., 'De-escalate and move to DMs'" className="w-full bg-slate-700 border border-slate-600 rounded-md px-4 py-2" />
                           <button 
                                onClick={handleGenerateReplyObjectives} 
                                disabled={objectiveStatus === 'loading' || status === 'loading' || !postText || !commentText}
                                title="Suggest objectives based on post and comment"
                                className="flex-shrink-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold p-2 rounded-md transition-all text-sm">
                                {objectiveStatus === 'loading' ? 
                                    <LoadingSpinner className="w-5 h-5" /> : 
                                    <SparklesIcon className="h-5 w-5"/>
                                }
                            </button>
                        </div>
                        {objectiveError && <p className="text-red-400 text-sm mt-2">{objectiveError}</p>}
                        {objectiveStatus === 'done' && objectiveSuggestions.length > 0 && (
                            <div className="pt-2">
                                <p className="text-sm text-slate-400 mb-2">Suggested objectives:</p>
                                <div className="flex flex-wrap gap-2">
                                    {objectiveSuggestions.map((objective, index) => (
                                        <button 
                                            key={index}
                                            onClick={() => setReplyObjective(objective)}
                                            className="bg-slate-700 hover:bg-teal-900/50 text-slate-300 hover:text-teal-300 text-sm px-3 py-1 rounded-full transition border border-slate-600 hover:border-teal-700">
                                            {objective}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={handleGenerateReply} disabled={status === 'loading' || objectiveStatus === 'loading' || !commentText || !postText} className="w-full flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-md transition-all">
                        {status === 'loading' ? <LoadingSpinner /> : <><SparklesIcon className="mr-2"/>Generate Replies</>}
                    </button>
                </div>
                {generatedReply && (
                    <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                        <h3 className="text-xl font-semibold mb-4">Generated Replies & Analysis</h3>
                        <p className="mb-4 p-3 bg-slate-900/50 rounded-md border border-slate-600"><strong className="text-indigo-400">Analysis:</strong> {generatedReply.analysis.sentiment} sentiment. Intent: {generatedReply.analysis.intent}. <br/> <strong className="text-indigo-400">Notes:</strong> {generatedReply.analysis.notes}</p>
                        <div className="space-y-4">
                            {generatedReply.variations.map((reply, i) => (
                                <div key={i} className="bg-slate-900 p-3 rounded-md flex justify-between items-start group">
                                    <p className="text-slate-300 mr-4">{reply}</p>
                                    <button onClick={() => handleCopy(reply)} title="Copy reply" className="flex-shrink-0 text-slate-400 hover:text-white opacity-50 group-hover:opacity-100 transition-opacity">{copyStatus === 'copied' ? <CheckIcon className="w-5 h-5"/> : <CopyIcon className="w-5 h-5"/>}</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            )}

            <div className={`mt-12 transition-opacity duration-500 ${!brandVoiceSystem ? 'hidden' : 'opacity-100'}`}>
                <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-teal-300 to-indigo-400 text-transparent bg-clip-text">Your Brand Voice System</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <BrandComponentDisplay title="Brand Essence" onEdit={() => handleOpenEditModal('essence', 'Brand Essence')} onRegenerate={() => handleRegenerateComponent('essence')}>{regeneratingComponent === 'essence' ? <LoadingSpinner/> : <p>{brandVoiceSystem.essence}</p>}</BrandComponentDisplay>
                    <BrandComponentDisplay title="Personality Traits" onEdit={() => handleOpenEditModal('personalityTraits', 'Personality Traits')} onRegenerate={() => handleRegenerateComponent('personalityTraits')}>{regeneratingComponent === 'personalityTraits' ? <LoadingSpinner/> : <div className="flex flex-wrap gap-2">{brandVoiceSystem.personalityTraits.map(t => <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-1 rounded-full text-sm">{t}</span>)}</div>}</BrandComponentDisplay>
                    <BrandComponentDisplay title="Tone Guidelines" onEdit={() => handleOpenEditModal('toneGuidelines', 'Tone Guidelines')} onRegenerate={() => handleRegenerateComponent('toneGuidelines')}>
                        {regeneratingComponent === 'toneGuidelines' ? <LoadingSpinner/> : (
                            <ul className="space-y-3">
                                {brandVoiceSystem.toneGuidelines.map(t => (
                                    <li key={t.name} className="p-2 bg-slate-900/50 rounded-md">
                                        <strong className="text-teal-400">{t.name}:</strong>
                                        <span className="text-slate-300 ml-2">{t.description}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Writing Style" onEdit={() => handleOpenEditModal('writingStyle', 'Writing Style')} onRegenerate={() => handleRegenerateComponent('writingStyle')}>
                        {regeneratingComponent === 'writingStyle' ? <LoadingSpinner/> : <p>{brandVoiceSystem.writingStyle}</p>}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Vocabulary" onEdit={() => handleOpenEditModal('vocabulary', 'Vocabulary')} onRegenerate={() => handleRegenerateComponent('vocabulary')}>
                        {regeneratingComponent === 'vocabulary' ? <LoadingSpinner/> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-green-400 mb-2">Use:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {brandVoiceSystem.vocabulary.use.map(v => <span key={v} className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-sm">{v}</span>)}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-red-400 mb-2">Avoid:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {brandVoiceSystem.vocabulary.avoid.map(v => <span key={v} className="bg-red-500/20 text-red-300 px-2 py-1 rounded-full text-sm">{v}</span>)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Messaging Pillars" onEdit={() => handleOpenEditModal('messagingPillars', 'Messaging Pillars')} onRegenerate={() => handleRegenerateComponent('messagingPillars')}>
                        {regeneratingComponent === 'messagingPillars' ? <LoadingSpinner/> : (
                            <ul className="list-disc pl-5 space-y-1">
                                {brandVoiceSystem.messagingPillars.map(p => <li key={p}>{p}</li>)}
                            </ul>
                        )}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Audience Resonance" onEdit={() => handleOpenEditModal('audienceResonance', 'Audience Resonance')} onRegenerate={() => handleRegenerateComponent('audienceResonance')}>
                        {regeneratingComponent === 'audienceResonance' ? <LoadingSpinner/> : <p>{brandVoiceSystem.audienceResonance}</p>}
                    </BrandComponentDisplay>
                    <BrandComponentDisplay title="Voice in Action (Examples)" onEdit={() => handleOpenEditModal('voiceInActionExamples', 'Voice in Action Examples')} onRegenerate={() => handleRegenerateComponent('voiceInActionExamples')}>
                        {regeneratingComponent === 'voiceInActionExamples' ? <LoadingSpinner/> : (
                            <div className="space-y-3">
                                {brandVoiceSystem.voiceInActionExamples.map((ex, i) => (
                                    <blockquote key={i} className="border-l-4 border-slate-600 pl-4 italic text-slate-400">
                                        "{ex}"
                                    </blockquote>
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
