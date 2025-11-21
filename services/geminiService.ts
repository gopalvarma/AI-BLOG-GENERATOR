
import { GoogleGenAI, Type } from "@google/genai";
import { 
    BrandVoiceSystem, 
    ExpertBrandInputs, 
    Platform, 
    CommentReply,
    ResearchData,
    CompetitionData,
    KeywordsData,
    OutlineSection
} from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = "gemini-2.5-flash";

const componentSchemas: { [key in keyof BrandVoiceSystem]: any } = {
    essence: { type: Type.STRING, description: "A one-sentence summary of the brand's core purpose and identity." },
    personalityTraits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 key adjectives describing the brand's character (e.g., 'Witty', 'Inspirational')." },
    toneGuidelines: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "Name of the tone (e.g., 'Enthusiastic', 'Formal')." },
                description: { type: Type.STRING, description: "When and how to use this tone." }
            },
            required: ['name', 'description']
        }
    },
    writingStyle: { type: Type.STRING, description: "A summary of the writing style, covering sentence structure, rhythm, and formatting (e.g., 'Uses short, punchy sentences and bullet points.')." },
    vocabulary: {
        type: Type.OBJECT,
        properties: {
            use: { type: Type.ARRAY, items: { type: Type.STRING } },
            avoid: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['use', 'avoid']
    },
    messagingPillars: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-4 core themes or topics the brand consistently talks about." },
    audienceResonance: { type: Type.STRING, description: "How the voice should connect with the target audience, what it should make them feel." },
    voiceInActionExamples: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 short examples of the brand voice in use (e.g., a headline, a social media post)." },
    keyRules: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 key 'Do and Don't' formatting or behavioral rules for the brand voice." },
    targetAudience: { type: Type.STRING, description: "A description of the primary target audience demographics and psychographics." }
};

const brandSystemSchema = {
    type: Type.OBJECT,
    properties: componentSchemas
};

// Helper to parse JSON from model responses, especially when tools are used
const parseJsonFromText = (text: string) => {
    let jsonString = text;
    // 1. Try to extract from markdown block
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1];
    } else {
        // 2. If no markdown block, find the first '{' or '[' and last '}' or ']'
        const firstBrace = text.indexOf('{');
        const firstBracket = text.indexOf('[');

        if (firstBrace === -1 && firstBracket === -1) {
            // Fallback: assume it's already JSON or try to parse directly
            // We'll let JSON.parse fail if it's not valid
        } else {
            let startIndex;
            if (firstBrace === -1 || (firstBracket !== -1 && firstBracket < firstBrace)) {
                // It's an array
                startIndex = firstBracket;
                const lastBracket = text.lastIndexOf(']');
                if (lastBracket > startIndex) {
                    jsonString = text.substring(startIndex, lastBracket + 1);
                }
            } else {
                // It's an object
                startIndex = firstBrace;
                const lastBrace = text.lastIndexOf('}');
                if (lastBrace > startIndex) {
                    jsonString = text.substring(startIndex, lastBrace + 1);
                }
            }
        }
    }

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON from model response.", e, "Raw text:", text, "Attempted to parse:", jsonString);
        throw new Error("The response from the model was not valid JSON.");
    }
};

export const generateBrandVoiceSystem = async (
  name: string,
  industry: string,
  expertInputs?: ExpertBrandInputs
): Promise<BrandVoiceSystem> => {
  const beginnerPrompt = `You are a world-class branding expert. For a company named "${name}" in the "${industry}" industry, generate a complete Brand Voice System. Create a distinct, memorable, and effective brand voice.`;

  const expertPrompt = `You are a world-class branding expert. A user has provided detailed inputs for their brand, "${name}". Synthesize this information into a cohesive and complete Brand Voice System. Fill in any gaps and refine the inputs into a professional framework.
  
  User Inputs:
  - Brand Essence: ${expertInputs?.essence || 'Not provided'}
  - Personality Traits: ${expertInputs?.personalityTraits || 'Not provided'}
  - Tone Preferences: ${expertInputs?.tonePreferences || 'Not provided'}
  - Target Audience: ${expertInputs?.targetAudience || 'Not provided'}
  - Vocabulary to Use: ${expertInputs?.vocabularyUse || 'Not provided'}
  - Vocabulary to Avoid: ${expertInputs?.vocabularyAvoid || 'Not provided'}
  - Do & Don't Rules: ${expertInputs?.rules || 'Not provided'}
  - Messaging Pillars: ${expertInputs?.messagingPillars || 'Not provided'}
  - Competitors: ${expertInputs?.competitors || 'Not provided'}
  - Brand Story: ${expertInputs?.story || 'Not provided'}
  - Brand Values: ${expertInputs?.values || 'Not provided'}
  - Positioning: ${expertInputs?.positioning || 'Not provided'}`;

  const response = await ai.models.generateContent({
    model,
    contents: expertInputs ? expertPrompt : beginnerPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: brandSystemSchema
    }
  });
  
  return JSON.parse(response.text);
};

