import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ImdbData {
  year: string;
  genre: string;
  rating: string;
  imageUrl: string;
  actors: string[];
}

export const fetchMediaInfo = async (title: string, type: 'movie' | 'tv'): Promise<ImdbData | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the release year, main genre, IMDb rating, and a high-quality poster image URL for the ${type === 'movie' ? 'movie' : 'TV show'} titled "${title}". Also list the main actors.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.STRING },
            genre: { type: Type.STRING },
            rating: { type: Type.STRING },
            imageUrl: { type: Type.STRING },
            actors: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["year", "genre", "rating", "imageUrl", "actors"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ImdbData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching media info:", error);
    return null;
  }
};

export const getAmazonUkLink = (title: string, format: string): string => {
  const query = encodeURIComponent(`${title} ${format} amazon uk`);
  return `https://www.amazon.co.uk/s?k=${query}`;
};

export const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting URL to base64:", error);
    return "";
  }
};
