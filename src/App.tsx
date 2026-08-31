import React, { useState, lazy, Suspense, useMemo } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Sidebar } from './components/Sidebar';
import { BottomNavBar } from './components/Mobile/BottomNavBar';
import { PlayerBar } from './components/PlayerBar';
import { AlbumGrid } from './components/MainView/AlbumGrid';
import { TrackList } from './components/MainView/TrackList';
import { AlbumDetail } from './components/MainView/AlbumDetail';
import { HomeView } from './components/HomeView';
import { LyricsPanel } from './components/LyricsPanel';
import { QueueView } from './components/QueueView';
import { ContextMenu } from './components/ContextMenu';
import type { ContextMenuTarget } from './components/ContextMenu';
import { EditMetadataModal } from './components/EditMetadataModal';
import { AudioQualityModal } from './components/AudioQualityModal';
import { SettingsModal } from './components/SettingsModal';
import { LyricsSearchModal } from './components/LyricsSearchModal';
import { BatchLyricsModal } from './components/BatchLyricsModal';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { useAppUpdater } from './hooks/useAppUpdater';
import { NavigationHeader } from './components/NavigationHeader';
import type { Album, Track } from './types';
import { ListMusic, Play, Shuffle, Search, X, ArrowLeft } from 'lucide-react';
import { formatTime } from './utils/lrcParser';
import { isTrackByArtist, getRandomArtistCover } from './utils/artistParser';
import { convertFileSrc } from './utils/tauriBridge';