export const regenerateBrandVoiceComponent = async (
  system: BrandVoiceSystem,
  componentKey: keyof BrandVoiceSystem
): Promise<Partial<BrandVoiceSystem>> => {
  const prompt = `
  You are a world-class branding expert. Below is an existing Brand Voice System. Your task is to regenerate ONLY the "${componentKey}" section.
  
  The new version must be fresh and creative, but remain perfectly consistent with the rest of the brand's identity provided below.
  
  **Existing Brand Voice System:**
  ${JSON.stringify(system, null, 2)}
  
  Please provide the regenerated data for the "${componentKey}" section. Your output must be a JSON object containing only the key "${componentKey}" and its new value.
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
        [componentKey]: componentSchemas[componentKey]
    }
  };

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text);
};

// NEW: Multi-step Blog Generation Functions

export const performResearch = async (topic: string, system: BrandVoiceSystem, platform: Platform): Promise<ResearchData> => {
    const prompt = `
    You are a research assistant. Your goal is to conduct initial research for a piece of content on the topic: "${topic}".
    The final content will be for the platform: "${platform}". Tailor your research accordingly. For example, for a blog post, find in-depth articles; for an Instagram post, look for visual ideas and quick facts.
    The target audience is interested in ${system.audienceResonance}.
    1.  Use Google Search to find 5-7 credible, recent, and authoritative sources (articles, studies, reports).
    2.  From these sources, extract the most important insights, statistics, surprising facts, and key arguments relevant to the platform.
    3.  Synthesize these into a list of 5-8 bullet points.
    4.  Return a list of the source URLs and titles, and the list of key insights.

    Your output must be a JSON object in a markdown code block.
    The JSON object should have two keys: "sources" (an array of objects with "title" and "uri") and "insights" (an array of strings).
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        }
    });
    const parsedJson = parseJsonFromText(response.text);
    return { ...parsedJson, groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
}

