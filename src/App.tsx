import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Library, 
  Settings as SettingsIcon, 
  Search, 
  Film, 
  Tv, 
  Trophy, 
  X, 
  Camera, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload,
  ChevronRight,
  Zap,
  LayoutGrid,
  List,
  Maximize2,
  Edit2,
  ExternalLink,
  Star,
  Calendar,
  Tag as TagIcon,
  Globe,
  Barcode
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getDB, MediaItem, compressImage, calculateLevel, getSettings, updateSetting, ThemeType, DisplayMode, AppSettings } from './lib/db';
import { cn } from './lib/utils';
import { fetchMediaInfo, fetchByBarcode, getAmazonUkLink, urlToBase64 } from './lib/gemini';

// --- Components ---

const BottomNav = ({ activeTab, setActiveTab, theme, setAddFlowStep, setIsAdding }: { 
  activeTab: string, 
  setActiveTab: (t: string) => void, 
  theme: ThemeType,
  setAddFlowStep: (s: any) => void,
  setIsAdding: (a: boolean) => void
}) => (
  <nav className={cn(
    "fixed bottom-0 left-0 right-0 border-t pb-safe pt-2 px-6 flex justify-between items-center z-50 transition-all duration-500",
    theme === 'dark' ? "bg-zinc-900/80 backdrop-blur-xl border-zinc-800/50 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]" : "bg-white/70 backdrop-blur-xl border-black/5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
  )}>
    <button 
      onClick={() => setActiveTab('library')} 
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 btn-tactile py-2 px-4 rounded-2xl", 
        activeTab === 'library' ? "text-orange-500 scale-110" : "text-zinc-500 opacity-60"
      )}
    >
      <Library size={22} strokeWidth={activeTab === 'library' ? 2.5 : 2} />
      <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Vault</span>
    </button>
    <button 
      onClick={() => { setAddFlowStep('menu'); setIsAdding(true); }} 
      className="bg-orange-500 text-white p-4 rounded-3xl -mt-10 shadow-[0_15px_30px_rgba(249,115,22,0.4)] active:scale-90 transition-all duration-300 btn-tactile border-4 border-black/10"
    >
      <Plus size={28} strokeWidth={3} />
    </button>
    <button 
      onClick={() => setActiveTab('settings')} 
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 btn-tactile py-2 px-4 rounded-2xl", 
        activeTab === 'settings' ? "text-orange-500 scale-110" : "text-zinc-500 opacity-60"
      )}
    >
      <SettingsIcon size={22} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
      <span className="text-[9px] font-bold uppercase tracking-[0.15em]">System</span>
    </button>
  </nav>
);

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className="h-full bg-orange-500"
    />
  </div>
);

