import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface MediaItem {
  id: string;
  barcode?: string;
  type: 'movie' | 'tv';
  title: string;
  format: 'dvd' | 'bluray' | '4k';
  image?: string; // Base64 compressed
  actors: string[];
  tags: string[];
  year?: string;
  genre?: string;
  rating?: string;
  description?: string;
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
  barcodeCache: {
    key: string;
    value: {
      barcode: string;
      title: string;
      year?: string;
      format: string;
      image?: string;
      type: 'movie' | 'tv';
      genre?: string;
      rating?: string;
      description?: string;
      actors: string[];
    };
  };
  logs: {
    key: number;
    value: {
      id: number;
      timestamp: number;
      event: string;
      details?: string;
      type: 'info' | 'success' | 'error';
    };
  };
  savedBarcodes: {
    key: string;
    value: {
      barcode: string;
      timestamp: number;
    };
  };
}

export type ThemeType = 'dark' | 'paper' | 'glass' | 'wood' | 'metal' | 'fabric';
export type DisplayMode = 'normal' | 'minimal' | 'text';

export interface AppSettings {
  theme: ThemeType;
  displayMode: DisplayMode;
  enableAmazonLinks: boolean;
  enableImdbData: boolean;
  showBottomNav: boolean;
  debugMode: boolean;
}

let dbPromise: Promise<IDBPDatabase<CineVaultDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<CineVaultDB>('cinevault-db', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('collection', { keyPath: 'id' });
          store.createIndex('by-date', 'addedAt');
          store.createIndex('by-type', 'type');
          db.createObjectStore('settings');
        }
        if (oldVersion < 2) {
          db.createObjectStore('barcodeCache', { keyPath: 'barcode' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        }
        if (oldVersion < 4) {
          db.createObjectStore('savedBarcodes', { keyPath: 'barcode' });
        }
      },
    });
  }
  return dbPromise;
};

export const saveBarcode = async (barcode: string) => {
  const db = await getDB();
  await db.put('savedBarcodes', {
    barcode,
    timestamp: Date.now()
  });
};

export const getSavedBarcodes = async () => {
  const db = await getDB();
  const barcodes = await db.getAll('savedBarcodes');
  return barcodes.sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteSavedBarcode = async (barcode: string) => {
  const db = await getDB();
  await db.delete('savedBarcodes', barcode);
};

export const addLog = async (event: string, type: 'info' | 'success' | 'error' = 'info', details?: string) => {
  const db = await getDB();
  const log = {
    timestamp: Date.now(),
    event,
    details,
    type
  };
  // @ts-ignore - id is auto-incremented
  await db.add('logs', log);

  // Limit log size to 200
  const allLogs = await db.getAll('logs');
  if (allLogs.length > 200) {
    const toDelete = allLogs.slice(0, allLogs.length - 200);
    const tx = db.transaction('logs', 'readwrite');
    for (const l of toDelete) {
      await tx.store.delete(l.id);
    }
    await tx.done;
  }
};

export const getLogs = async () => {
  const db = await getDB();
  return db.getAll('logs');
};

export const clearLogs = async () => {
  const db = await getDB();
  await db.clear('logs');
};

export const getCachedBarcode = async (barcode: string) => {
  const db = await getDB();
  return db.get('barcodeCache', barcode);
};

export const cacheBarcode = async (data: CineVaultDB['barcodeCache']['value']) => {
  const db = await getDB();
  await db.put('barcodeCache', data);
};

export const getSettings = async (): Promise<AppSettings> => {
  const db = await getDB();
  const theme = (await db.get('settings', 'theme')) || 'dark';
  const displayMode = (await db.get('settings', 'displayMode')) || 'normal';
  const enableAmazonLinks = (await db.get('settings', 'enableAmazonLinks')) ?? true;
  const enableImdbData = (await db.get('settings', 'enableImdbData')) ?? true;
  const showBottomNav = (await db.get('settings', 'showBottomNav')) ?? true;
  const debugMode = (await db.get('settings', 'debugMode')) ?? false;
  return { theme, displayMode, enableAmazonLinks, enableImdbData, showBottomNav, debugMode };
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
