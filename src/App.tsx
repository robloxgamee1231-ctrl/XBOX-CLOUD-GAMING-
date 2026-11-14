import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Gamepad2,
  HardDrive,
  Link2,
  LogOut,
  Play,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Sliders,
  Sparkles,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { BrandMark, GamerscoreBadge } from './components/BrandMark';
import { ControllerTester } from './components/ControllerTester';
import { GameCard } from './components/GameCard';
import { GameDetailsModal } from './components/GameDetailsModal';
import { SignInScreen } from './components/SignInScreen';
import { StreamPlayer } from './components/StreamPlayer';
import { LANG_OPTIONS, t, type LangCode } from './i18n/translations';
import { getRelayUrl, psboxApi, setRelayUrl } from './services/psboxApi';
import type {
  AppSettings,
  CatalogProduct,
  HomeConsole,
  LibraryData,
  RegionInfo,
  ResolutionMode,
  SharpnessLevel,
  UserProfile,
} from './types';

type MainTab = 'gamepass' | 'yourgames' | 'consoles' | 'search' | 'settings';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  resolution: '1080p',
  regionName: '',
  loginCountry: '',
  sharpness: 'low',
  deband: true,
  deadzone: 0.08,
  triggerRumble: true,
  glyphStyle: 'playstation',
  wishlist: [],
  hidden: [],
  playtimeSecByProduct: {},
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('psbox_settings_v1');
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatCloudHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [booting, setBooting] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');

  const [tab, setTab] = useState<MainTab>('gamepass');
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [loadingLib, setLoadingLib] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);
  const [consoles, setConsoles] = useState<HomeConsole[]>([]);
  const [loadingConsoles, setLoadingConsoles] = useState(false);

  const [heroProduct, setHeroProduct] = useState<CatalogProduct | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<CatalogProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMkb, setFilterMkb] = useState(false);
  const [filterFree, setFilterFree] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [relayInput, setRelayInput] = useState(() => getRelayUrl());
  const [relaySaved, setRelaySaved] = useState(false);
  const [connectedPads, setConnectedPads] = useState(0);

  const [activeStream, setActiveStream] = useState<{
    title: string;
    targetId: string;
    productId?: string;
    isHome: boolean;
  } | null>(null);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('psbox_settings_v1', JSON.stringify(next));
      return next;
    });
  }, []);

  // Watch connected browser gamepads
  useEffect(() => {
    const syncPads = () => {
      const pads = navigator.getGamepads?.() ?? [];
      setConnectedPads(pads.filter(Boolean).length);
    };
    syncPads();
    window.addEventListener('gamepadconnected', syncPads);
    window.addEventListener('gamepaddisconnected', syncPads);
    const id = window.setInterval(syncPads, 1500);
    return () => {
      window.removeEventListener('gamepadconnected', syncPads);
      window.removeEventListener('gamepaddisconnected', syncPads);
      clearInterval(id);
    };
  }, []);

  // Check existing session on startup
  useEffect(() => {
    psboxApi
      .getSession()
      .then((d) => {
        if (d.signedIn && d.profile) {
          setSignedIn(true);
          setDemoMode(Boolean(d.demoMode));
          setProfile(d.profile);
          setRegions(d.regions ?? []);
          setSelectedRegion(d.selectedRegion ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  const loadLibrary = useCallback(async () => {
    if (!signedIn) return;
    setLoadingLib(true);
    setLibError(null);
    try {
      const locale = LANG_OPTIONS.find((l) => l.code === settings.language)?.locale ?? 'en-US';
      const data = await psboxApi.getLibrary(locale);
      setLibrary(data);
      if (data.products?.length > 0) {
        setHeroProduct((prev) => prev ?? data.products[0]);
      }
    } catch (err) {
      setLibError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingLib(false);
    }
  }, [signedIn, settings.language]);

  const loadConsoles = useCallback(async () => {
    if (!signedIn) return;
    setLoadingConsoles(true);
    try {
      const list = await psboxApi.getConsoles();
      setConsoles(list);
    } catch {
      // ignore
    } finally {
      setLoadingConsoles(false);
    }
  }, [signedIn]);

  useEffect(() => {
    if (signedIn) {
      loadLibrary();
      loadConsoles();
    }
  }, [signedIn, loadLibrary, loadConsoles]);

  const handleSignOut = async () => {
    await psboxApi.signOut().catch(() => {});
    setSignedIn(false);
    setDemoMode(false);
    setProfile(null);
    setLibrary(null);
    setConsoles([]);
    setHeroProduct(null);
    setTab('gamepass');
  };

  const productById = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const p of library?.products ?? []) map.set(p.productId, p);
    return map;
  }, [library]);

  const visibleProducts = useMemo(() => {
    const hiddenSet = new Set(settings.hidden);
    return (library?.products ?? []).filter((p) => !hiddenSet.has(p.productId));
  }, [library, settings.hidden]);

  const mapIds = useCallback(
    (ids: string[]) => {
      const hiddenSet = new Set(settings.hidden);
      return ids
        .filter((id) => !hiddenSet.has(id))
        .map((id) => productById.get(id))
        .filter((p): p is CatalogProduct => Boolean(p));
    },
    [productById, settings.hidden],
  );

  const recentGames = useMemo(() => mapIds(library?.recentIds ?? []), [library, mapIds]);
  const popularGames = useMemo(() => mapIds(library?.popularIds ?? []), [library, mapIds]);
  const addedGames = useMemo(() => mapIds(library?.recentlyAddedIds ?? []), [library, mapIds]);
  const freeGames = useMemo(() => mapIds(library?.freeToPlayIds ?? []), [library, mapIds]);
  const wishlistGames = useMemo(() => mapIds(settings.wishlist), [settings.wishlist, mapIds]);
  const ownedGames = useMemo(() => {
    const set = new Set([...(library?.ownedIds ?? []), ...(library?.freeToPlayIds ?? [])]);
    return visibleProducts.filter((p) => set.has(p.productId));
  }, [library, visibleProducts]);
  const hiddenGamesList = useMemo(
    () => settings.hidden.map((id) => productById.get(id)).filter((p): p is CatalogProduct => Boolean(p)),
    [settings.hidden, productById],
  );

  const availableGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visibleProducts) {
      for (const c of p.categories) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return ['All', ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7).map((e) => e[0])];
  }, [visibleProducts]);

  const filteredCatalog = useMemo(() => {
    if (selectedGenre === 'All') return visibleProducts;
    return visibleProducts.filter((p) => p.categories.includes(selectedGenre));
  }, [visibleProducts, selectedGenre]);

  const friendsPlaying = useMemo(() => {
    const entries: Array<{ product: CatalogProduct; gamertag: string; presenceText: string }> = [];
    for (const p of visibleProducts) {
      for (const f of p.friends ?? []) {
        entries.push({ product: p, gamertag: f.gamertag, presenceText: f.presenceText });
      }
    }
    return entries;
  }, [visibleProducts]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleProducts.filter((p) => {
      if (filterMkb && !p.mouseKeyboard) return false;
      if (filterFree && !p.isFreeToPlay) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.publisher.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [visibleProducts, searchQuery, filterMkb, filterFree]);

  const toggleWishlist = (productId: string) => {
    const exists = settings.wishlist.includes(productId);
    updateSettings({
      wishlist: exists
        ? settings.wishlist.filter((id) => id !== productId)
        : [productId, ...settings.wishlist],
    });
  };

  const toggleHidden = (productId: string) => {
    const exists = settings.hidden.includes(productId);
    updateSettings({
      hidden: exists ? settings.hidden.filter((id) => id !== productId) : [...settings.hidden, productId],
    });
  };

  const launchGame = (p: CatalogProduct) => {
    setDetailsProduct(null);
    setActiveStream({
      title: p.title,
      targetId: p.xcloudTitleId || p.productId,
      productId: p.productId,
      isHome: false,
    });
  };

  const launchConsole = (c: HomeConsole) => {
    setActiveStream({
      title: `${c.deviceName} (Remote Play)`,
      targetId: c.serverId,
      isHome: true,
    });
  };

  if (booting) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0b0e14]"
        style={{
          backgroundImage: `linear-gradient(rgba(8,12,10,0.85), rgba(8,12,10,0.92)), url('./assets/pic1.png')`,
          backgroundSize: 'cover',
        }}
      >
        <BrandMark size={76} />
        <h1 className="text-2xl font-bold text-white">{t(settings.language, 'appName')}</h1>
        <RefreshCw className="w-6 h-6 text-emerald-400 psbox-spinner" />
      </div>
    );
  }

  if (!signedIn || !profile) {
    return (
      <SignInScreen
        lang={settings.language}
        loginCountry={settings.loginCountry}
        onChangeCountry={(country) => updateSettings({ loginCountry: country })}
        onSignedIn={({ demoMode: dm, profile: prof, regions: regs, selectedRegion: sel }) => {
          setDemoMode(dm);
          setProfile(prof);
          setRegions(regs);
          setSelectedRegion(sel);
          setSignedIn(true);
        }}
      />
    );
  }

  const featured = heroProduct ?? popularGames[0] ?? visibleProducts[0] ?? null;

  const renderRow = (rowTitle: string, items: CatalogProduct[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-white tracking-tight">{rowTitle}</h3>
          <span className="text-xs font-semibold text-[#7b8494]">{items.length}</span>
        </div>
        <div className="psbox-row-scroll">
          {items.map((item) => (
            <GameCard
              key={item.productId}
              product={item}
              selected={heroProduct?.productId === item.productId}
              wishlisted={settings.wishlist.includes(item.productId)}
              playtimeSec={settings.playtimeSecByProduct[item.productId] ?? 0}
              onFocus={() => setHeroProduct(item)}
              onClick={() => setDetailsProduct(item)}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen psbox-shell-bg text-white flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0c0e10]/80 border-b border-white/10">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Brand + Monthly Cloud Playtime */}
          <div className="flex items-center gap-3.5">
            <BrandMark size={40} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  {t(settings.language, 'cloudGaming')}
                </span>
                {demoMode && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold uppercase">
                    Demo Mode
                  </span>
                )}
              </div>
              {profile.playtimeUnlimited ? (
                <div className="flex items-center gap-1 text-[11px] text-[#9aa4b8]">
                  <Clock className="w-3 h-3" />
                  {t(settings.language, 'cloudTimeUnlimited')}
                </div>
              ) : profile.playtimeRemainingSec >= 0 ? (
                <div className="space-y-1 mt-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#b4bcc8]">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>
                      <strong className="text-white">{formatCloudHours(profile.playtimeRemainingSec)}</strong>{' '}
                      {t(settings.language, 'cloudTimeLeft')}
                      {profile.playtimeMaxSec > 0 ? ` (${formatCloudHours(profile.playtimeMaxSec)})` : ''}
                    </span>
                  </div>
                  {profile.playtimeMaxSec > 0 && (
                    <div className="w-36 h-1 rounded-full bg-white/15 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.min(100, (profile.playtimeRemainingSec / profile.playtimeMaxSec) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Center: Navigation Pills (Desktop/Tablet) */}
          <nav className="hidden sm:flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/10">
            {(
              [
                ['gamepass', t(settings.language, 'tabGamePass')],
                ['yourgames', t(settings.language, 'tabYourGames')],
                ['consoles', t(settings.language, 'tabConsoles')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  tab === key ? 'bg-white text-[#0c0e10] shadow' : 'text-[#b4bcc8] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                tab === 'search' ? 'bg-white text-[#0c0e10]' : 'text-[#b4bcc8] hover:text-white'
              }`}
              title={t(settings.language, 'tabSearch')}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                tab === 'settings' ? 'bg-white text-[#0c0e10]' : 'text-[#b4bcc8] hover:text-white'
              }`}
              title={t(settings.language, 'settings')}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </nav>

          {/* Right: Pad indicator + Xbox Profile */}
          <div className="flex items-center gap-3">
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                connectedPads > 0
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-[#9aa4b8]'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              {connectedPads > 0 ? `${connectedPads} Pad Ready` : 'Keyboard / Touch'}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-white leading-tight">{profile.gamertag}</div>
                <div className="flex items-center justify-end gap-2 text-[11px] text-[#b4bcc8] mt-0.5">
                  {profile.gamerscore && (
                    <span className="inline-flex items-center gap-1">
                      <GamerscoreBadge size={12} />
                      {Number(profile.gamerscore).toLocaleString()}
                    </span>
                  )}
                  <span className="px-1.5 py-0.2 rounded border border-white/25 text-[10px] font-bold uppercase">
                    {profile.subscription || 'FREE'}
                  </span>
                </div>
              </div>
              <img
                src={profile.gamerpicUrl || './assets/icon0.png'}
                alt={profile.gamertag}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-white/20 bg-[#1b2028]"
              />
              <button
                type="button"
                onClick={handleSignOut}
                className="p-2 rounded-full bg-white/5 hover:bg-rose-500/20 border border-white/10 text-[#b4bcc8] hover:text-rose-200 cursor-pointer"
                title={demoMode ? 'Sign in with Microsoft / Switch Account' : t(settings.language, 'signOut')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1480px] w-full mx-auto px-4 sm:px-8 pb-24 sm:pb-16">
        {/* GAME PASS TAB */}
        {tab === 'gamepass' && (
          <div className="space-y-8 pt-4 sm:pt-6">
            {featured && (
              <section className="relative rounded-3xl overflow-hidden border border-white/10 min-h-[300px] sm:min-h-[400px] flex items-end shadow-2xl">
                <img
                  src={featured.heroUrl || featured.posterUrl || featured.tileUrl}
                  alt={featured.title}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c0e10] via-[#0c0e10]/75 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e10] via-transparent to-black/30" />

                <div className="relative z-10 p-5 sm:p-10 max-w-2xl space-y-3 sm:space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#107c10] text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      CLOUD PLAYABLE
                    </span>
                    {featured.platform && (
                      <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold">
                        {featured.platform}
                      </span>
                    )}
                    {featured.ratingAge && (
                      <span className="px-2.5 py-1 rounded-full border border-white/25 text-xs font-semibold">
                        {featured.ratingSystem ? `${featured.ratingSystem} ` : ''}
                        {featured.ratingAge}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-5xl font-bold text-white tracking-tight">
                    {featured.title}
                  </h2>
                  {featured.description && (
                    <p className="text-xs sm:text-base text-[#cbd5e1] line-clamp-2">
                      {featured.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => launchGame(featured)}
                      className="psbox-btn psbox-btn-primary px-6 sm:px-7 py-2.5 sm:py-3 text-sm sm:text-base"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      {t(settings.language, 'play')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsProduct(featured)}
                      className="psbox-btn text-sm"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Genre Quick Filter Strip */}
            {availableGenres.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {availableGenres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 border transition-all cursor-pointer ${
                      selectedGenre === genre
                        ? 'bg-[#107c10] border-emerald-400 text-white shadow'
                        : 'bg-white/5 border-white/10 text-[#b4bcc8] hover:text-white'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}

            {/* Friends Online Quick Strip */}
            {friendsPlaying.length > 0 && selectedGenre === 'All' && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base font-bold text-white tracking-tight">Friends Playing Now</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {friendsPlaying.map((fp) => (
                    <button
                      key={`${fp.gamertag}-${fp.product.productId}`}
                      type="button"
                      onClick={() => setDetailsProduct(fp.product)}
                      className="flex items-center gap-3 bg-[#15191e] hover:bg-[#1b212a] border border-white/10 rounded-2xl px-3.5 py-2.5 shrink-0 text-left transition-all cursor-pointer"
                    >
                      <div className="relative">
                        <img
                          src={fp.product.tileUrl}
                          alt={fp.product.title}
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#15191e]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{fp.gamertag}</div>
                        <div className="text-[11px] text-[#9aa4b8] max-w-[180px] truncate">
                          {fp.presenceText || fp.product.title}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {loadingLib && !library && (
              <div className="py-16 flex items-center justify-center gap-3 text-[#b4bcc8]">
                <RefreshCw className="w-5 h-5 text-emerald-400 psbox-spinner" />
                Loading Xbox Cloud Gaming catalog...
              </div>
            )}

            {libError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-400/30 text-sm text-rose-200 flex items-center justify-between">
                <span>{libError}</span>
                <button type="button" onClick={loadLibrary} className="psbox-btn text-xs">
                  Retry
                </button>
              </div>
            )}

            {selectedGenre === 'All' ? (
              <>
                {renderRow(t(settings.language, 'jumpBackIn'), recentGames)}
                {renderRow(t(settings.language, 'wishlist'), wishlistGames)}
                {renderRow(t(settings.language, 'mostPopular'), popularGames)}
                {renderRow(t(settings.language, 'recentlyAdded'), addedGames)}
                {renderRow(t(settings.language, 'freeToPlay'), freeGames)}
                {renderRow(t(settings.language, 'allGames'), visibleProducts)}
              </>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{selectedGenre}</h3>
                  <span className="text-xs text-[#9aa4b8]">{filteredCatalog.length} titles</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                  {filteredCatalog.map((g) => (
                    <GameCard
                      key={g.productId}
                      product={g}
                      size="compact"
                      wishlisted={settings.wishlist.includes(g.productId)}
                      playtimeSec={settings.playtimeSecByProduct[g.productId] ?? 0}
                      onFocus={() => setHeroProduct(g)}
                      onClick={() => setDetailsProduct(g)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* MY GAMES TAB */}
        {tab === 'yourgames' && (
          <div className="pt-8 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t(settings.language, 'tabYourGames')}</h2>
              <span className="text-xs text-[#9aa4b8]">{ownedGames.length} games</span>
            </div>

            {ownedGames.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {ownedGames.map((g) => (
                  <GameCard
                    key={g.productId}
                    product={g}
                    size="compact"
                    wishlisted={settings.wishlist.includes(g.productId)}
                    playtimeSec={settings.playtimeSecByProduct[g.productId] ?? 0}
                    onClick={() => setDetailsProduct(g)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-[#15191e] border border-white/10 rounded-3xl p-10 text-center text-[#9aa4b8]">
                No owned or free-to-play titles found yet.
              </div>
            )}

            {hiddenGamesList.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-white/10">
                <h3 className="text-lg font-bold text-[#b4bcc8]">{t(settings.language, 'hiddenGames')}</h3>
                <div className="flex flex-wrap gap-4">
                  {hiddenGamesList.map((g) => (
                    <GameCard
                      key={g.productId}
                      product={g}
                      size="compact"
                      onClick={() => setDetailsProduct(g)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* MY CONSOLES (REMOTE PLAY) TAB */}
        {tab === 'consoles' && (
          <div className="pt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{t(settings.language, 'tabConsoles')}</h2>
                <p className="text-sm text-[#9aa4b8] mt-1">{t(settings.language, 'consolesHint')}</p>
              </div>
              <button type="button" onClick={loadConsoles} className="psbox-btn text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingConsoles ? 'psbox-spinner' : ''}`} />
                Refresh
              </button>
            </div>

            {consoles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {consoles.map((c) => (
                  <div
                    key={c.serverId}
                    className="bg-[#15191e] border border-white/10 rounded-3xl p-6 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#107c10]/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Tv className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white">{c.deviceName}</h3>
                        <div className="flex items-center gap-2 text-xs text-[#9aa4b8] mt-0.5">
                          <span>{c.consoleType}</span>
                          <span>•</span>
                          <span
                            className={
                              c.powerState === 'On'
                                ? 'text-emerald-400 font-semibold'
                                : c.powerState === 'ConnectedStandby'
                                  ? 'text-sky-400 font-semibold'
                                  : 'text-amber-400'
                            }
                          >
                            {c.powerState === 'ConnectedStandby' ? 'Sleeping (Ready to Wake)' : c.powerState}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => launchConsole(c)}
                      className="psbox-btn psbox-btn-primary text-sm shrink-0"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      {t(settings.language, 'streamConsole')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#15191e] border border-white/10 rounded-3xl p-8 space-y-4 max-w-2xl">
                <div className="flex items-center gap-3 text-lg font-bold">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  {t(settings.language, 'noConsoles')}
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm text-[#b4bcc8]">
                  <li>On your Xbox, sign in with this same Microsoft account.</li>
                  <li>Go to Settings &gt; Devices &amp; connections &gt; Remote features and enable Remote features.</li>
                  <li>Set Power options to Sleep so your console can wake automatically.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="pt-8 space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-[#9aa4b8] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(settings.language, 'searchPlaceholder')}
                  className="w-full bg-[#15191e] border border-white/15 focus:border-emerald-500 rounded-2xl pl-12 pr-10 py-3.5 text-white outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa4b8] hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMkb((v) => !v)}
                  className={`psbox-btn text-xs ${filterMkb ? 'psbox-btn-primary' : ''}`}
                >
                  Mouse &amp; Keyboard
                </button>
                <button
                  type="button"
                  onClick={() => setFilterFree((v) => !v)}
                  className={`psbox-btn text-xs ${filterFree ? 'psbox-btn-primary' : ''}`}
                >
                  Free to Play
                </button>
              </div>
            </div>

            <div className="text-xs text-[#9aa4b8]">{searchResults.length} results</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {searchResults.map((g) => (
                <GameCard
                  key={g.productId}
                  product={g}
                  size="compact"
                  wishlisted={settings.wishlist.includes(g.productId)}
                  playtimeSec={settings.playtimeSecByProduct[g.productId] ?? 0}
                  onClick={() => setDetailsProduct(g)}
                />
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div className="pt-8 max-w-4xl space-y-6">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-bold">{t(settings.language, 'settings')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[#15191e] border border-white/10 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9aa4b8] uppercase mb-1.5">
                    {t(settings.language, 'language')}
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value as LangCode })}
                    className="w-full bg-[#0d1117] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {LANG_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9aa4b8] uppercase mb-1.5">
                    {t(settings.language, 'resolution')}
                  </label>
                  <select
                    value={settings.resolution}
                    onChange={(e) => updateSettings({ resolution: e.target.value as ResolutionMode })}
                    className="w-full bg-[#0d1117] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="720p">720p (Android profile, lower data)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="1080pHQ">1080p HQ (Tizen 4K high bitrate)</option>
                    <option value="1440p">1440p (Edge QHD, Ultimate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9aa4b8] uppercase mb-1.5">
                    {t(settings.language, 'sharpness')}
                  </label>
                  <select
                    value={settings.sharpness}
                    onChange={(e) => updateSettings({ sharpness: e.target.value as SharpnessLevel })}
                    className="w-full bg-[#0d1117] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="off">Off</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#15191e] border border-white/10 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#9aa4b8] uppercase mb-1.5">
                    {t(settings.language, 'region')}
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setSelectedRegion(val);
                      await psboxApi.updateRegion(val).catch(() => {});
                    }}
                    className="w-full bg-[#0d1117] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    {regions.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} {r.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#9aa4b8] uppercase mb-1.5">
                    {t(settings.language, 'countryBypass')}
                  </label>
                  <select
                    value={settings.loginCountry}
                    onChange={async (e) => {
                      const val = e.target.value;
                      updateSettings({ loginCountry: val });
                      await psboxApi.updateRegion(undefined, val).catch(() => {});
                    }}
                    className="w-full bg-[#0d1117] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">None</option>
                    <option value="us">United States (US)</option>
                    <option value="br">Brazil (BR)</option>
                    <option value="jp">Japan (JP)</option>
                    <option value="kr">South Korea (KR)</option>
                    <option value="pl">Poland (PL)</option>
                  </select>
                </div>

                <label className="flex items-center justify-between pt-2 text-sm">
                  <span>Controller Rumble / Vibration</span>
                  <input
                    type="checkbox"
                    checked={settings.triggerRumble}
                    onChange={(e) => updateSettings({ triggerRumble: e.target.checked })}
                    className="w-4 h-4 accent-[#107c10]"
                  />
                </label>
              </div>
            </div>

            <div className="bg-[#15191e] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  Microsoft Account Relay (GitHub Pages)
                </div>
                {demoMode && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="psbox-btn psbox-btn-primary text-xs"
                  >
                    Switch to Microsoft Sign-In
                  </button>
                )}
              </div>
              <p className="text-xs text-[#9aa4b8] leading-relaxed">
                Configure your Cloudflare Worker CORS Relay URL (from <code>cloudflare-worker/worker.js</code>) to
                use real Microsoft Sign-In and live Xbox Cloud Gaming directly from GitHub Pages.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setRelayUrl(relayInput);
                  setRelaySaved(true);
                  setTimeout(() => setRelaySaved(false), 2000);
                }}
                className="flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="url"
                  value={relayInput}
                  onChange={(e) => setRelayInput(e.target.value)}
                  placeholder="https://psbox-relay.your-name.workers.dev"
                  className="flex-1 bg-[#0d1117] border border-white/15 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
                <button type="submit" className="psbox-btn text-xs shrink-0">
                  {relaySaved ? 'Saved!' : 'Save Relay URL'}
                </button>
              </form>
            </div>

            <ControllerTester
              deadzone={settings.deadzone}
              onDeadzoneChange={(dz) => updateSettings({ deadzone: dz })}
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Dock */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0d1116]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 flex items-center justify-around"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {(
          [
            ['gamepass', 'Game Pass', Sparkles],
            ['yourgames', 'My Games', Gamepad2],
            ['consoles', 'Consoles', Tv],
            ['search', 'Search', Search],
            ['settings', 'Settings', SettingsIcon],
          ] as const
        ).map(([key, label, Icon]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
                active ? 'text-emerald-400' : 'text-[#9aa4b8]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Details Modal */}
      {detailsProduct && (
        <GameDetailsModal
          lang={settings.language}
          product={detailsProduct}
          wishlisted={settings.wishlist.includes(detailsProduct.productId)}
          hidden={settings.hidden.includes(detailsProduct.productId)}
          onToggleWishlist={() => toggleWishlist(detailsProduct.productId)}
          onToggleHidden={() => {
            toggleHidden(detailsProduct.productId);
            setDetailsProduct(null);
          }}
          onPlay={() => launchGame(detailsProduct)}
          onClose={() => setDetailsProduct(null)}
        />
      )}

      {/* Fullscreen Stream Player */}
      {activeStream && (
        <StreamPlayer
          title={activeStream.title}
          targetId={activeStream.targetId}
          isHome={activeStream.isHome}
          demoMode={demoMode}
          regionName={selectedRegion}
          settings={settings}
          onUpdateSettings={updateSettings}
          onExit={(elapsedSec) => {
            if (activeStream.productId && elapsedSec > 3) {
              const prev = settings.playtimeSecByProduct[activeStream.productId] ?? 0;
              updateSettings({
                playtimeSecByProduct: {
                  ...settings.playtimeSecByProduct,
                  [activeStream.productId]: prev + elapsedSec,
                },
              });
            }
            setActiveStream(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