const MediaCard: React.FC<{ item: MediaItem, onClick: () => void, theme: ThemeType, mode: DisplayMode }> = ({ item, onClick, theme, mode }) => {
  if (mode === 'text') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onClick}
        className={cn(
          "flex items-center justify-between p-4 rounded-2xl border cursor-pointer btn-tactile transition-all",
          theme === 'dark' ? "bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800/50" : "bg-white/50 border-black/5 hover:bg-white/80"
        )}
      >
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            {item.type === 'movie' ? <Film size={18} className="text-orange-500" /> : <Tv size={18} className="text-orange-500" />}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate leading-tight tracking-tight">{item.title}</p>
            <p className="text-[9px] opacity-40 uppercase font-black tracking-[0.1em] mt-0.5">
              {item.format} • {item.type === 'tv' ? `${item.seasons?.length || 0} Seasons` : 'Movie'}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="text-zinc-600 shrink-0 opacity-30" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={cn(
        "relative aspect-[2/3] rounded-2xl overflow-hidden group cursor-pointer border soft-shadow btn-tactile",
        theme === 'dark' ? "bg-zinc-800 border-zinc-700/30" : "bg-zinc-100 border-black/5",
        mode === 'minimal' && "rounded-xl"
      )}
    >
      {item.image ? (
        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
          <Film size={24} className="opacity-20 mb-2" />
          <p className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-40">{item.title}</p>
        </div>
      )}
      
      {mode === 'normal' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
          <p className="text-white text-xs font-black uppercase italic tracking-tighter truncate leading-none">{item.title}</p>
          <div className="flex gap-1.5 mt-2">
            <span className="text-[8px] bg-orange-500 text-white px-1.5 py-0.5 rounded-md uppercase font-black italic tracking-tighter">{item.format}</span>
            <span className="text-[8px] bg-white/20 backdrop-blur-md text-white px-1.5 py-0.5 rounded-md uppercase font-black italic tracking-tighter">{item.type}</span>
          </div>
        </div>
      )}

      <div className={cn(
        "absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/10",
        mode === 'minimal' && "top-2 right-2 p-1"
      )}>
        {item.type === 'movie' ? <Film size={mode === 'minimal' ? 10 : 12} className="text-white" /> : <Tv size={mode === 'minimal' ? 10 : 12} className="text-white" />}
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [stats, setStats] = useState({ totalXp: 0, count: 0 });
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    displayMode: 'normal',
    enableAmazonLinks: true,
    enableImdbData: true,
    showBottomNav: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'failed'>('scanning');
  const [addFlowStep, setAddFlowStep] = useState<'menu' | 'scan' | 'manual-barcode' | 'quick-add' | 'full-form' | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<MediaItem>>({
    type: 'movie',
    format: 'bluray',
    actors: [],
    tags: [],
    seasons: []
  });

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
  };

  const handleSettingChange = async (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await updateSetting(key, value);
  };

  const loadData = async () => {
    const db = await getDB();
    const allItems = await db.getAllFromIndex('collection', 'by-date');
    setItems(allItems.reverse());
    
    const totalXp = allItems.reduce((acc, item) => acc + item.xp, 0);
    setStats({ totalXp, count: allItems.length });
  };

  const handleAddItem = async () => {
    if (!formData.title) return;
    const db = await getDB();
    const newItem: MediaItem = {
      id: isEditing && formData.id ? formData.id : crypto.randomUUID(),
      title: formData.title,
      type: formData.type as any,
      format: formData.format as any,
      image: formData.image,
      actors: formData.actors || [],
      tags: formData.tags || [],
      year: formData.year,
      genre: formData.genre,
      rating: formData.rating,
      description: formData.description,
      amazonUrl: formData.amazonUrl || getAmazonUkLink(formData.title, formData.format || 'bluray'),
      seasons: formData.seasons || [],
      addedAt: isEditing && formData.addedAt ? formData.addedAt : Date.now(),
      xp: formData.type === 'movie' ? 50 : 30 + (formData.seasons?.length || 0) * 20
    };
    await db.put('collection', newItem);
    setIsAdding(false);
    setIsEditing(false);
    setAddFlowStep(null);
    setFormData({ type: 'movie', format: 'bluray', actors: [], tags: [], seasons: [] });
    loadData();
    if (selectedItem) setSelectedItem(newItem);
  };

  const handleFetchInfo = async () => {
    if (!formData.title || isFetching) return;
    setIsFetching(true);
    const data = await fetchMediaInfo(formData.title, formData.type as any);
    if (data) {
      let base64Image = formData.image;
      if (data.imageUrl) {
        base64Image = await urlToBase64(data.imageUrl);
      }
      setFormData(prev => ({
        ...prev,
        title: data.title || prev.title,
        year: data.year,
        genre: data.genre,
        rating: data.rating,
        description: data.description,
        actors: [...new Set([...(prev.actors || []), ...data.actors])],
        image: base64Image || prev.image
      }));
    }
    setIsFetching(false);
  };

  const handleBarcodeLookup = async (barcode: string) => {
    if (!barcode) return;
    setManualBarcode('');
    setAddFlowStep('full-form');
    if (!navigator.onLine) {
      setFormData(prev => ({ ...prev, title: `Barcode: ${barcode}` }));
      setIsAdding(true);
      return;
    }
    setIsFetching(true);
    setIsAdding(true);
    const data = await fetchByBarcode(barcode);
    if (data) {
      let base64Image = undefined;
      if (data.imageUrl) {
        base64Image = await urlToBase64(data.imageUrl);
      }
      setFormData({
        title: data.title,
        type: data.type || 'movie',
        format: data.format || 'bluray',
        year: data.year,
        genre: data.genre,
        rating: data.rating,
        description: data.description,
        actors: data.actors,
        image: base64Image,
        tags: [],
        seasons: []
      });
    } else {
      setFormData(prev => ({ ...prev, title: `Barcode: ${barcode}` }));
    }
    setIsFetching(false);
  };

  const handleScan = async (decodedText: string) => {
    setIsScanning(false);
    setScanStatus('scanning');
    handleBarcodeLookup(decodedText);
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (isScanning) {
      setScanStatus('scanning');
      setScanError(null);
      html5QrCode = new Html5Qrcode("reader");
      const config = { 
        fps: 20, 
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.7);
          return { width: qrboxSize, height: qrboxSize * 0.6 }; // Barcode shape
        },
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: "environment",
          focusMode: "continuous",
          exposureMode: "continuous"
        }
      };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          setScanStatus('success');
          setTimeout(() => {
            handleScan(decodedText);
            html5QrCode?.stop();
          }, 500);
        },
        (errorMessage) => {
          // Ignore errors
        }
      ).catch(err => {
        setScanError("Camera access denied or not available");
        console.error(err);
      });
    }
    return () => {
      if (html5QrCode?.isScanning) {
        html5QrCode.stop();
      }
    };
  }, [isScanning]);

  const handleDeleteItem = async (id: string) => {
    const db = await getDB();
    await db.delete('collection', id);
    setSelectedItem(null);
    loadData();
  };

  const handleExport = async () => {
    const db = await getDB();
    const allItems = await db.getAll('collection');
    const dataStr = JSON.stringify(allItems);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const exportFileDefaultName = `cinevault_backup_${timestamp}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedItems = JSON.parse(event.target?.result as string);
        const db = await getDB();
        const tx = db.transaction('collection', 'readwrite');
        for (const item of importedItems) {
          await tx.store.put(item);
        }
        await tx.done;
        loadData();
        alert('Import successful!');
      } catch (err) {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const clearCache = async () => {
    if (confirm('Are you sure? This will delete all your collection data!')) {
      const db = await getDB();
      await db.clear('collection');
      loadData();
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.actors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const { level, progress, title, nextLevelXp } = calculateLevel(stats.totalXp);

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-orange-500/30 pb-24 transition-colors duration-700 noise-overlay",
      settings.theme === 'dark' ? "bg-black text-zinc-100" : `theme-${settings.theme}`
    )}>
      {/* Header / Stats */}
      <header className={cn(
        "p-6 pt-12 border-b sticky top-0 z-40 transition-all duration-500",
        settings.theme === 'dark' ? "bg-black/80 backdrop-blur-xl border-zinc-800/30" : "bg-white/40 backdrop-blur-xl border-black/5"
      )}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <h1 className={cn(
                "text-4xl font-black tracking-tightest italic uppercase font-display leading-none",
                settings.theme === 'dark' ? "text-white" : "text-inherit"
              )}>CineVault</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 rounded-full shadow-[0_4px_10px_rgba(249,115,22,0.3)]">
                  <Trophy size={10} className="text-white" />
                  <span className="text-[9px] font-black italic uppercase text-white tracking-tighter">LVL {level}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">{title}</span>
              </div>
            </div>
            {!settings.showBottomNav && (
              <div className="flex gap-2">
                <button 
                  onClick={() => { setAddFlowStep('menu'); setIsAdding(true); }}
                  className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/20 btn-tactile"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
                <button 
                  onClick={() => setActiveTab(activeTab === 'settings' ? 'library' : 'settings')}
                  className={cn(
                    "p-3 rounded-2xl transition-all btn-tactile",
                    activeTab === 'settings' ? "bg-orange-500 text-white" : "bg-zinc-800/50 text-zinc-400 backdrop-blur-md"
                  )}
                >
                  <SettingsIcon size={20} />
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-orange-500">
              <span className="text-3xl font-black tracking-tightest italic font-display">{stats.totalXp}</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-2">XP</span>
            </div>
            <p className={cn(
              "text-[9px] font-black mt-1 uppercase tracking-[0.15em]",
              settings.theme === 'dark' ? "text-zinc-500" : "opacity-40"
            )}>{nextLevelXp - stats.totalXp} to next rank</p>
          </div>
        </div>
        <ProgressBar progress={progress} />
      </header>

      {/* Main Content */}
      <main className="p-4">
        {activeTab === 'library' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2", settings.theme === 'dark' ? "text-zinc-500" : "opacity-50")} size={18} />
              <input 
                type="text" 
                placeholder="Search by title, actor, or tag..." 
                className={cn(
                  "w-full border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500 transition-all",
                  settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Grid */}
            <div className={cn(
              "grid gap-4",
              settings.displayMode === 'normal' && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
              settings.displayMode === 'minimal' && "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2",
              settings.displayMode === 'text' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              <AnimatePresence mode="popLayout">
                {filteredItems.map(item => (
                  <MediaCard key={item.id} item={item} onClick={() => setSelectedItem(item)} theme={settings.theme} mode={settings.displayMode} />
                ))}
              </AnimatePresence>
            </div>

            {filteredItems.length === 0 && (
              <div className="py-20 text-center text-zinc-600">
                <Library size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">No items found in your vault.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <SettingsIcon size={20} /> Settings
            </h2>

            {/* Theme Selection */}
            <div>
              <h3 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-[0.2em]">Vault Appearance</h3>
              <div className="grid grid-cols-3 gap-3">
                {(['dark', 'paper', 'glass', 'wood', 'metal', 'fabric'] as ThemeType[]).map(t => (
                  <button 
                    key={t}
                    onClick={() => handleSettingChange('theme', t)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all btn-tactile",
                      settings.theme === t 
                        ? "border-orange-500 bg-orange-500/10 shadow-[0_10px_20px_rgba(249,115,22,0.1)]" 
                        : "border-zinc-800/50 bg-zinc-900/30"
                    )}
                  >
                    <div className={cn("w-full aspect-square rounded-xl border border-white/10 shadow-inner", `theme-${t}`, t === 'dark' && "bg-black")} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Display Mode Selection */}
            <div>
              <h3 className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-[0.2em]">Display Mode</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'normal', icon: LayoutGrid, label: 'Normal' },
                  { id: 'minimal', icon: Maximize2, label: 'Minimal' },
                  { id: 'text', icon: List, label: 'Text' }
                ].map(m => (
                  <button 
                    key={m.id}
                    onClick={() => handleSettingChange('displayMode', m.id as DisplayMode)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all btn-tactile",
                      settings.displayMode === m.id 
                        ? "border-orange-500 bg-orange-500/10 shadow-[0_10px_20px_rgba(249,115,22,0.1)]" 
                        : "border-zinc-800/50 bg-zinc-900/30"
                    )}
                  >
                    <m.icon size={22} strokeWidth={settings.displayMode === m.id ? 2.5 : 2} className={settings.displayMode === m.id ? "text-orange-500" : "text-zinc-500"} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Toggles */}
            <div>
              <h3 className="text-[10px] font-bold uppercase opacity-50 mb-3 tracking-widest">Feature Toggles</h3>
              <div className="space-y-2">
                <button 
                  onClick={() => handleSettingChange('enableAmazonLinks', !settings.enableAmazonLinks)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Globe size={20} className={settings.enableAmazonLinks ? "text-orange-500" : "text-zinc-500"} />
                    <span className="font-medium">Amazon UK Links</span>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full relative transition-colors", settings.enableAmazonLinks ? "bg-orange-500" : "bg-zinc-700")}>
                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", settings.enableAmazonLinks ? "right-1" : "left-1")} />
                  </div>
                </button>

                <button 
                  onClick={() => handleSettingChange('enableImdbData', !settings.enableImdbData)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Star size={20} className={settings.enableImdbData ? "text-yellow-500" : "text-zinc-500"} />
                    <span className="font-medium">IMDb Data Fetching</span>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full relative transition-colors", settings.enableImdbData ? "bg-orange-500" : "bg-zinc-700")}>
                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", settings.enableImdbData ? "right-1" : "left-1")} />
                  </div>
                </button>

                <button 
                  onClick={() => handleSettingChange('showBottomNav', !settings.showBottomNav)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <LayoutGrid size={20} className={settings.showBottomNav ? "text-blue-500" : "text-zinc-500"} />
                    <span className="font-medium">Bottom Menu</span>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full relative transition-colors", settings.showBottomNav ? "bg-orange-500" : "bg-zinc-700")}>
                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", settings.showBottomNav ? "right-1" : "left-1")} />
                  </div>
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <button onClick={() => window.location.reload()} className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border active:scale-[0.98] transition-all",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
              )}>
                <div className="flex items-center gap-3">
                  <RefreshCw size={20} className="text-blue-500" />
                  <span className="font-medium">Refresh App</span>
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </button>

              <button onClick={handleExport} className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border active:scale-[0.98] transition-all",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
              )}>
                <div className="flex items-center gap-3">
                  <Download size={20} className="text-green-500" />
                  <span className="font-medium">Export Backup</span>
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </button>

              <label className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border active:scale-[0.98] transition-all cursor-pointer",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
              )}>
                <div className="flex items-center gap-3">
                  <Upload size={20} className="text-purple-500" />
                  <span className="font-medium">Import Backup</span>
                </div>
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                <ChevronRight size={16} className="text-zinc-600" />
              </label>

              <button onClick={clearCache} className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border active:scale-[0.98] transition-all",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
              )}>
                <div className="flex items-center gap-3">
                  <Trash2 size={20} className="text-red-500" />
                  <span className="font-medium">Clear All Data</span>
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </button>
            </div>

            <div className="pt-8 text-center text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
              CineVault v1.0.0 • Offline Ready
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {(isAdding || isEditing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/98 z-[60] p-6 overflow-y-auto noise-overlay"
          >
            <div className="max-w-md mx-auto space-y-8 pb-20">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black italic uppercase tracking-tightest font-display">{isEditing ? 'Edit Item' : 'Vault Entry'}</h2>
                <button 
                  onClick={() => { setIsAdding(false); setIsEditing(false); setAddFlowStep(null); }} 
                  className="p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl text-zinc-400 btn-tactile"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Unified Add Flow Menu */}
              {!isEditing && addFlowStep === 'menu' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 pt-4">
                  <button 
                    onClick={() => { setIsScanning(true); setAddFlowStep('scan'); }}
                    className="flex items-center gap-5 p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-3xl btn-tactile text-left group soft-shadow"
                  >
                    <div className="p-4 bg-orange-500 rounded-2xl text-white shadow-[0_10px_20px_rgba(249,115,22,0.3)]"><Barcode size={28} strokeWidth={2.5} /></div>
                    <div>
                      <p className="font-black uppercase tracking-tight text-lg italic">Scan Barcode</p>
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.15em] mt-1 opacity-60">Auto-detect via camera</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAddFlowStep('manual-barcode')}
                    className="flex items-center gap-5 p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-3xl btn-tactile text-left group soft-shadow"
                  >
                    <div className="p-4 bg-blue-500 rounded-2xl text-white shadow-[0_10px_20px_rgba(59,130,246,0.3)]"><Edit2 size={28} strokeWidth={2.5} /></div>
                    <div>
                      <p className="font-black uppercase tracking-tight text-lg italic">Manual Barcode</p>
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.15em] mt-1 opacity-60">Type barcode number</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAddFlowStep('quick-add')}
                    className="flex items-center gap-5 p-6 bg-zinc-900/40 border border-zinc-800/50 rounded-3xl btn-tactile text-left group soft-shadow"
                  >
                    <div className="p-4 bg-purple-500 rounded-2xl text-white shadow-[0_10px_20px_rgba(168,85,247,0.3)]"><Zap size={28} strokeWidth={2.5} /></div>
                    <div>
                      <p className="font-black uppercase tracking-tight text-lg italic">Quick Add</p>
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.15em] mt-1 opacity-60">Minimal fields, instant save</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAddFlowStep('full-form')}
                    className="mt-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-orange-500 transition-colors btn-tactile py-2"
                  >
                    Skip to manual entry
                  </button>
                </motion.div>
              )}

              {/* Manual Barcode Input */}
              {!isEditing && addFlowStep === 'manual-barcode' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-4">
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-8 space-y-6 soft-shadow">
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Barcode Number</label>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="e.g. 5051892123456" 
                        className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl p-5 text-sm focus:outline-none focus:border-orange-500 mt-3 font-mono tracking-widest"
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup(manualBarcode)}
                      />
                    </div>
                    <button 
                      onClick={() => handleBarcodeLookup(manualBarcode)}
                      disabled={!manualBarcode || isFetching}
                      className="w-full bg-orange-500 text-white font-black italic uppercase py-5 rounded-2xl shadow-[0_15px_30px_rgba(249,115,22,0.3)] btn-tactile disabled:opacity-50 flex items-center justify-center gap-3 text-sm tracking-widest"
                    >
                      {isFetching ? <RefreshCw size={20} className="animate-spin" /> : 'Fetch Media Data'}
                    </button>
                  </div>
                  <button 
                    onClick={() => setAddFlowStep('menu')}
                    className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 btn-tactile py-2"
                  >
                    Back to options
                  </button>
                </motion.div>
              )}

              {/* Quick Add Form */}
              {!isEditing && addFlowStep === 'quick-add' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-4">
                  <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-8 space-y-6 soft-shadow">
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Title</label>
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="Title" 
                          className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold tracking-tight"
                          value={formData.title || ''}
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Type</label>
                          <select 
                            className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl p-4 text-xs font-black uppercase focus:outline-none mt-3 tracking-widest appearance-none"
                            value={formData.type}
                            onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                          >
                            <option value="movie">Movie</option>
                            <option value="tv">TV Show</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Format</label>
                          <select 
                            className="w-full bg-black/40 border border-zinc-800/50 rounded-2xl p-4 text-xs font-black uppercase focus:outline-none mt-3 tracking-widest appearance-none"
                            value={formData.format}
                            onChange={(e) => setFormData({...formData, format: e.target.value as any})}
                          >
                            <option value="bluray">Blu-ray</option>
                            <option value="dvd">DVD</option>
                            <option value="4k">4K</option>
                          </select>
                        </div>
                      </div>
                      <button 
                        onClick={handleAddItem}
                        disabled={!formData.title}
                        className="w-full bg-orange-500 text-white font-black italic uppercase py-5 rounded-2xl shadow-[0_15px_30px_rgba(249,115,22,0.3)] btn-tactile disabled:opacity-50 mt-4 tracking-widest"
                      >
                        Save Instantly
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAddFlowStep('menu')}
                    className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 btn-tactile py-2"
                  >
                    Back to options
                  </button>
                </motion.div>
              )}

              {isScanning && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 overflow-hidden noise-overlay">
                  <div className="w-full max-w-sm aspect-square bg-zinc-900 rounded-[3rem] overflow-hidden relative border-4 border-zinc-800 shadow-2xl shadow-orange-500/10">
                    <div id="reader" className="w-full h-full scale-110"></div>
                    
                    {/* Centered Scan Area Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[75%] h-[45%] border-2 border-orange-500/50 rounded-3xl relative overflow-hidden bg-orange-500/5 backdrop-blur-[2px]">
                        {/* Scanning Line Animation */}
                        {scanStatus === 'scanning' && (
                          <motion.div 
                            initial={{ top: '0%' }}
                            animate={{ top: '100%' }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_20px_rgba(249,115,22,0.8)] z-10"
                          />
                        )}
                        
                        {/* Corner Accents */}
                        <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                        <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
                      </div>
                    </div>

                    {/* Success Overlay */}
                    {scanStatus === 'success' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-orange-500/20 backdrop-blur-md flex items-center justify-center z-20"
                      >
                        <div className="bg-orange-500 text-white p-6 rounded-full shadow-[0_0_50px_rgba(249,115,22,0.5)]">
                          <Zap size={48} strokeWidth={3} className="animate-pulse" />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="mt-10 text-center space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      {scanStatus === 'scanning' && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />}
                      <p className={cn(
                        "text-xs font-black uppercase tracking-[0.3em] font-display",
                        scanStatus === 'success' ? "text-orange-500" : "text-zinc-400"
                      )}>
                        {scanStatus === 'success' ? 'Target Locked' : 'Scanning Barcode'}
                      </p>
                    </div>
                    {!navigator.onLine && <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest opacity-60">Offline Mode Active</p>}
                    {scanError && <p className="text-xs text-red-500 font-bold tracking-tight">{scanError}</p>}
                  </div>

                  <div className="mt-16 flex gap-4 w-full max-w-xs">
                    <button 
                      onClick={() => { setIsScanning(false); setAddFlowStep('menu'); }}
                      className="flex-1 py-4 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl font-black uppercase text-[10px] tracking-widest text-zinc-500 btn-tactile"
                    >Cancel</button>
                    <button 
                      onClick={() => { setScanError(null); setScanStatus('scanning'); setIsScanning(false); setTimeout(() => setIsScanning(true), 100); }}
                      className="flex-1 py-4 bg-orange-500 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg shadow-orange-500/20 btn-tactile"
                    >Retry</button>
                  </div>
                </div>
              )}

              {/* Full Form (Manual Entry or Post-Barcode) */}
              {(isEditing || addFlowStep === 'full-form') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  {isFetching && (
                    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                      <p className="text-white font-black uppercase tracking-[0.2em] text-[10px]">Synchronizing...</p>
                    </div>
                  )}

                  {/* Image Upload */}
                  <div className="aspect-[2/3] w-56 mx-auto bg-zinc-900/50 rounded-[2.5rem] border-2 border-dashed border-zinc-800/50 flex flex-col items-center justify-center relative overflow-hidden group soft-shadow btn-tactile">
                {formData.image ? (
                  <>
                    <img src={formData.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button onClick={() => setFormData({...formData, image: undefined})} className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-full text-white btn-tactile">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                    <Camera size={40} strokeWidth={1.5} className="text-zinc-700 mb-3" />
                    <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Add Artwork</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressImage(file);
                          setFormData({...formData, image: compressed});
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Title</label>
                    <input 
                      type="text" 
                      placeholder="Enter title..." 
                      className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold tracking-tight"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  {settings.enableImdbData && (
                    <button 
                      onClick={handleFetchInfo}
                      disabled={isFetching || !formData.title}
                      className="mt-9 bg-zinc-900/60 p-5 rounded-2xl text-orange-500 disabled:opacity-50 btn-tactile border border-zinc-800/50"
                    >
                      {isFetching ? <RefreshCw size={22} className="animate-spin" /> : <Zap size={22} strokeWidth={2.5} />}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Type</label>
                    <div className="flex bg-zinc-900/40 rounded-2xl p-1.5 border border-zinc-800/50 mt-3">
                      <button 
                        onClick={() => setFormData({...formData, type: 'movie'})}
                        className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", formData.type === 'movie' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500")}
                      >Movie</button>
                      <button 
                        onClick={() => setFormData({...formData, type: 'tv'})}
                        className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", formData.type === 'tv' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-zinc-500")}
                      >TV Show</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Format</label>
                    <select 
                      className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4.5 text-[10px] font-black uppercase tracking-widest focus:outline-none mt-3 appearance-none"
                      value={formData.format}
                      onChange={(e) => setFormData({...formData, format: e.target.value as any})}
                    >
                      <option value="bluray">Blu-ray</option>
                      <option value="dvd">DVD</option>
                      <option value="4k">4K Ultra HD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Year</label>
                    <input 
                      type="text" 
                      placeholder="2024" 
                      className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold"
                      value={formData.year || ''}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Genre</label>
                    <input 
                      type="text" 
                      placeholder="Action, Sci-Fi" 
                      className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold"
                      value={formData.genre || ''}
                      onChange={(e) => setFormData({...formData, genre: e.target.value})}
                    />
                  </div>
                </div>

                {formData.type === 'tv' && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Seasons Added</label>
                    <div className="flex flex-wrap gap-2.5 mt-4">
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(s => (
                        <button 
                          key={s}
                          onClick={() => {
                            const current = formData.seasons || [];
                            const exists = current.find(x => x.number === s);
                            if (exists) {
                              setFormData({...formData, seasons: current.filter(x => x.number !== s)});
                            } else {
                              setFormData({...formData, seasons: [...current, { number: s, addedAt: Date.now() }]});
                            }
                          }}
                          className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-black border transition-all btn-tactile",
                            formData.seasons?.find(x => x.number === s) 
                              ? "bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20" 
                              : "bg-zinc-900/40 border-zinc-800/50 text-zinc-600"
                          )}
                        >S{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Actors</label>
                  <input 
                    type="text" 
                    placeholder="Tom Cruise, Brad Pitt..." 
                    className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold"
                    value={formData.actors?.join(', ') || ''}
                    onChange={(e) => setFormData({...formData, actors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Tags</label>
                  <input 
                    type="text" 
                    placeholder="Action, Sci-Fi, Steelbook..." 
                    className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold"
                    value={formData.tags?.join(', ') || ''}
                    onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Amazon UK Link</label>
                  <input 
                    type="text" 
                    placeholder="https://www.amazon.co.uk/..." 
                    className="w-full bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 text-sm focus:outline-none focus:border-orange-500 mt-3 font-bold truncate"
                    value={formData.amazonUrl || ''}
                    onChange={(e) => setFormData({...formData, amazonUrl: e.target.value})}
                  />
                </div>

                {formData.description && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">Description</label>
                    <p className={cn(
                      "p-6 rounded-3xl text-xs leading-relaxed border mt-3 soft-shadow",
                      settings.theme === 'dark' ? "bg-zinc-900/30 border-zinc-800/50 text-zinc-400" : "bg-black/5 border-black/5 text-zinc-600"
                    )}>
                      {formData.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6 space-y-4">
                  <button 
                    onClick={handleAddItem}
                    className="w-full bg-orange-500 text-white font-black italic uppercase py-5 rounded-2xl shadow-[0_15px_30px_rgba(249,115,22,0.3)] btn-tactile tracking-widest"
                  >
                    {isEditing ? 'Update Entry' : 'Commit to Vault (+XP)'}
                  </button>
                  {!isEditing && (
                    <button 
                      onClick={() => setAddFlowStep('menu')}
                      className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 btn-tactile py-2"
                    >
                      Back to options
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={cn(
              "fixed inset-0 z-[70] overflow-y-auto transition-colors duration-500 noise-overlay",
              settings.theme === 'dark' ? "bg-black" : `theme-${settings.theme}`
            )}
          >
            <div className="relative aspect-[2/3] w-full max-h-[65vh] overflow-hidden">
              {selectedItem.image ? (
                <motion.img 
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  src={selectedItem.image} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className={cn(
                  "w-full h-full flex items-center justify-center italic font-display text-4xl font-black opacity-10 uppercase tracking-tightest",
                  settings.theme === 'dark' ? "bg-zinc-900 text-white" : "bg-black/5 text-inherit"
                )}>CineVault</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <button 
                onClick={() => setSelectedItem(null)} 
                className="absolute top-12 right-6 p-3 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-white btn-tactile"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 -mt-20 relative space-y-8 pb-32 max-w-2xl mx-auto">
              <div className="flex justify-between items-start gap-6">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-[10px] bg-orange-500 text-white px-3 py-1 rounded-lg uppercase font-black italic shadow-lg shadow-orange-500/20 tracking-widest">{selectedItem.format}</span>
                    <span className={cn(
                      "text-[10px] px-3 py-1 rounded-lg uppercase font-black italic tracking-widest",
                      settings.theme === 'dark' ? "bg-zinc-800 text-white" : "bg-black/10 text-inherit"
                    )}>{selectedItem.type}</span>
                    {selectedItem.rating && (
                      <span className="text-[10px] bg-yellow-500 text-black px-3 py-1 rounded-lg uppercase font-black italic flex items-center gap-1 tracking-widest">
                        <Star size={10} fill="currentColor" /> {selectedItem.rating}
                      </span>
                    )}
                  </div>
                  <h2 className={cn(
                    "text-5xl font-black tracking-tightest italic uppercase leading-[0.9] font-display",
                    settings.theme === 'dark' ? "text-white" : "text-inherit"
                  )}>{selectedItem.title}</h2>
                  <div className="flex gap-4 mt-4 opacity-50 text-[10px] font-black uppercase tracking-[0.2em]">
                    {selectedItem.year && <span className="flex items-center gap-1.5"><Calendar size={12} strokeWidth={2.5} /> {selectedItem.year}</span>}
                    {selectedItem.genre && <span className="flex items-center gap-1.5"><TagIcon size={12} strokeWidth={2.5} /> {selectedItem.genre}</span>}
                  </div>
                  {selectedItem.description && (
                    <p className={cn(
                      "mt-6 text-sm leading-relaxed opacity-70 font-medium",
                      settings.theme === 'dark' ? "text-zinc-300" : "text-zinc-700"
                    )}>
                      {selectedItem.description}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setFormData(selectedItem);
                    setIsEditing(true);
                  }}
                  className="p-4 bg-orange-500 rounded-2xl text-white shadow-xl shadow-orange-500/20 btn-tactile"
                >
                  <Edit2 size={24} strokeWidth={2.5} />
                </button>
              </div>

              {settings.enableAmazonLinks && (
                <a 
                  href={selectedItem.amazonUrl || getAmazonUkLink(selectedItem.title, selectedItem.format)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "w-full flex items-center justify-between p-6 rounded-3xl border transition-all btn-tactile soft-shadow",
                    settings.theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/50" : "glass-card border-black/10"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black italic text-sm shadow-lg shadow-orange-500/20">A</div>
                    <div className="text-left">
                      <p className="font-black uppercase tracking-tight text-sm italic">Amazon Marketplace</p>
                      <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mt-0.5">Check current value</p>
                    </div>
                  </div>
                  <ExternalLink size={18} className="text-zinc-600" />
                </a>
              )}

              {selectedItem.type === 'tv' && selectedItem.seasons && selectedItem.seasons.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase opacity-40 tracking-[0.3em]">Seasons Collected</h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedItem.seasons.sort((a,b) => a.number - b.number).map(s => (
                      <div key={s.number} className={cn(
                        "border px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest soft-shadow",
                        settings.theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/50 text-white" : "glass-card border-black/10"
                      )}>
                        Season {s.number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.actors.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase opacity-40 tracking-[0.3em]">Starring</h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {selectedItem.actors.map(actor => (
                      <span key={actor} className="text-sm font-black uppercase tracking-tight italic opacity-80">{actor}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.tags.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase opacity-40 tracking-[0.3em]">Vault Tags</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedItem.tags.map(tag => (
                      <span key={tag} className={cn(
                        "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border soft-shadow",
                        settings.theme === 'dark' ? "bg-zinc-900/40 text-zinc-400 border-zinc-800/50" : "glass-card border-black/10 opacity-70"
                      )}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-12">
                <button 
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  className="w-full bg-red-500/5 text-red-500 border border-red-500/10 font-black uppercase text-[10px] tracking-[0.2em] py-5 rounded-2xl btn-tactile"
                >
                  Purge from Vault
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {settings.showBottomNav && (
        <BottomNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          theme={settings.theme} 
          setAddFlowStep={setAddFlowStep}
          setIsAdding={setIsAdding}
        />
      )}
    </div>
  );
}