// Lazy load các view nặng – chỉ load khi người dùng điều hướng đến
const AnalyticsView = lazy(() => import('./components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const MvPlayerView = lazy(() => import('./components/MvPlayerView').then(m => ({ default: m.MvPlayerView })));
const MusicDiscoveryView = lazy(() => import('./components/MusicDiscoveryView').then(m => ({ default: m.MusicDiscoveryView })));

// Fallback nhẹ khi lazy chunk đang tải
const ViewFallback = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-apple-pink/30 border-t-apple-pink rounded-full animate-spin" />
  </div>
);

const totalDuration = (tracks: Track[]) => tracks.reduce((total, track) => total + (track.duration || 0), 0);

const CollectionHeader: React.FC<{
  kind: string;
  title: string;
  subtitle: string;
  tracks: Track[];
  cover?: string | null;
  artist?: boolean;
}> = ({ kind, title, subtitle, tracks, cover, artist }) => {
  const { playTrack, goBack, canGoBack } = usePlayer();
  const startPlayback = (shuffle = false) => {
    const queue = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    if (queue.length) playTrack(queue[0], queue);
  };
  return (
    <div className="flex flex-col gap-4 bg-gradient-to-b from-white/5 to-transparent p-6 pb-4">
      {canGoBack && (
        <button
          onClick={goBack}
          className="self-start flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Quay lại</span>
        </button>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
        <div className="grid h-36 w-36 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-neutral-800 shadow-2xl">
          {cover ? (
            <img src={convertFileSrc(cover)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : artist ? (
            <span className="text-5xl font-black text-apple-pink">{title.charAt(0).toUpperCase()}</span>
          ) : (
            <ListMusic className="w-12 h-12 text-neutral-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-apple-pink">{kind}</p>
          <h1 className="mt-1 truncate text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {subtitle} · {tracks.length} bài hát · {formatTime(totalDuration(tracks))}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => startPlayback()}
              className="inline-flex items-center gap-2 rounded-full bg-apple-pink px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-apple-pink/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Phát</span>
            </button>
            <button
              onClick={() => startPlayback(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Ngẫu nhiên</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MainContent: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    albums,
    tracks,
    selectedAlbum,
    setSelectedAlbum,
    selectedArtist,
    setSelectedArtist,
    selectedPlaylist,
    isLyricsOpen,
    isAudioQualityModalOpen,
    audioQualityModalTrack,
    audioQualityModalInitialStandardId,
    closeAudioQualityModal,
    isSettingsOpen,
    closeSettings,
    isLyricsSearchOpen,
    closeLyricsSearch,
    isBatchLyricsOpen,
    closeBatchLyrics,
    artistProfiles,
    isMvOpen,
    openMv,
    closeMv,
  } = usePlayer();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const { updateInfo, isUpdateModalOpen, setIsUpdateModalOpen } = useAppUpdater();

  const filteredArtistProfiles = useMemo(() => {
    if (!artistSearchQuery.trim()) return artistProfiles;
    const q = artistSearchQuery.toLowerCase().trim();
    return artistProfiles.filter((a) => a.name.toLowerCase().includes(q));
  }, [artistProfiles, artistSearchQuery]);

  // Global Context Menu State
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget | null>(null);

  // Global Edit Metadata Modal State
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    type: 'track' | 'album';
    data: Track | Album | null;
  }>({ isOpen: false, type: 'track', data: null });

  const handleSelectAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setViewMode('album-detail');
  };

  const handleSelectArtist = (artistName: string) => {
    setSelectedArtist(artistName);
    setViewMode('artist-detail');
  };

  const handleTrackContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    setContextMenuTarget({ x: e.clientX, y: e.clientY, type: 'track', data: track });
  };

  const handleAlbumContextMenu = (e: React.MouseEvent, album: Album) => {
    e.preventDefault();
    setContextMenuTarget({ x: e.clientX, y: e.clientY, type: 'album', data: album });
  };

  const openEditModal = (type: 'track' | 'album', data: any) => {
    setEditModal({ isOpen: true, type, data });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex flex-1 min-h-0">
        {/* Scrollable View Area with Top Navigation Control Header */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <NavigationHeader />
          <div className="flex-1 overflow-y-auto pb-24 min-w-0">
            <Suspense fallback={<ViewFallback />}>
          {viewMode === 'home' ? (
            <HomeView />
          ) : viewMode === 'discovery' ? (
            <MusicDiscoveryView />
          ) : viewMode === 'album-detail' && selectedAlbum ? (
            <AlbumDetail />
          ) : viewMode === 'artist-detail' && selectedArtist ? (
            (() => {
              const artistTracks = tracks.filter(t => isTrackByArtist(t, selectedArtist));
              const avatar = getRandomArtistCover(artistTracks);
              return (
                <>
                  <CollectionHeader
                    kind="Nghệ sĩ"
                    title={selectedArtist}
                    subtitle={`${artistTracks.length} bài hát trong thư viện (Bao gồm cả bài hát kết hợp & Feat)`}
                    tracks={artistTracks}
                    cover={avatar ? convertFileSrc(avatar) : undefined}
                    artist
                  />
                  <TrackList
                    tracks={artistTracks}
                    onOpenMvForTrack={(track) => openMv(track)}
                    onContextMenu={handleTrackContextMenu}
                  />
                </>
              );
            })()
          ) : viewMode === 'library-albums' ? (
            <div className="space-y-4">
              <h1 className="text-3xl font-extrabold text-white tracking-tight p-6 pb-0">Albums</h1>
              <AlbumGrid
                albums={albums}
                onSelectAlbum={handleSelectAlbum}
                onContextMenu={handleAlbumContextMenu}
              />
            </div>
          ) : viewMode === 'library-tracks' ? (
            <TrackList
              tracks={tracks}
              title="Tất Cả Bài Hát"
              onOpenMvForTrack={(track) => openMv(track)}
              onContextMenu={handleTrackContextMenu}
            />
          ) : viewMode === 'library-artists' ? (
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">Nghệ Sĩ</h1>
                  <p className="text-xs text-neutral-400 font-medium mt-1">
                    {artistSearchQuery ? `${filteredArtistProfiles.length} / ${artistProfiles.length}` : `${artistProfiles.length}`} nghệ sĩ (Tự động tách riêng các nghệ sĩ kết hợp & feat)
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={artistSearchQuery}
                    onChange={(e) => setArtistSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên nghệ sĩ..."
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-apple-pink/50 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                  />
                  {artistSearchQuery && (
                    <button
                      onClick={() => setArtistSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filteredArtistProfiles.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-neutral-500 space-y-2">
                  <Search className="w-10 h-10 opacity-30" />
                  <p className="text-xs font-medium">Không tìm thấy nghệ sĩ nào phù hợp với "{artistSearchQuery}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(125px,1fr))] gap-3 sm:gap-4.5">
                  {filteredArtistProfiles.map((artist) => (
                    <div
                      key={artist.name}
                      onClick={() => handleSelectArtist(artist.name)}
                      className="flex flex-col items-center text-center space-y-2.5 p-3.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group active:scale-95 border border-white/5 hover:border-white/15"
                    >
                      <div className="w-full max-w-[104px] aspect-square rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center text-2xl font-bold text-apple-pink border border-white/10 shadow-lg group-hover:scale-105 transition-all group-hover:border-apple-pink/40">
                        {artist.picture ? (
                          <img
                            src={convertFileSrc(artist.picture)}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{artist.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="w-full min-w-0 space-y-0.5">
                        <span className="text-sm font-semibold text-white truncate block w-full group-hover:text-apple-pink transition-colors">
                          {artist.name}
                        </span>
                        <span className="text-xs text-neutral-400 font-medium block">
                          {artist.trackCount} bài hát
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'analytics' ? (
            <AnalyticsView />
          ) : viewMode === 'playlist-detail' && selectedPlaylist ? (
            <>
              <CollectionHeader kind="Playlist" title={selectedPlaylist.name} subtitle="Playlist của bạn" tracks={tracks.filter(t => selectedPlaylist.trackIds.includes(t.id))} cover={selectedPlaylist.coverArt} />
              <TrackList tracks={tracks.filter(t => selectedPlaylist.trackIds.includes(t.id))} onOpenMvForTrack={(track) => openMv(track)} onContextMenu={handleTrackContextMenu} />
            </>
          ) : null}
        </Suspense>
          </div>
        </div>
        {isLyricsOpen && <LyricsPanel />}
      </div>

      {/* Global Context Menu */}
      <ContextMenu
        target={contextMenuTarget}
        onClose={() => setContextMenuTarget(null)}
        onOpenEditModal={openEditModal}
      />

      {/* Global Edit Metadata Modal */}
      {editModal.isOpen && (
        <EditMetadataModal
          type={editModal.type}
          data={editModal.data}
          onClose={() => setEditModal({ isOpen: false, type: 'track', data: null })}
        />
      )}

      {/* Audio Quality & Technology Standards Guide Modal */}
      <AudioQualityModal
        isOpen={isAudioQualityModalOpen}
        onClose={closeAudioQualityModal}
        track={audioQualityModalTrack}
        initialSelectedId={audioQualityModalInitialStandardId}
      />

      {/* Global Settings & Active Audio Scanner Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />

      {/* Auto-Update Notification Modal */}
      {updateInfo && (
        <UpdateNotificationModal
          updateInfo={updateInfo}
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />
      )}

      {/* Online Lyrics Search Modal (LRCLIB REST API) */}
      <LyricsSearchModal
        isOpen={isLyricsSearchOpen}
        onClose={closeLyricsSearch}
      />

      {/* Batch Lyrics Fetcher Modal for Album (with 1.8s safe rate limit delay) */}
      <BatchLyricsModal
        isOpen={isBatchLyricsOpen}
        onClose={closeBatchLyrics}
      />

      {/* MV Video Fullscreen / Window Overlay */}
      {isMvOpen && (
        <Suspense fallback={null}>
          <MvPlayerView onClose={() => closeMv()} />
        </Suspense>
      )}

      {/* Queue Drawer */}
      <QueueView isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />

      {/* Player Bar */}
      <PlayerBar
        isQueueOpen={isQueueOpen}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        onOpenMv={() => openMv()}
      />
    </div>
  );
};

const AppContent: React.FC = () => {
  console.log(">>> [FE STEP 2] App Component Rendered");
  const { isLoadingLibrary, setViewMode } = usePlayer();
  const [mobileTab, setMobileTab] = useState<"home" | "discovery" | "library" | "search" | "analytics">("home");

  const handleMobileTabChange = (tab: "home" | "discovery" | "library" | "search" | "analytics") => {
    setMobileTab(tab);
    if (tab === "home") setViewMode("home");
    else if (tab === "discovery") setViewMode("discovery");
    else if (tab === "library") setViewMode("library-tracks");
    else if (tab === "search") setViewMode("library-artists");
    else if (tab === "analytics") setViewMode("analytics");
  };

  if (isLoadingLibrary) {
    return (
      <div className="fixed inset-0 bg-[#0d0d0e] z-50 flex flex-col items-center justify-center space-y-6 select-none animate-in fade-in duration-300">
        {/* Glowing App Icon */}
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-neutral-900 border border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(250,36,60,0.4)] animate-pulse p-3">
            <img src="/logo.png" alt="App Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
          </div>
        </div>

        {/* Loading Text & Pulsing Bar */}
        <div className="flex flex-col items-center space-y-3">
          <h2 className="text-2xl font-black text-white tracking-tight">Flarity Music</h2>
          <p className="text-xs text-neutral-400 font-medium">Đang tải thư viện nhạc Local...</p>

          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-apple-pink rounded-full animate-[shimmer_1.5s_infinite] w-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, #FA243C 50%, transparent 100%)',
                backgroundSize: '200% 100%',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden select-none relative">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <MainContent />

      {/* Mobile Bottom Navigation Bar (Visible on Mobile) */}
      <div className="md:hidden">
        <BottomNavBar activeTab={mobileTab} setActiveTab={handleMobileTabChange} />
      </div>
    </div>
  );
};

export function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}

export default App;