export const analyzeCompetition = async (topic: string, researchData: ResearchData, platform: Platform): Promise<CompetitionData> => {
    const prompt = `
    You are a content strategist. Analyze the competitive landscape for content on "${topic}", specifically for the "${platform}" platform.
    Initial research has yielded these insights: ${researchData.insights.join('; ')}.

    1.  Use Google Search to find 3-5 top-performing pieces of content on the target platform (or a similar one) for the given topic.
    2.  Briefly analyze their content. Identify their strengths, common themes, content formats (e.g., listicles, carousels, how-to guides), and any content gaps or unique angles they are missing.
    3.  Summarize your analysis in a concise paragraph.
    
    Your output must be a JSON object in a markdown code block.
    The JSON object should have two keys: "competitors" (an array of objects with "title" and "uri") and "analysis" (a string).
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        }
    });
    const parsedJson = parseJsonFromText(response.text);
    return { ...parsedJson, groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
}

export const identifyKeywords = async (topic: string, researchData: ResearchData, competitionData: CompetitionData): Promise<KeywordsData> => {
    const prompt = `
    You are an SEO specialist. Based on the provided research and competitive analysis for the topic "${topic}", identify the best keywords.
    -   **Research Insights:** ${researchData.insights.join('; ')}
    -   **Competitor Analysis:** ${competitionData.analysis}
    
    Identify one primary keyword with strong search intent.
    Identify 3-5 relevant secondary keywords (or hashtags for social media) that cover important sub-topics or user questions.

    Return a JSON object with two keys: "primary" (string) and "secondary" (array of strings).
    `;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    primary: { type: Type.STRING },
                    secondary: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    return JSON.parse(response.text);
}

export const createOutlineWithIntent = async (topic: string, keywords: KeywordsData, researchData: ResearchData, system: BrandVoiceSystem, platform: Platform): Promise<OutlineSection[]> => {
    const prompt = `
    You are an expert content architect. Create a detailed outline for a piece of content on the topic: "${topic}" for the "${platform}" platform.
    -   **Brand Voice:** Essence is "${system.essence}". Personality is "${system.personalityTraits.join(', ')}".
    -   **Keywords:** Primary is "${keywords.primary}". Secondary are: ${keywords.secondary.join(', ')}.
    -   **Key Research:** ${researchData.insights.join('; ')}

    The outline structure must be appropriate for the target platform.
    - For a 'Blog / Article', use standard headings (Introduction, H2s, Conclusion).
    - For 'Instagram', use (Hook, Value, Call to Action).
    - For 'LinkedIn', use (Hook, Insight, Discussion Question).

    For each section, provide:
    1. "sectionTitle": The heading or part name.
    2. "intent": A brief description of what this section should achieve (e.g., "Hook the reader with a statistic", "Explain the benefits").

    Return a JSON array of objects.
    `;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        sectionTitle: { type: Type.STRING },
                        intent: { type: Type.STRING }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text);
}

export const generateFullBlogPost = async (
    topic: string,
    system: BrandVoiceSystem,
    researchData: ResearchData,
    keywordsData: KeywordsData,
    outline: OutlineSection[],
    platform: Platform
): Promise<string> => {
    const prompt = `
    You are a professional content creator. Write the full content for a "${platform}" on the topic "${topic}".
    
    **Brand Voice Settings:**
    - Essence: ${system.essence}
    - Personality: ${system.personalityTraits.join(', ')}
    - Tone: ${system.toneGuidelines.map(t => t.name).join(', ')}
    - Vocabulary Use: ${system.vocabulary.use.join(', ')}
    - Vocabulary Avoid: ${system.vocabulary.avoid.join(', ')}
    
    **SEO Keywords:**
    - Primary: ${keywordsData.primary}
    - Secondary: ${keywordsData.secondary.join(', ')}
    
    **Research & Citations:**
    - Incorporate these insights: ${researchData.insights.join('; ')}
    - **CITATION REQUIREMENT:** You MUST cite the sources for facts and data. Use the Markdown link format: [Source Title](URL).
    - Sources List:
    ${researchData.sources.map(s => `- ${s.title}: ${s.uri}`).join('\n')}
    
    **Structure:**
    ${outline.map(s => `### ${s.sectionTitle}\nIntent: ${s.intent}`).join('\n\n')}
    
    Write the content in clean Markdown.
    `;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt
    });
    
    return response.text;
}

export const generateBlogImage = async (topic: string, system: BrandVoiceSystem): Promise<string | null> => {
    const prompt = `Create a high-quality, photorealistic header image for a blog post about "${topic}". 
    The image should reflect the brand essence: "${system.essence}".
    Style keywords: ${system.personalityTraits.join(', ')}.
    Do not include text in the image. Cinematic lighting.`;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9'
            }
        });
        const base64 = response.generatedImages?.[0]?.image?.imageBytes;
        return base64 ? `data:image/jpeg;base64,${base64}` : null;
    } catch (error) {
        console.error("Image generation error:", error);
        return null;
    }
}

// --- Helper functions for App.tsx (implied existence in original code) ---

export const generateTopicSuggestions = async (industry: string, brandName: string): Promise<string[]> => {
    const prompt = `Generate 5 engaging blog topic ideas for a ${industry} brand named "${brandName}". Return only a JSON array of strings.`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    return JSON.parse(response.text);
}

export const generateReplyObjectives = async (platform: string, post: string, comment: string): Promise<string[]> => {
    const prompt = `Given this ${platform} post: "${post}" and this user comment: "${comment}", suggest 3 distinct objectives for a reply (e.g., "Thank and clarify", "Ask a follow-up"). Return JSON array of strings.`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
             responseMimeType: "application/json",
             responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });
    return JSON.parse(response.text);
}

export const generateCommentReply = async (system: BrandVoiceSystem, platform: string, post: string, comment: string, objective: string): Promise<CommentReply> => {
    const prompt = `Write 3 variations of a reply to a comment on ${platform}.
    Brand Essence: ${system.essence}
    Tone: ${system.toneGuidelines.map(t => t.name).join(', ')}
    Post: "${post}"
    Comment: "${comment}"
    Objective: "${objective}"
    
    Return JSON with 'variations' (array of strings) and 'analysis' (object with sentiment, intent, notes).`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    variations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    analysis: {
                        type: Type.OBJECT,
                        properties: {
                            sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
                            intent: { type: Type.STRING },
                            notes: { type: Type.STRING }
                        }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text);
}
