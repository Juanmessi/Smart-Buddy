
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { WordPair, TranslationOption, GeneratedPassage, SpeakingEvaluation, ChatMessage } from "../types";

const API_KEY = process.env.API_KEY || '';

// Use the specific model required for 2.5 Flash TTS
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GENERATION_MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";

let genAI: GoogleGenAI | null = null;

const getAI = () => {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: API_KEY });
  }
  return genAI;
};

/**
 * Generates spoken audio for a given text using Gemini TTS.
 */
export const generateSpeechAudio = async (text: string, isEnglish: boolean): Promise<string> => {
  const ai = getAI();
  
  // Select voice based on language for better naturalness
  const voiceName = isEnglish ? 'Puck' : 'Kore'; 

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: isEnglish ? `Say specifically: "${text}"` : `请读出: "${text}"` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};

/**
 * Generates a list of words/phrases based on a topic.
 */
export const generateWordListFromTopic = async (topic: string): Promise<WordPair[]> => {
  const ai = getAI();

  try {
    const prompt = `Create a list of 10 English vocabulary words, phrases, or simple sentences related to the topic: "${topic}". 
    Provide the Chinese translation for each.`;

    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              english: { type: Type.STRING, description: "The English word, phrase, or sentence" },
              chinese: { type: Type.STRING, description: "The Chinese translation" },
            },
            required: ["english", "chinese"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    const rawList = JSON.parse(text) as { english: string; chinese: string }[];
    
    return rawList.map((item, index) => ({
      id: `gen-${Date.now()}-${index}`,
      english: item.english,
      chinese: item.chinese,
    }));
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

/**
 * Generates a short story/passage and extracts key vocabulary.
 */
export const generatePassageWithVocab = async (topic: string): Promise<GeneratedPassage | null> => {
  const ai = getAI();

  try {
    const prompt = `Write a short, engaging story (approx 100-150 words) suitable for a primary school student about "${topic}".
    Then, extract 5-8 key vocabulary words from the story and provide their Chinese translations.
    Return JSON.`;

    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                 type: Type.OBJECT,
                 properties: {
                    english: { type: Type.STRING },
                    chinese: { type: Type.STRING },
                 },
                 required: ["english", "chinese"]
              }
            }
          },
          required: ["title", "content", "vocabulary"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    const vocab = data.vocabulary.map((item: any, idx: number) => ({
      id: `story-${Date.now()}-${idx}`,
      english: item.english,
      chinese: item.chinese
    }));

    return {
      title: data.title,
      content: data.content,
      vocabulary: vocab
    };

  } catch (error) {
    console.error("Passage Gen Error:", error);
    return null;
  }
};

/**
 * Generates a story based on a specific list of words.
 */
export const generatePassageFromWords = async (words: string[]): Promise<GeneratedPassage | null> => {
  const ai = getAI();
  try {
    const wordListStr = words.join(", ");
    const prompt = `Write a short story (max 150 words) that includes the following words: ${wordListStr}. 
    Highlight the usage of these words naturally.
    Also provide a title.
    Return JSON with 'title' and 'content' fields.`;

    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["title", "content"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const data = JSON.parse(text);

    // We don't extract new vocab, we just return the story
    return {
      title: data.title,
      content: data.content,
      vocabulary: [] 
    };
  } catch (e) {
    console.error(e);
    return null;
  }
};

/**
 * Generates a contextual sentence or dialogue for a specific word.
 */
export const generateContextSentence = async (word: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: `Create a simple, natural English sentence or a short 2-line dialogue using the word "${word}". Return only the text.`
    });
    return response.text || "";
  } catch (e) {
    console.error("Context Gen Error", e);
    return "";
  }
};

/**
 * Evaluates pronunciation audio against a reference text.
 */
export const evaluatePronunciation = async (audioBase64: string, referenceText: string): Promise<SpeakingEvaluation> => {
  const ai = getAI();
  
  try {
    const prompt = `Listen to the audio. The user is trying to say: "${referenceText}".
    Rate the pronunciation on a scale of 0 to 100. 
    Provide brief, encouraging feedback on what was good or what needs improvement (max 2 sentences).
    Return JSON: { "score": number, "feedback": string }`;

    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
             score: { type: Type.INTEGER },
             feedback: { type: Type.STRING }
           },
           required: ["score", "feedback"]
        }
      }
    });

    const text = response.text;
    if (!text) return { score: 0, feedback: "Could not analyze." };
    return JSON.parse(text) as SpeakingEvaluation;

  } catch (e) {
    console.error("Eval Error", e);
    return { score: 0, feedback: "Error analyzing audio." };
  }
};

/**
 * Generates a simple illustration for a word using Gemini.
 */
export const generateHintImage = async (text: string): Promise<string | null> => {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [{ text: `Create a simple, clear, colorful icon or illustration representing: "${text}". Do not include any text inside the image.` }]
      }
    });

    // Iterate through parts to find the image data
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64Data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    return null;
  }
};

/**
 * Translates text and provides multiple options if applicable.
 */
export const translateText = async (text: string, fromLang: 'en' | 'zh'): Promise<TranslationOption[]> => {
  const ai = getAI();
  const targetLang = fromLang === 'en' ? 'Chinese' : 'English';

  try {
    const prompt = `Translate "${text}" to ${targetLang}. 
    If there are multiple common meanings (e.g. "Apple" can be a fruit or a brand, "Bank" can be a financial institution or river bank), provide up to 3 distinct options.
    Return a JSON array.`;

    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The translated text" },
              context: { type: Type.STRING, description: "Short context, e.g., 'Fruit', 'Verb', 'Tech Company'" },
            },
            required: ["text", "context"],
          },
        },
      },
    });

    const rawText = response.text;
    if (!rawText) return [];
    
    return JSON.parse(rawText) as TranslationOption[];

  } catch (error) {
    console.error("Translation Error:", error);
    return [];
  }
};

/**
 * Single shot translation for Input field (Dialogue Mode)
 */
export const simpleTranslate = async (text: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: `Translate the following text to English (if it is Chinese) or to Chinese (if it is English). 
      Provide ONLY the translated text, no explanation.
      Text: "${text}"`
    });
    return response.text?.trim() || text;
  } catch (e) {
    console.error("Simple Translate Error", e);
    return text;
  }
};

/**
 * Generates a response for a roleplay chat.
 */
export const generateChatResponse = async (history: ChatMessage[], topic: string): Promise<string> => {
  const ai = getAI();
  
  // Construct the prompt with history
  // Note: We are manually constructing the "Chat" here for the stateless generateContent model
  // to ensure specific system instructions are followed per turn.
  
  let promptHistory = `You are a helpful and friendly English tutor roleplaying a scenario with a student.
  Scenario: ${topic}.
  Your Goal: Engage in a natural conversation. Keep responses concise (1-3 sentences). Correct the user gently only if they make a major mistake, otherwise just continue the conversation.
  
  History:
  `;
  
  history.forEach(msg => {
    promptHistory += `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.text}\n`;
  });

  promptHistory += `Tutor:`;

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: promptHistory
    });
    return response.text || "I'm not sure what to say.";
  } catch (e) {
    console.error("Chat Gen Error", e);
    return "Sorry, I lost my train of thought.";
  }
};
