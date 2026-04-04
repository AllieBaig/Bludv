import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ImdbData {
  title: string;
  year: string;
  genre: string;
  rating: string;
  imageUrl: string;
  actors: string[];
  description: string;
  format?: 'dvd' | 'bluray' | '4k';
  type?: 'movie' | 'tv';
}

export const fetchMediaInfo = async (title: string, type: 'movie' | 'tv'): Promise<ImdbData | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the official title, release year, main genre, IMDb rating, a high-quality poster image URL, and a short description for the ${type === 'movie' ? 'movie' : 'TV show'} titled "${title}". Also list the main actors.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.STRING },
            genre: { type: Type.STRING },
            rating: { type: Type.STRING },
            imageUrl: { type: Type.STRING },
            description: { type: Type.STRING },
            actors: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "year", "genre", "rating", "imageUrl", "actors", "description"]
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

export const fetchByBarcode = async (barcode: string): Promise<ImdbData | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the movie or TV show associated with the barcode "${barcode}". Provide the official title, release year, main genre, IMDb rating, a high-quality poster image URL, a short description, the media format (dvd, bluray, or 4k), and the type (movie or tv). Also list the main actors.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.STRING },
            genre: { type: Type.STRING },
            rating: { type: Type.STRING },
            imageUrl: { type: Type.STRING },
            description: { type: Type.STRING },
            format: { type: Type.STRING, enum: ['dvd', 'bluray', '4k'] },
            type: { type: Type.STRING, enum: ['movie', 'tv'] },
            actors: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "year", "genre", "rating", "imageUrl", "actors", "description", "format", "type"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ImdbData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching media info by barcode:", error);
    return null;
  }
};

export const fetchByLink = async (link: string): Promise<ImdbData | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify the movie or TV show associated with the link "${link}". Provide the official title, release year, main genre, IMDb rating, a high-quality poster image URL, a short description, the media format (dvd, bluray, or 4k), and the type (movie or tv). Also list the main actors.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            year: { type: Type.STRING },
            genre: { type: Type.STRING },
            rating: { type: Type.STRING },
            imageUrl: { type: Type.STRING },
            description: { type: Type.STRING },
            format: { type: Type.STRING, enum: ['dvd', 'bluray', '4k'] },
            type: { type: Type.STRING, enum: ['movie', 'tv'] },
            actors: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "year", "genre", "rating", "imageUrl", "actors", "description", "format", "type"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ImdbData;
    }
    return null;
  } catch (error) {
    console.error("Error fetching media info by link:", error);
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
