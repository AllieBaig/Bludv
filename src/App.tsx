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
    "fixed bottom-0 left-0 right-0 border-t pb-safe pt-2 px-6 flex justify-between items-center z-50",
    theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-md border-zinc-800" : "glass-card border-zinc-500/20"
  )}>
    <button onClick={() => setActiveTab('library')} className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'library' ? "text-orange-500" : "text-zinc-500")}>
      <Library size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">Library</span>
    </button>
    <button onClick={() => { setAddFlowStep('menu'); setIsAdding(true); }} className="bg-orange-500 text-white p-3 rounded-full -mt-8 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
      <Plus size={28} />
    </button>
    <button onClick={() => setActiveTab('settings')} className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'settings' ? "text-orange-500" : "text-zinc-500")}>
      <SettingsIcon size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
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
          "flex items-center justify-between p-3 rounded-xl border cursor-pointer active:scale-[0.99] transition-all",
          theme === 'dark' ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700" : "glass-card border-black/5 hover:border-black/10"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {item.type === 'movie' ? <Film size={16} className="text-orange-500 shrink-0" /> : <Tv size={16} className="text-orange-500 shrink-0" />}
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate leading-tight">{item.title}</p>
            <p className="text-[10px] opacity-50 uppercase font-bold tracking-wider">
              {item.format} • {item.type === 'tv' ? `${item.seasons?.length || 0} Seasons` : 'Movie'}
            </p>
          </div>
        </div>
        <ChevronRight size={14} className="text-zinc-600 shrink-0" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "relative aspect-[2/3] rounded-xl overflow-hidden group cursor-pointer border",
        theme === 'dark' ? "bg-zinc-800 border-zinc-700/50" : "glass-card",
        mode === 'minimal' && "rounded-lg"
      )}
    >
      {item.image ? (
        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-600 italic text-sm p-4 text-center">
          {item.title}
        </div>
      )}
      
      {mode === 'normal' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
          <p className="text-white text-xs font-bold truncate">{item.title}</p>
          <div className="flex gap-1 mt-1">
            <span className="text-[8px] bg-orange-500 text-white px-1 rounded uppercase font-bold">{item.format}</span>
            <span className="text-[8px] bg-zinc-700 text-white px-1 rounded uppercase font-bold">{item.type}</span>
          </div>
        </div>
      )}

      <div className={cn(
        "absolute top-2 right-2",
        mode === 'minimal' && "top-1 right-1"
      )}>
        {item.type === 'movie' ? <Film size={mode === 'minimal' ? 10 : 14} className="text-white/50" /> : <Tv size={mode === 'minimal' ? 10 : 14} className="text-white/50" />}
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
      "min-h-screen font-sans selection:bg-orange-500/30 pb-24 transition-colors duration-500",
      settings.theme === 'dark' ? "bg-black text-zinc-100" : `theme-${settings.theme}`
    )}>
      {/* Header / Stats */}
      <header className={cn(
        "p-6 pt-12 border-b sticky top-0 z-40",
        settings.theme === 'dark' ? "bg-black/80 backdrop-blur-md border-zinc-800/50" : "bg-white/80 backdrop-blur-md border-black/10"
      )}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className={cn(
                "text-3xl font-black tracking-tighter italic uppercase",
                settings.theme === 'dark' ? "text-white" : "text-inherit"
              )}>CineVault</h1>
              <p className={cn(
                "text-xs font-bold uppercase tracking-widest mt-1",
                settings.theme === 'dark' ? "text-zinc-500" : "opacity-60"
              )}>{title}</p>
            </div>
            {!settings.showBottomNav && (
              <div className="flex gap-2">
                <button 
                  onClick={() => { setAddFlowStep('menu'); setIsAdding(true); }}
                  className="p-2 bg-orange-500 text-white rounded-full transition-all active:scale-90"
                >
                  <Plus size={18} />
                </button>
                <button 
                  onClick={() => setActiveTab(activeTab === 'settings' ? 'library' : 'settings')}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    activeTab === 'settings' ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400"
                  )}
                >
                  <SettingsIcon size={18} />
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-orange-500">
              <Trophy size={18} />
              <span className="text-2xl font-black tracking-tighter italic">LVL {level}</span>
            </div>
            <p className={cn(
              "text-[10px] font-mono mt-1 uppercase",
              settings.theme === 'dark' ? "text-zinc-500" : "opacity-60"
            )}>{stats.totalXp} / {nextLevelXp} XP</p>
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
              <h3 className="text-[10px] font-bold uppercase opacity-50 mb-3 tracking-widest">Vault Appearance</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['dark', 'paper', 'glass', 'wood', 'metal', 'fabric'] as ThemeType[]).map(t => (
                  <button 
                    key={t}
                    onClick={() => handleSettingChange('theme', t)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all active:scale-95",
                      settings.theme === t ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900/50"
                    )}
                  >
                    <div className={cn("w-full aspect-square rounded-lg border border-white/10", `theme-${t}`, t === 'dark' && "bg-black")} />
                    <span className="text-[10px] font-bold uppercase">{t}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Display Mode Selection */}
            <div>
              <h3 className="text-[10px] font-bold uppercase opacity-50 mb-3 tracking-widest">Display Mode</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'normal', icon: LayoutGrid, label: 'Normal' },
                  { id: 'minimal', icon: Maximize2, label: 'Minimal' },
                  { id: 'text', icon: List, label: 'Text' }
                ].map(m => (
                  <button 
                    key={m.id}
                    onClick={() => handleSettingChange('displayMode', m.id as DisplayMode)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all active:scale-95",
                      settings.displayMode === m.id ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900/50"
                    )}
                  >
                    <m.icon size={20} className={settings.displayMode === m.id ? "text-orange-500" : "text-zinc-500"} />
                    <span className="text-[10px] font-bold uppercase">{m.label}</span>
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
            className="fixed inset-0 bg-black/95 z-[60] p-6 overflow-y-auto"
          >
            <div className="max-w-md mx-auto space-y-6 pb-12">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">{isEditing ? 'Edit Item' : 'Add to Vault'}</h2>
                <div className="flex gap-2">
                  <button onClick={() => { setIsAdding(false); setIsEditing(false); setAddFlowStep(null); }} className="p-2 bg-zinc-800 rounded-full">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Unified Add Flow Menu */}
              {!isEditing && addFlowStep === 'menu' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 pt-4">
                  <button 
                    onClick={() => { setIsScanning(true); setAddFlowStep('scan'); }}
                    className="flex items-center gap-4 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl active:scale-95 transition-all text-left group"
                  >
                    <div className="p-3 bg-orange-500 rounded-xl text-white group-active:scale-90 transition-transform"><Barcode size={24} /></div>
                    <div>
                      <p className="font-bold uppercase tracking-tight">Scan Barcode</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Use camera to auto-detect</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAddFlowStep('manual-barcode')}
                    className="flex items-center gap-4 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl active:scale-95 transition-all text-left group"
                  >
                    <div className="p-3 bg-blue-500 rounded-xl text-white group-active:scale-90 transition-transform"><Edit2 size={24} /></div>
                    <div>
                      <p className="font-bold uppercase tracking-tight">Enter Barcode Manually</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Type barcode number</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAddFlowStep('quick-add')}
                    className="flex items-center gap-4 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl active:scale-95 transition-all text-left group"
                  >
                    <div className="p-3 bg-purple-500 rounded-xl text-white group-active:scale-90 transition-transform"><Zap size={24} /></div>
                    <div>
                      <p className="font-bold uppercase tracking-tight">Quick Add</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Minimal fields, save instantly</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setAddFlowStep('full-form')}
                    className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Skip to manual entry
                  </button>
                </motion.div>
              )}

              {/* Manual Barcode Input */}
              {!isEditing && addFlowStep === 'manual-barcode' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Barcode Number</label>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="e.g. 5051892123456" 
                        className="w-full bg-black/20 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500 mt-2"
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup(manualBarcode)}
                      />
                    </div>
                    <button 
                      onClick={() => handleBarcodeLookup(manualBarcode)}
                      disabled={!manualBarcode || isFetching}
                      className="w-full bg-orange-500 text-white font-black italic uppercase py-4 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isFetching ? <RefreshCw size={18} className="animate-spin" /> : 'Fetch Media Data'}
                    </button>
                  </div>
                  <button 
                    onClick={() => setAddFlowStep('menu')}
                    className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600"
                  >
                    Back to options
                  </button>
                </motion.div>
              )}

              {/* Quick Add Form */}
              {!isEditing && addFlowStep === 'quick-add' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Title</label>
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="Title" 
                          className="w-full bg-black/20 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500 mt-2"
                          value={formData.title || ''}
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Type</label>
                          <select 
                            className="w-full bg-black/20 border border-zinc-800 rounded-xl p-3 text-xs font-bold uppercase focus:outline-none mt-2"
                            value={formData.type}
                            onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                          >
                            <option value="movie">Movie</option>
                            <option value="tv">TV Show</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Format</label>
                          <select 
                            className="w-full bg-black/20 border border-zinc-800 rounded-xl p-3 text-xs font-bold uppercase focus:outline-none mt-2"
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
                        className="w-full bg-orange-500 text-white font-black italic uppercase py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                      >
                        Save Instantly
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAddFlowStep('menu')}
                    className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600"
                  >
                    Back to options
                  </button>
                </motion.div>
              )}

              {isScanning && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 overflow-hidden">
                  <div className="w-full max-w-sm aspect-square bg-zinc-900 rounded-2xl overflow-hidden relative border-2 border-orange-500 shadow-2xl shadow-orange-500/20">
                    <div id="reader" className="w-full h-full"></div>
                    
                    {/* Centered Scan Area Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[70%] h-[42%] border-2 border-orange-500 rounded-lg relative overflow-hidden">
                        {/* Scanning Line Animation */}
                        {scanStatus === 'scanning' && (
                          <motion.div 
                            initial={{ top: '0%' }}
                            animate={{ top: '100%' }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute left-0 right-0 h-0.5 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] z-10"
                          />
                        )}
                        
                        {/* Corner Accents */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-orange-500 -translate-x-1 -translate-y-1" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-orange-500 translate-x-1 -translate-y-1" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-orange-500 -translate-x-1 translate-y-1" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-orange-500 translate-x-1 translate-y-1" />
                      </div>
                    </div>

                    {/* Success Overlay */}
                    {scanStatus === 'success' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-20"
                      >
                        <div className="bg-green-500 text-white p-4 rounded-full shadow-lg">
                          <Zap size={32} className="animate-pulse" />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <div className="mt-8 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      {scanStatus === 'scanning' && <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                      <p className={cn(
                        "text-sm font-bold uppercase tracking-[0.2em]",
                        scanStatus === 'success' ? "text-green-500" : "text-zinc-400"
                      )}>
                        {scanStatus === 'success' ? 'Barcode Detected!' : 'Align Barcode in Frame'}
                      </p>
                    </div>
                    {!navigator.onLine && <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">Offline Mode: Manual entry after scan</p>}
                    {scanError && <p className="text-xs text-red-500 font-medium">{scanError}</p>}
                  </div>

                  <div className="mt-12 flex gap-4">
                    <button 
                      onClick={() => { setIsScanning(false); setAddFlowStep('menu'); }}
                      className="px-8 py-3 bg-zinc-800 rounded-full font-bold uppercase text-[10px] tracking-widest text-zinc-400 active:scale-95 transition-transform"
                    >Cancel</button>
                    <button 
                      onClick={() => { setScanError(null); setScanStatus('scanning'); setIsScanning(false); setTimeout(() => setIsScanning(true), 100); }}
                      className="px-8 py-3 bg-orange-500 rounded-full font-bold uppercase text-[10px] tracking-widest text-white active:scale-95 transition-transform"
                    >Retry</button>
                  </div>
                </div>
              )}

              {/* Full Form (Manual Entry or Post-Barcode) */}
              {(isEditing || addFlowStep === 'full-form') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {isFetching && (
                    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
                      <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-white font-bold uppercase tracking-widest text-xs">Fetching Data...</p>
                    </div>
                  )}

                  {/* Image Upload */}
                  <div className="aspect-[2/3] w-48 mx-auto bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden group">
                {formData.image ? (
                  <>
                    <img src={formData.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button onClick={() => setFormData({...formData, image: undefined})} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Camera size={32} className="text-zinc-700 mb-2" />
                    <span className="text-[10px] font-bold uppercase text-zinc-600">Add Photo</span>
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
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Title</label>
                    <input 
                      type="text" 
                      placeholder="Enter movie or show title..." 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  {settings.enableImdbData && (
                    <button 
                      onClick={handleFetchInfo}
                      disabled={isFetching || !formData.title}
                      className="mt-5 bg-zinc-800 p-4 rounded-xl text-orange-500 disabled:opacity-50"
                    >
                      {isFetching ? <RefreshCw size={20} className="animate-spin" /> : <Zap size={20} />}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Type</label>
                    <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                      <button 
                        onClick={() => setFormData({...formData, type: 'movie'})}
                        className={cn("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all", formData.type === 'movie' ? "bg-orange-500 text-white" : "text-zinc-500")}
                      >Movie</button>
                      <button 
                        onClick={() => setFormData({...formData, type: 'tv'})}
                        className={cn("flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all", formData.type === 'tv' ? "bg-orange-500 text-white" : "text-zinc-500")}
                      >TV Show</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Format</label>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs font-bold uppercase focus:outline-none"
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
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Year</label>
                    <input 
                      type="text" 
                      placeholder="2024" 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500"
                      value={formData.year || ''}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Genre</label>
                    <input 
                      type="text" 
                      placeholder="Action, Sci-Fi" 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500"
                      value={formData.genre || ''}
                      onChange={(e) => setFormData({...formData, genre: e.target.value})}
                    />
                  </div>
                </div>

                {formData.type === 'tv' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Seasons Added</label>
                    <div className="flex flex-wrap gap-2 mt-2">
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
                            "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border transition-all",
                            formData.seasons?.find(x => x.number === s) ? "bg-orange-500 border-orange-400 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                          )}
                        >S{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Actors (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="Tom Cruise, Brad Pitt..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500"
                    value={formData.actors?.join(', ') || ''}
                    onChange={(e) => setFormData({...formData, actors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="Action, Sci-Fi, Steelbook..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500"
                    value={formData.tags?.join(', ') || ''}
                    onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Amazon UK Link (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="https://www.amazon.co.uk/..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500"
                    value={formData.amazonUrl || ''}
                    onChange={(e) => setFormData({...formData, amazonUrl: e.target.value})}
                  />
                </div>

                {formData.description && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Description</label>
                    <p className={cn(
                      "p-4 rounded-xl text-xs leading-relaxed border",
                      settings.theme === 'dark' ? "bg-zinc-900/50 border-zinc-800 text-zinc-400" : "bg-black/5 border-black/5 text-zinc-600"
                    )}>
                      {formData.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                  <button 
                    onClick={handleAddItem}
                    className="w-full bg-orange-500 text-white font-black italic uppercase py-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                  >
                    {isEditing ? 'Update Vault' : 'Add to Vault (+XP)'}
                  </button>
                  {!isEditing && (
                    <button 
                      onClick={() => setAddFlowStep('menu')}
                      className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600"
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
              "fixed inset-0 z-[70] overflow-y-auto transition-colors duration-500",
              settings.theme === 'dark' ? "bg-black" : `theme-${settings.theme}`
            )}
          >
            <div className="relative aspect-[2/3] w-full max-h-[60vh]">
              {selectedItem.image ? (
                <img src={selectedItem.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className={cn(
                  "w-full h-full flex items-center justify-center italic",
                  settings.theme === 'dark' ? "bg-zinc-900 text-zinc-700" : "bg-black/5 text-inherit opacity-50"
                )}>No Image</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <button onClick={() => setSelectedItem(null)} className="absolute top-12 right-6 p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 -mt-12 relative space-y-6 pb-12">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded uppercase font-black italic">{selectedItem.format}</span>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded uppercase font-black italic",
                      settings.theme === 'dark' ? "bg-zinc-800 text-white" : "bg-black/10 text-inherit"
                    )}>{selectedItem.type}</span>
                    {selectedItem.rating && (
                      <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded uppercase font-black italic flex items-center gap-1">
                        <Star size={8} fill="currentColor" /> {selectedItem.rating}
                      </span>
                    )}
                  </div>
                  <h2 className={cn(
                    "text-4xl font-black tracking-tighter italic uppercase leading-none",
                    settings.theme === 'dark' ? "text-white" : "text-inherit"
                  )}>{selectedItem.title}</h2>
                  <div className="flex gap-3 mt-2 opacity-60 text-[10px] font-bold uppercase tracking-widest">
                    {selectedItem.year && <span className="flex items-center gap-1"><Calendar size={10} /> {selectedItem.year}</span>}
                    {selectedItem.genre && <span className="flex items-center gap-1"><TagIcon size={10} /> {selectedItem.genre}</span>}
                  </div>
                  {selectedItem.description && (
                    <p className={cn(
                      "mt-4 text-xs leading-relaxed opacity-70 line-clamp-3",
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
                  className="p-3 bg-zinc-800 rounded-xl text-orange-500"
                >
                  <Edit2 size={20} />
                </button>
              </div>

              {settings.enableAmazonLinks && (
                <a 
                  href={selectedItem.amazonUrl || getAmazonUkLink(selectedItem.title, selectedItem.format)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-95",
                    settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black italic text-xs">A</div>
                    <span className="font-bold text-sm">View on Amazon UK</span>
                  </div>
                  <ExternalLink size={16} className="text-zinc-600" />
                </a>
              )}

              {selectedItem.type === 'tv' && selectedItem.seasons && selectedItem.seasons.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase opacity-50 mb-3 tracking-widest">Seasons Collected</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.seasons.sort((a,b) => a.number - b.number).map(s => (
                      <div key={s.number} className={cn(
                        "border px-4 py-2 rounded-lg text-xs font-bold",
                        settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "glass-card border-black/10"
                      )}>
                        Season {s.number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.actors.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase opacity-50 mb-3 tracking-widest">Cast</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.actors.map(actor => (
                      <span key={actor} className="text-sm font-medium opacity-80">{actor}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.tags.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase opacity-50 mb-3 tracking-widest">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.tags.map(tag => (
                      <span key={tag} className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        settings.theme === 'dark' ? "bg-zinc-900 text-zinc-400 border-zinc-800" : "glass-card border-black/10 opacity-70"
                      )}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className={cn(
                "pt-6 border-t flex gap-4",
                settings.theme === 'dark' ? "border-zinc-800" : "border-black/10"
              )}>
                <button 
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 font-bold uppercase text-xs py-4 rounded-xl active:scale-[0.98] transition-all"
                >
                  Remove from Vault
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
