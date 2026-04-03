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
  Globe
} from 'lucide-react';
import { getDB, MediaItem, compressImage, calculateLevel, getSettings, updateSetting, ThemeType, DisplayMode, AppSettings } from './lib/db';
import { cn } from './lib/utils';
import { fetchMediaInfo, getAmazonUkLink, urlToBase64 } from './lib/gemini';

// --- Components ---

const BottomNav = ({ activeTab, setActiveTab, theme }: { activeTab: string, setActiveTab: (t: string) => void, theme: ThemeType }) => (
  <nav className={cn(
    "fixed bottom-0 left-0 right-0 border-t pb-safe pt-2 px-6 flex justify-between items-center z-50",
    theme === 'dark' ? "bg-zinc-900/90 backdrop-blur-md border-zinc-800" : "glass-card border-zinc-500/20"
  )}>
    <button onClick={() => setActiveTab('library')} className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'library' ? "text-orange-500" : "text-zinc-500")}>
      <Library size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">Library</span>
    </button>
    <button onClick={() => setActiveTab('add')} className="bg-orange-500 text-white p-3 rounded-full -mt-8 shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
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
    enableImdbData: true
  });
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

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
      amazonUrl: formData.amazonUrl || getAmazonUkLink(formData.title, formData.format || 'bluray'),
      seasons: formData.seasons || [],
      addedAt: isEditing && formData.addedAt ? formData.addedAt : Date.now(),
      xp: formData.type === 'movie' ? 50 : 30 + (formData.seasons?.length || 0) * 20
    };
    await db.put('collection', newItem);
    setIsAdding(false);
    setIsEditing(false);
    setIsQuickAdding(false);
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
        year: data.year,
        genre: data.genre,
        rating: data.rating,
        actors: [...new Set([...(prev.actors || []), ...data.actors])],
        image: base64Image || prev.image
      }));
    }
    setIsFetching(false);
  };

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
        "p-6 pt-12 border-b",
        settings.theme === 'dark' ? "bg-gradient-to-b from-zinc-900 to-black border-zinc-800/50" : "bg-transparent border-black/10"
      )}>
        <div className="flex justify-between items-start mb-6">
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
        {(activeTab === 'add' || isAdding || isEditing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[60] p-6 overflow-y-auto"
          >
            <div className="max-w-md mx-auto space-y-6 pb-12">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">{isEditing ? 'Edit Item' : 'Add to Vault'}</h2>
                <button onClick={() => { setIsAdding(false); setIsEditing(false); setActiveTab('library'); }} className="p-2 bg-zinc-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

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

                <button 
                  onClick={handleAddItem}
                  className="w-full bg-orange-500 text-white font-black italic uppercase py-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                >
                  {isEditing ? 'Update Vault' : 'Add to Vault (+XP)'}
                </button>
              </div>
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

      {/* Quick Add Button */}
      {activeTab === 'library' && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsQuickAdding(true)}
          className="fixed bottom-24 right-6 bg-zinc-900 text-orange-500 p-4 rounded-full shadow-2xl border border-zinc-800 active:scale-90 transition-transform z-40"
        >
          <Zap size={24} />
        </motion.button>
      )}

      {/* Quick Add Modal */}
      <AnimatePresence>
        {isQuickAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={cn(
                "w-full max-w-sm rounded-2xl p-6 space-y-4 border shadow-2xl",
                settings.theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-black/10"
              )}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black italic uppercase tracking-tighter">Quick Add</h3>
                <button onClick={() => setIsQuickAdding(false)} className="p-1.5 bg-zinc-800 rounded-full text-zinc-400">
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-3">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Title" 
                  className="w-full bg-black/20 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-500"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    className="bg-black/20 border border-zinc-800 rounded-xl p-3 text-xs font-bold uppercase focus:outline-none"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                  >
                    <option value="movie">Movie</option>
                    <option value="tv">TV Show</option>
                  </select>
                  <select 
                    className="bg-black/20 border border-zinc-800 rounded-xl p-3 text-xs font-bold uppercase focus:outline-none"
                    value={formData.format}
                    onChange={(e) => setFormData({...formData, format: e.target.value as any})}
                  >
                    <option value="bluray">Blu-ray</option>
                    <option value="dvd">DVD</option>
                    <option value="4k">4K</option>
                  </select>
                </div>
                <button 
                  onClick={handleAddItem}
                  className="w-full bg-orange-500 text-white font-black italic uppercase py-3 rounded-xl active:scale-[0.98] transition-all"
                >
                  Save Instantly
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} theme={settings.theme} />
    </div>
  );
}
