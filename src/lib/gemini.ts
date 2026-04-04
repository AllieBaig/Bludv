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

const cleanJson = (text: string) => {
  return text.replace(/```json\n?|```/g, "").trim();
};

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
      return JSON.parse(cleanJson(response.text)) as ImdbData;
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
      return JSON.parse(cleanJson(response.text)) as ImdbData;
    }
  } catch (error) {
    console.error("Error fetching media info by barcode:", error);
  }
  
  // Fallback: Create a placeholder title if fetch fails
  return {
    title: `Barcode: ${barcode}`,
    year: "",
    genre: "",
    rating: "",
    imageUrl: "",
    actors: [],
    description: "Data could not be fetched automatically. Please enter details manually.",
    format: 'bluray',
    type: 'movie'
  };
};

export const fetchByLink = async (link: string): Promise<ImdbData | null> => {
  // Pre-parse for fallback data
  let fallbackTitle = "Imported Item";
  let fallbackYear = "";
  let fallbackFormat: 'bluray' | 'dvd' | '4k' = 'bluray';

  try {
    const url = new URL(link);
    if (url.hostname.includes('amazon.co.uk')) {
      // Try to extract title from slug: amazon.co.uk/TITLE-SLUG/dp/ASIN
      const pathParts = url.pathname.split('/');
      const dpIndex = pathParts.indexOf('dp');
      if (dpIndex > 0) {
        fallbackTitle = pathParts[dpIndex - 1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
      
      // Detect format from URL
      if (link.toLowerCase().includes('4k')) fallbackFormat = '4k';
      else if (link.toLowerCase().includes('dvd')) fallbackFormat = 'dvd';
    } else if (url.hostname.includes('imdb.com')) {
      const match = link.match(/\/title\/(tt\d+)/);
      if (match) fallbackTitle = `IMDb: ${match[1]}`;
    }
  } catch (e) {
    console.error("URL parsing failed for fallback", e);
  }

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
      return JSON.parse(cleanJson(response.text)) as ImdbData;
    }
  } catch (error) {
    console.error("Error fetching media info by link:", error);
  }

  // Fallback if Gemini fails
  return {
    title: fallbackTitle,
    year: fallbackYear,
    genre: "",
    rating: "",
    imageUrl: "",
    actors: [],
    description: "Link parsed but online data fetch failed. Partial data loaded.",
    format: fallbackFormat,
    type: 'movie'
  };
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
