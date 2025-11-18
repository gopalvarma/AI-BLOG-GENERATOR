
export type Platform =
  | 'Blog / Article'
  | 'Website Copy'
  | 'Landing Page'
  | 'Instagram Post'
  | 'LinkedIn Post'
  | 'YouTube Description'
  | 'Email Newsletter'
  | 'Ad Copy (Google/Meta)'
  | 'SMS / Push Notification';

export const PLATFORMS: Platform[] = [
  'Blog / Article',
  'Website Copy',
  'Landing Page',
  'Instagram Post',
  'LinkedIn Post',
  'YouTube Description',
  'Email Newsletter',
  'Ad Copy (Google/Meta)',
  'SMS / Push Notification',
];

export interface Vocabulary {
  use: string[];
  avoid: string[];
}

export interface ToneGuideline {
  name: string;
  description: string;
}

export interface BrandVoiceSystem {
  essence: string;
  personalityTraits: string[];
  toneGuidelines: ToneGuideline[];
  writingStyle: string;
  vocabulary: Vocabulary;
  messagingPillars: string[];
  audienceResonance: string;
  voiceInActionExamples: string[];
}

export interface ExpertBrandInputs {
  essence: string;
  personalityTraits: string;
  tonePreferences: string;
  targetAudience: string;
  vocabularyUse: string;
  vocabularyAvoid: string;
  rules: string;
  messagingPillars: string;
  competitors: string;
  story: string;
  values: string;
  positioning: string;
}

export interface CommentReply {
  variations: string[];
  analysis: {
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    intent: string;
    notes: string;
  };
}

export type GenerationStep = 'idle' | 'loading' | 'done' | 'error';

// Types for the new Blog Generation Workflow
export interface ResearchData {
  sources: Array<{ title: string; uri: string }>;
  insights: string[];
  groundingSources: any[];
}

export interface CompetitionData {
  competitors: Array<{ title: string; uri: string }>;
  analysis: string;
  groundingSources: any[];
}

export interface KeywordsData {
  primary: string;
  secondary: string[];
}

export interface OutlineSection {
  sectionTitle: string;
  intent: string;
}

export interface BlogGenerationProcess {
  id: string;
  topic: string;
  platform: Platform;
  status: GenerationStep;
  currentStep: 'research' | 'competition' | 'keywords' | 'outline' | 'generation' | 'done' | null;
  error: string | null;
  research: ResearchData | null;
  competition: CompetitionData | null;
  keywords: KeywordsData | null;
  outline: OutlineSection[] | null;
  blogPost: string | null;
}