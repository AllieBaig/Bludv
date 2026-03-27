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
  ChevronRight
} from 'lucide-react';
import { getDB, MediaItem, compressImage, calculateLevel } from './lib/db';
import { cn } from './lib/utils';

// --- Components ---

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800 pb-safe pt-2 px-6 flex justify-between items-center z-50">
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

const MediaCard: React.FC<{ item: MediaItem, onClick: () => void }> = ({ item, onClick }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className="relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800 group cursor-pointer border border-zinc-700/50"
  >
    {item.image ? (
      <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-zinc-600 italic text-sm p-4 text-center">
        {item.title}
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
      <p className="text-white text-xs font-bold truncate">{item.title}</p>
      <div className="flex gap-1 mt-1">
        <span className="text-[8px] bg-orange-500 text-white px-1 rounded uppercase font-bold">{item.format}</span>
        <span className="text-[8px] bg-zinc-700 text-white px-1 rounded uppercase font-bold">{item.type}</span>
      </div>
    </div>
    <div className="absolute top-2 right-2">
      {item.type === 'movie' ? <Film size={14} className="text-white/50" /> : <Tv size={14} className="text-white/50" />}
    </div>
  </motion.div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [stats, setStats] = useState({ totalXp: 0, count: 0 });

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
  }, []);

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
      id: crypto.randomUUID(),
      title: formData.title,
      type: formData.type as any,
      format: formData.format as any,
      image: formData.image,
      actors: formData.actors || [],
      tags: formData.tags || [],
      seasons: formData.seasons || [],
      addedAt: Date.now(),
      xp: formData.type === 'movie' ? 50 : 30 + (formData.seasons?.length || 0) * 20
    };
    await db.put('collection', newItem);
    setIsAdding(false);
    setFormData({ type: 'movie', format: 'bluray', actors: [], tags: [], seasons: [] });
    loadData();
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
    const exportFileDefaultName = 'cinevault_backup.json';
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
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-orange-500/30 pb-24">
      {/* Header / Stats */}
      <header className="p-6 pt-12 bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800/50">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase">CineVault</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">{title}</p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-orange-500">
              <Trophy size={18} />
              <span className="text-2xl font-black tracking-tighter italic">LVL {level}</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">{stats.totalXp} / {nextLevelXp} XP</p>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" 
                placeholder="Search by title, actor, or tag..." 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map(item => (
                  <MediaCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
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
          <div className="space-y-4 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <SettingsIcon size={20} /> Settings
            </h2>
            
            <button onClick={() => window.location.reload()} className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className="text-blue-500" />
                <span className="font-medium">Refresh App</span>
              </div>
              <ChevronRight size={16} className="text-zinc-600" />
            </button>

            <button onClick={handleExport} className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-green-500" />
                <span className="font-medium">Export Backup</span>
              </div>
              <ChevronRight size={16} className="text-zinc-600" />
            </button>

            <label className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 active:scale-[0.98] transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <Upload size={20} className="text-purple-500" />
                <span className="font-medium">Import Backup</span>
              </div>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              <ChevronRight size={16} className="text-zinc-600" />
            </label>

            <button onClick={clearCache} className="w-full flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800 active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <Trash2 size={20} className="text-red-500" />
                <span className="font-medium">Clear All Data</span>
              </div>
              <ChevronRight size={16} className="text-zinc-600" />
            </button>

            <div className="pt-8 text-center text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
              CineVault v1.0.0 • Offline Ready
            </div>
          </div>
        )}
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {(activeTab === 'add' || isAdding) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[60] p-6 overflow-y-auto"
          >
            <div className="max-w-md mx-auto space-y-6 pb-12">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Add to Vault</h2>
                <button onClick={() => { setIsAdding(false); setActiveTab('library'); }} className="p-2 bg-zinc-800 rounded-full">
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
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Title</label>
                  <input 
                    type="text" 
                    placeholder="Enter movie or show title..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
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

                {formData.type === 'tv' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Seasons Added</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[1,2,3,4,5,6,7,8,9,10].map(s => (
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
                    onChange={(e) => setFormData({...formData, actors: e.target.value.split(',').map(s => s.trim())})}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-500 ml-1">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="Action, Sci-Fi, Steelbook..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-orange-500"
                    onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(s => s.trim())})}
                  />
                </div>

                <button 
                  onClick={handleAddItem}
                  className="w-full bg-orange-500 text-white font-black italic uppercase py-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                >
                  Add to Collection (+XP)
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
            className="fixed inset-0 bg-black z-[70] overflow-y-auto"
          >
            <div className="relative aspect-[2/3] w-full max-h-[60vh]">
              {selectedItem.image ? (
                <img src={selectedItem.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700 italic">No Image</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <button onClick={() => setSelectedItem(null)} className="absolute top-12 right-6 p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 -mt-12 relative space-y-6 pb-12">
              <div>
                <div className="flex gap-2 mb-2">
                  <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded uppercase font-black italic">{selectedItem.format}</span>
                  <span className="text-[10px] bg-zinc-800 text-white px-2 py-0.5 rounded uppercase font-black italic">{selectedItem.type}</span>
                </div>
                <h2 className="text-4xl font-black tracking-tighter italic uppercase text-white leading-none">{selectedItem.title}</h2>
              </div>

              {selectedItem.type === 'tv' && selectedItem.seasons && selectedItem.seasons.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-zinc-500 mb-3 tracking-widest">Seasons Collected</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.seasons.sort((a,b) => a.number - b.number).map(s => (
                      <div key={s.number} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg text-xs font-bold">
                        Season {s.number}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.actors.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-zinc-500 mb-3 tracking-widest">Cast</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.actors.map(actor => (
                      <span key={actor} className="text-sm font-medium text-zinc-300">{actor}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.tags.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-zinc-500 mb-3 tracking-widest">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.tags.map(tag => (
                      <span key={tag} className="bg-zinc-900 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-zinc-800">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-zinc-800 flex gap-4">
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

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
