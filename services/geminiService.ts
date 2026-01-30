
import { GoogleGenAI, Type } from "@google/genai";
import { SmartAddResult } from "../types";

// Always use the named parameter and process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function parseEventDescription(text: string, referenceDate: Date): Promise<SmartAddResult | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `O usuário quer adicionar um compromisso à agenda do Chefe do CIAP (PM/PA). Texto: "${text}". 
      Data de referência hoje é: ${referenceDate.toISOString()}.
      Extraia: título, descrição, início, fim, tipo (meeting, lecture, event, task, ceremony), responsável (quem solicitou ou o Chefe), participantes (autoridades/equipes) e um emoji. 
      Contexto: O Chefe realiza palestras, reuniões de comando e despachos administrativos.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            start: { type: Type.STRING },
            end: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['meeting', 'lecture', 'event', 'task', 'ceremony'] },
            responsible: { type: Type.STRING },
            participants: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            },
            emoji: { type: Type.STRING }
          },
          required: ["title", "start", "end", "type", "responsible"],
        }
      }
    });

    // Access the .text property directly (not as a method)
    const jsonStr = response.text?.trim();
    if (!jsonStr) return null;
    return JSON.parse(jsonStr) as SmartAddResult;
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    return null;
  }
}
