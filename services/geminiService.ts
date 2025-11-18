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
    voiceInActionExamples: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 short examples of the brand voice in use (e.g., a headline, a social media post)." }
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
            throw new Error("Could not find JSON start in the response.");
        }
        
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


export const generateBrandVoiceFromURL = async (
  url: string,
  name: string,
  industry: string
): Promise<BrandVoiceSystem> => {
  const prompt = `You are a world-class branding and marketing analyst. Your task is to analyze the content at the blog URL provided for the company "${name}" in the "${industry}" industry.

  URL to analyze: ${url}
  
  Instructions:
  1. Use your search tool to access and read the content of the page at the provided URL.
  2. Analyze the text for its underlying brand voice. Pay close attention to the writing style, tone, vocabulary, sentence structure, and recurring themes.
  3. Based on your analysis, generate a complete and cohesive Brand Voice System.
  4. Infer the brand's essence, personality, audience, and messaging pillars from the content.
  5. If the brand name or industry is not obvious from the URL content, use the provided name ("${name}") and industry ("${industry}") as the primary context.
  
  Your output must be a JSON object that strictly conforms to the provided schema. The JSON object should be enclosed in a markdown code block with the language identifier 'json'.`;
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
        tools: [{googleSearch: {}}],
    }
  });
  
  return parseJsonFromText(response.text);
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
        model: 'gemini-2.5-pro',
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
        model: 'gemini-2.5-pro',
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
    - For a 'Blog / Article', create a standard Intro/Body/Conclusion structure.
    - For an 'Instagram Post', create an outline for a carousel (e.g., Hook, Point 1, Point 2, CTA).
    - For 'Ad Copy', structure it as Headline, Body, CTA.

    For **EACH** item in the outline, you **MUST** provide a clear, specific 'intent'. The intent explains the strategic purpose of that section and what it achieves for the audience.

    Example Intent: "Acknowledge the reader's primary challenge with [X] to build empathy before introducing our framework."
    
    Incorporate the keywords naturally into the section titles where it makes sense.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
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
                    },
                    required: ['sectionTitle', 'intent']
                }
            }
        }
    });
    return JSON.parse(response.text);
};


export const generateFullBlogPost = async (
    topic: string,
    system: BrandVoiceSystem,
    research: ResearchData,
    keywords: KeywordsData,
    outline: OutlineSection[],
    platform: Platform
): Promise<string> => {
    const prompt = `
    You are an expert content creator and copywriter, embodying the brand voice defined below. Your task is to write a complete, publish-ready piece of content based on the provided materials.

    **Platform:** ${platform}
    **Topic:** ${topic}

    **Brand Voice System:**
    ${JSON.stringify(system, null, 2)}

    **Primary & Secondary Keywords/Hashtags:**
    - Primary: ${keywords.primary}
    - Secondary: ${keywords.secondary.join(', ')}

    **Research Insights (to be woven into the text):**
    ${research.insights.map(i => `- ${i}`).join('\n')}

    **Sources to Cite (if applicable for the platform):**
    ${research.sources.map((s, i) => `${i + 1}. ${s.title}: ${s.uri}`).join('\n')}

    **Outline with Intent (This is your strict guide):**
    ${outline.map(o => `- Section: "${o.sectionTitle}"\n  - Intent: ${o.intent}`).join('\n')}

    **Instructions:**
    1.  **Strictly Follow the Outline:** Each part of your writing must fulfill its stated intent. This is crucial.
    2.  **Embody the Brand Voice:** Adhere perfectly to the personality, tone, writing style, and vocabulary.
    3.  **Tailor for the Platform:** The format, length, and style must be perfectly suited for a "${platform}". 
        -   For an 'Instagram Post', be concise, use emojis, and include relevant hashtags.
        -   For a 'Blog / Article', write a well-structured, long-form piece (1000-2000 words) using Markdown.
        -   For 'Ad Copy', be persuasive and direct with a clear call to action.
    4.  **Integrate Keywords Naturally:** Place the primary and secondary keywords strategically, but avoid "stuffing." The text must read naturally.
    5.  **Use Research and Cite Sources:** Back up claims using the provided research insights. For platforms like blogs, add a citation marker like [1], [2], etc., and create a "Sources" list at the end. For social media, citations are not typically needed.
    6.  **Ensure Flow and Transitions:** Write smooth transitions between paragraphs and sections where applicable.
    7.  **Formatting:** Use Markdown for blogs/articles (H1, H2, lists). For other platforms, use plain text with line breaks for readability.
    8.  **Output:** Provide only the complete, final text for the specified platform. Do not include any extra commentary.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: { temperature: 0.6 }
    });

    return response.text;
}


export const generateCommentReply = async (
    system: BrandVoiceSystem,
    platform: Platform,
    postText: string,
    comment: string,
    objective: string
): Promise<CommentReply> => {
    const prompt = `
    You are a community manager who is an expert in the brand voice defined below. Your task is to analyze a comment and generate 3 on-brand reply variations, considering the context of the original post.

    **Brand Voice System:**
    ${JSON.stringify(system, null, 2)}

    **Request:**
    - Platform: "${platform}"
    - Original Post Content: "${postText}"
    - User's Comment: "${comment}"
    - Reply Objective: "${objective || 'Acknowledge and engage positively.'}"

    **Instructions:**
    1.  **Analyze the Comment:** First, determine the sentiment (Positive, Neutral, Negative) and intent (e.g., Question, Praise, Complaint, Feedback) of the user's comment, keeping the original post content in mind for context.
    2.  **Apply the Brand Voice:** Generate 3 distinct reply variations that strictly follow the brand's personality, tone, and vocabulary. Each reply should be tailored to the platform.
    3.  **Achieve the Objective:** Ensure the replies meet the stated objective.
    4.  **Provide Analysis and Notes:** Explain your analysis and offer brief notes on why each reply variation is effective.
    `;

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
                            sentiment: { type: Type.STRING },
                            intent: { type: Type.STRING },
                            notes: { type: Type.STRING, description: "Notes on the strategy behind the replies." }
                        }
                    }
                }
            }
        }
    });

    return JSON.parse(response.text);
};

export const generateTopicSuggestions = async (
  industry: string,
  name: string
): Promise<string[]> => {
  const prompt = `
  You are a world-class content strategist and market researcher specializing in the "${industry}" industry.
  Your task is to generate 5 innovative and high-impact content topic ideas for a brand named "${name}".

  Instructions:
  1.  Analyze current trends, challenges, and opportunities within the "${industry}" sector.
  2.  Identify topics that are not only relevant but will also help the brand stand out. Think about unique angles, contrarian viewpoints, or in-depth guides.
  3.  Frame each idea as a clear and compelling "Topic / Goal" that can be used directly for content creation.
  4.  The topics should be diverse, suitable for formats like blog posts, social media, or newsletters.

  Provide your output as a JSON array of 5 strings.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
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
};


export const generateReplyObjectives = async (
    platform: Platform,
    postText: string,
    commentText: string
): Promise<string[]> => {
    const prompt = `
    You are an expert community manager and social media strategist.
    Based on the platform, the original post's content, and a user's comment, generate 4 concise and actionable reply objectives.

    - **Platform:** "${platform}"
    - **Original Post:** "${postText.substring(0, 500)}..."
    - **User's Comment:** "${commentText}"

    Examples of good objectives:
    - "Answer the question and upsell a related product."
    - "Acknowledge praise and encourage user-generated content."
    - "De-escalate the complaint and move the conversation to DMs."
    - "Thank for feedback and tag the product team."
    - "Correct misinformation politely with a source link."

    Your output must be a JSON array of 4 strings.
    `;

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
};