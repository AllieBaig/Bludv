import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface MediaItem {
  id: string;
  type: 'movie' | 'tv';
  title: string;
  format: 'dvd' | 'bluray' | '4k';
  image?: string; // Base64 compressed
  actors: string[];
  tags: string[];
  year?: string;
  genre?: string;
  rating?: string;
  amazonUrl?: string;
  seasons?: {
    number: number;
    image?: string;
    addedAt: number;
  }[];
  addedAt: number;
  xp: number;
}

interface CineVaultDB extends DBSchema {
  collection: {
    key: string;
    value: MediaItem;
    indexes: { 'by-date': number; 'by-type': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

export type ThemeType = 'dark' | 'paper' | 'glass' | 'wood' | 'metal' | 'fabric';
export type DisplayMode = 'normal' | 'minimal' | 'text';

export interface AppSettings {
  theme: ThemeType;
  displayMode: DisplayMode;
  enableAmazonLinks: boolean;
  enableImdbData: boolean;
}

let dbPromise: Promise<IDBPDatabase<CineVaultDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<CineVaultDB>('cinevault-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('collection', { keyPath: 'id' });
        store.createIndex('by-date', 'addedAt');
        store.createIndex('by-type', 'type');
        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
};

export const getSettings = async (): Promise<AppSettings> => {
  const db = await getDB();
  const theme = (await db.get('settings', 'theme')) || 'dark';
  const displayMode = (await db.get('settings', 'displayMode')) || 'normal';
  const enableAmazonLinks = (await db.get('settings', 'enableAmazonLinks')) ?? true;
  const enableImdbData = (await db.get('settings', 'enableImdbData')) ?? true;
  return { theme, displayMode, enableAmazonLinks, enableImdbData };
};

export const updateSetting = async (key: keyof AppSettings, value: any) => {
  const db = await getDB();
  await db.put('settings', value, key);
};

export const compressImage = (file: File, maxWidth = 400): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

export const calculateLevel = (totalXp: number) => {
  const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const currentLevelXp = Math.pow(level - 1, 2) * 100;
  const progress = ((totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
  
  let title = "Novice Collector";
  if (level >= 5) title = "Cinephile";
  if (level >= 10) title = "Archivist";
  if (level >= 20) title = "Curator";
  if (level >= 50) title = "Grand Master";

  return { level, progress, title, nextLevelXp };
};
