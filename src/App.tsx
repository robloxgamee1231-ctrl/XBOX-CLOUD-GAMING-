import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bug,
  Clock,
  Gamepad2,
  HardDrive,
  Heart,
  Link2,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tv,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { BrandMark, GamerscoreBadge } from './components/BrandMark';
import {
  ControllerToolsModal,
  InfoQrModal,
  NetworkTestModal,
  SignInCheckModal,
} from './components/DiagnosticsModals';
import { GameCard } from './components/GameCard';
import { GameDetailsModal } from './components/GameDetailsModal';
import { ButtonGlyph, XboxChassisArtwork } from './components/PlayStationGlyphs';
import { SignInScreen } from './components/SignInScreen';
import { StreamPlayer } from './components/StreamPlayer';
import { DEFAULT_APP_SETTINGS, loadStoredSettings } from './data/psboxDefaults';
import { LANG_OPTIONS, t, type LangCode } from './i18n/translations';
import { getRelayUrl, psboxApi, setRelayUrl } from './services/psboxApi';
import type {
  AppSettings,
  CatalogProduct,
  DebandLevel,
  GlyphStyle,
  HomeConsole,
  LibraryData,
  PerGameProfile,
  RegionInfo,
  ResolutionMode,
  SharpnessLevel,
  UpscalerMode,
  UserProfile,
} from './types';

type MainTab = 'gamepass' | 'yourgames' | 'consoles' | 'search' | 'settings';

const SEARCH_ACRONYMS: Record<string, string> = {
  cod: 'call of duty',
  mw: 'modern warfare',
  bo: 'black ops',
  bo6: 'black ops 6',
  gta: 'grand theft auto',
  rdr: 'red dead',
  re: 'resident evil',
  ac: 'assassin',
  gow: 'gears of war',
  nfs: 'need for speed',
  bf: 'battlefield',
  mk: 'mortal kombat',
  fh: 'forza horizon',
};

function formatCloudHours(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(loadStoredSettings);
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
  const [filterTouch, setFilterTouch] = useState(false);
  const [filterFree, setFilterFree] = useState(false);
  const [filterWishlist, setFilterWishlist] = useState(false);
  const [filterConsole, setFilterConsole] = useState<'all' | 'XSX' | 'XB1'>('all');
  const [filterPlan, setFilterPlan] = useState<number>(0); // 0 = All, 1 = Essential, 2 = Premium, 3 = Ultimate
  const [librarySort, setLibrarySort] = useState<'recent' | 'az' | 'console'>('recent');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [relayInput, setRelayInput] = useState(() => getRelayUrl());
  const [relaySaved, setRelaySaved] = useState(false);
  const [connectedPads, setConnectedPads] = useState(0);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [signInCheckOpen, setSignInCheckOpen] = useState(false);
  const [networkTestOpen, setNetworkTestOpen] = useState(false);
  const [controllerModalTab, setControllerModalTab] = useState<
    'sticks' | 'triggers' | 'gyro' | 'pad' | 'keys' | 'lightbar' | null
  >(null);
  const [infoQrMode, setInfoQrMode] = useState<'report' | 'support' | 'whatsnew' | null>(null);

  const [activeStream, setActiveStream] = useState<{
    title: string;
    heroUrl?: string;
    targetId: string;
    productId?: string;
    isHome: boolean;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2400);
  }, []);

  // Q / E shoulder-style tab switching (matching PSBox keyboard shortcuts)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!signedIn || detailsProduct || activeStream) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const order: MainTab[] = ['gamepass', 'yourgames', 'consoles'];
      const idx = order.indexOf(tab);
      if (e.code === 'KeyQ' && idx > 0) setTab(order[idx - 1]);
      else if (e.code === 'KeyE' && idx >= 0 && idx < order.length - 1) setTab(order[idx + 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signedIn, tab, detailsProduct, activeStream]);

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

  const favoriteGames = useMemo(
    () =>
      settings.favorites
        .map((id) => visibleProducts.find((p) => p.productId === id))
        .filter((p): p is CatalogProduct => Boolean(p)),
    [visibleProducts, settings.favorites]
  );

  const searchResults = useMemo(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    const expandedQ = SEARCH_ACRONYMS[rawQ] ?? rawQ;
    return visibleProducts.filter((p) => {
      if (filterMkb && !p.mouseKeyboard) return false;
      if (filterTouch && !p.touch) return false;
      if (filterFree && !p.isFreeToPlay) return false;
      if (filterWishlist && !settings.wishlist.includes(p.productId)) return false;
      if (filterConsole !== 'all' && p.platform !== filterConsole) return false;
      if (filterPlan > 0 && p.plan > filterPlan) return false;
      if (selectedGenre !== 'All' && !p.categories.includes(selectedGenre)) return false;
      if (!rawQ) return true;
      const tLower = p.title.toLowerCase();
      return (
        tLower.includes(rawQ) ||
        tLower.includes(expandedQ) ||
        p.publisher.toLowerCase().includes(rawQ) ||
        p.categories.some((c) => c.toLowerCase().includes(rawQ))
      );
    });
  }, [
    visibleProducts,
    searchQuery,
    filterMkb,
    filterTouch,
    filterFree,
    filterWishlist,
    filterConsole,
    filterPlan,
    selectedGenre,
    settings.wishlist,
  ]);

  const sortedOwnedGames = useMemo(() => {
    const list = [...ownedGames];
    if (librarySort === 'az') return list.sort((a, b) => a.title.localeCompare(b.title));
    if (librarySort === 'console') return list.sort((a, b) => (a.platform || '').localeCompare(b.platform || ''));
    return list;
  }, [ownedGames, librarySort]);

  const toggleWishlist = (productId: string) => {
    const exists = settings.wishlist.includes(productId);
    updateSettings({
      wishlist: exists
        ? settings.wishlist.filter((id) => id !== productId)
        : [productId, ...settings.wishlist],
    });
    showToast(exists ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const toggleFavorite = (productId: string) => {
    const exists = settings.favorites.includes(productId);
    updateSettings({
      favorites: exists
        ? settings.favorites.filter((id) => id !== productId)
        : [productId, ...settings.favorites],
    });
    showToast(exists ? 'Removed from favourites' : 'Added to favourites');
  };

  const toggleHidden = (productId: string) => {
    const exists = settings.hidden.includes(productId);
    updateSettings({
      hidden: exists ? settings.hidden.filter((id) => id !== productId) : [...settings.hidden, productId],
    });
    showToast(exists ? 'Shown again' : 'Hidden: find it under Hidden, at the end of Your games');
  };

  const saveGameProfile = (productId: string, prof: PerGameProfile | null) => {
    const next = { ...settings.perGameSettings };
    if (prof) next[productId] = prof;
    else delete next[productId];
    updateSettings({ perGameSettings: next });
    showToast(prof ? 'Game settings saved' : 'Game settings reset to default');
  };

  const launchGame = (p: CatalogProduct) => {
    setDetailsProduct(null);
    setActiveStream({
      title: p.title,
      heroUrl: p.heroUrl || p.posterUrl || p.tileUrl,
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
  const glyphStyle = settings.glyphStyle ?? 'playstation';
  const subRaw = (profile.subscription || 'FREE').toUpperCase();
  const isFreeTier = subRaw === 'FREE';

  const renderRow = (rowTitle: string, items: CatalogProduct[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-semibold text-white tracking-tight">{rowTitle}</h3>
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
    <div className="min-h-screen psbox-shell-bg text-white flex flex-col relative overflow-x-hidden">
      {/* Full-bleed Hero Backdrop on Game Pass tab matching PSBox drawHeroBg */}
      {tab === 'gamepass' && featured && (
        <div className="pointer-events-none fixed inset-x-0 top-0 h-[560px] z-0 overflow-hidden">
          <img
            src={featured.heroUrl || featured.posterUrl || featured.tileUrl}
            alt=""
            className="w-full h-full object-cover object-top opacity-75 transition-opacity duration-500"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(14,14,14,0.96) 0%, rgba(14,14,14,0.72) 48%, rgba(14,14,14,0.22) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(14,14,14,0.65) 0%, rgba(14,14,14,0.08) 38%, rgba(14,14,14,0.88) 82%, #0e0e0e 100%)',
            }}
          />
        </div>
      )}

      {/* Top Bar matching PSBox drawTopBar + drawTabs */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#0e0e0e]/95 via-[#0e0e0e]/75 to-transparent backdrop-blur-md">
        <div className="max-w-[1560px] mx-auto px-4 sm:px-10 py-3.5 flex items-center justify-between gap-4">
          {/* Left: Brand + Cloud Playtime */}
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size={38} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] tracking-tight text-white truncate">
                  {t(settings.language, 'cloudGaming')}
                </span>
                {demoMode && (
                  <span className="px-2 py-0.5 rounded bg-[#242424] border border-white/20 text-[#bebebe] text-[10px] font-bold uppercase tracking-wider shrink-0">
                    Demo
                  </span>
                )}
              </div>
              {profile.playtimeUnlimited ? (
                <div className="flex items-center gap-1.5 text-[11px] text-[#bebebe]">
                  <Clock className="w-3 h-3 text-[#8c8c8c]" />
                  <span>{t(settings.language, 'cloudTimeUnlimited')}</span>
                </div>
              ) : profile.playtimeRemainingSec >= 0 ? (
                <div className="space-y-1 mt-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#bebebe]">
                    <Clock className="w-3 h-3 text-[#8c8c8c]" />
                    <span>
                      <strong className="text-white font-semibold">
                        {formatCloudHours(profile.playtimeRemainingSec)}
                      </strong>{' '}
                      {t(settings.language, 'cloudTimeLeft')}
                      {profile.playtimeMaxSec > 0 ? ` of ${formatCloudHours(profile.playtimeMaxSec)}` : ''}
                    </span>
                  </div>
                  {profile.playtimeMaxSec > 0 && (
                    <div className="w-32 h-1 rounded-full bg-white/15 overflow-hidden">
                      <div
                        className="h-full bg-[#107c10] rounded-full"
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

          {/* Center: L1 | Tabs | R1 + Search / Settings */}
          <nav className="hidden lg:flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-bold text-[#bebebe]">
              {glyphStyle === 'xbox' ? 'LB' : 'L1'}
            </span>
            <div className="flex items-center gap-1">
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
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                    tab === key ? 'bg-white text-[#0e0e0e] shadow' : 'text-[#bebebe] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="px-2 py-0.5 rounded-md bg-white/15 text-[11px] font-bold text-[#bebebe]">
              {glyphStyle === 'xbox' ? 'RB' : 'R1'}
            </span>

            <div className="w-px h-5 bg-white/15 mx-1" />

            <button
              type="button"
              onClick={() => setTab('search')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                tab === 'search' ? 'bg-white text-[#0e0e0e]' : 'bg-[#242424]/85 text-[#bebebe] hover:text-white'
              }`}
              title={t(settings.language, 'tabSearch')}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{t(settings.language, 'tabSearch')}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                tab === 'settings' ? 'bg-white text-[#0e0e0e]' : 'bg-[#242424]/85 text-[#bebebe] hover:text-white'
              }`}
              title={t(settings.language, 'settings')}
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </nav>

          {/* Compact tablet nav (md only) */}
          <nav className="hidden sm:flex lg:hidden items-center gap-1 bg-[#242424]/85 p-1 rounded-full">
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
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  tab === key ? 'bg-white text-[#0e0e0e]' : 'text-[#bebebe] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`p-1.5 rounded-full cursor-pointer ${
                tab === 'search' ? 'bg-white text-[#0e0e0e]' : 'text-[#bebebe]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`p-1.5 rounded-full cursor-pointer ${
                tab === 'settings' ? 'bg-white text-[#0e0e0e]' : 'text-[#bebebe]'
              }`}
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
          </nav>

          {/* Right: Gamertag + Gamerscore G + GAME PASS [TIER] + Avatar */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="text-[15px] font-semibold text-white leading-tight">{profile.gamertag}</div>
              <div className="flex items-center justify-end gap-2.5 text-xs text-[#bebebe] mt-0.5">
                {profile.gamerscore && (
                  <span className="inline-flex items-center gap-1 font-semibold text-white">
                    <GamerscoreBadge size={13} />
                    {Number(profile.gamerscore).toLocaleString()}
                  </span>
                )}
                {isFreeTier ? (
                  <span className="px-1.5 py-0.5 rounded border border-white/45 text-[10px] font-bold tracking-wide text-white">
                    FREE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide">
                    <span className="text-white">GAME PASS</span>
                    <span className="px-1.5 py-0.5 rounded border border-white/50 text-white">{subRaw}</span>
                  </span>
                )}
              </div>
            </div>
            <img
              src={profile.gamerpicUrl || './assets/icon0.png'}
              alt={profile.gamertag}
              className="w-10 h-10 rounded-full object-cover border border-white/25 bg-[#242424]"
            />
            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-full bg-[#242424]/85 hover:bg-rose-500/20 text-[#bebebe] hover:text-rose-200 transition-colors cursor-pointer"
              title={demoMode ? 'Sign in with Microsoft / Switch Account' : t(settings.language, 'signOut')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-10 pb-24 sm:pb-16">
        {/* GAME PASS TAB */}
        {tab === 'gamepass' && (
          <div className="space-y-8 pt-2 sm:pt-4">
            {/* Hero Title & Metadata over the full-bleed backdrop */}
            {featured && (
              <section className="pt-4 sm:pt-10 pb-2 max-w-3xl space-y-3">
                <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
                  {featured.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#bebebe]">
                  {featured.publisher && <span>{featured.publisher}</span>}
                  {featured.categories.slice(0, 2).map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-2">
                      <span className="text-[#8c8c8c]">•</span>
                      <span>{cat}</span>
                    </span>
                  ))}
                  {featured.platform && (
                    <span className="ml-1 px-2 py-0.5 rounded bg-black/50 text-[11px] font-bold text-white">
                      {featured.platform}
                    </span>
                  )}
                </div>
                {featured.description && (
                  <p className="text-sm sm:text-base text-[#bebebe] line-clamp-2 max-w-2xl leading-relaxed">
                    {featured.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => launchGame(featured)}
                    className="psbox-btn psbox-btn-primary text-sm"
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
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                      selectedGenre === genre
                        ? 'bg-[#107c10] text-white'
                        : 'bg-[#242424] text-[#bebebe] hover:text-white'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}

            {/* Friends Playing Quick Strip */}
            {friendsPlaying.length > 0 && selectedGenre === 'All' && (
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Users className="w-4 h-4 text-[#107c10]" />
                  <h3 className="text-base font-semibold text-white tracking-tight">Friends Playing Now</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {friendsPlaying.map((fp) => (
                    <button
                      key={`${fp.gamertag}-${fp.product.productId}`}
                      type="button"
                      onClick={() => setDetailsProduct(fp.product)}
                      className="flex items-center gap-3 bg-[#242424]/90 hover:bg-[#2c2c2c] rounded-xl px-3.5 py-2.5 shrink-0 text-left transition-all cursor-pointer"
                    >
                      <div className="relative">
                        <img
                          src={fp.product.tileUrl}
                          alt={fp.product.title}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#107c10] border-2 border-[#242424]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{fp.gamertag}</div>
                        <div className="text-[11px] text-[#bebebe] max-w-[180px] truncate">
                          {fp.presenceText || fp.product.title}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {loadingLib && !library && (
              <div className="py-16 flex items-center justify-center gap-3 text-[#bebebe]">
                <RefreshCw className="w-5 h-5 text-white psbox-spinner" />
                Loading Xbox Cloud Gaming catalog...
              </div>
            )}

            {libError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-400/30 text-sm text-rose-200 flex items-center justify-between">
                <span>{libError}</span>
                <button type="button" onClick={loadLibrary} className="psbox-btn text-xs">
                  Retry
                </button>
              </div>
            )}

            {selectedGenre === 'All' ? (
              <div className="space-y-7">
                {renderRow(t(settings.language, 'jumpBackIn'), recentGames)}
                {renderRow('Favourites', favoriteGames)}
                {renderRow(t(settings.language, 'wishlist'), wishlistGames)}
                {renderRow(t(settings.language, 'mostPopular'), popularGames)}
                {renderRow(t(settings.language, 'recentlyAdded'), addedGames)}
                {renderRow(t(settings.language, 'freeToPlay'), freeGames)}
                {renderRow(t(settings.language, 'allGames'), visibleProducts)}
              </div>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{selectedGenre}</h3>
                  <span className="text-xs text-[#8c8c8c]">{filteredCatalog.length} titles</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
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

        {/* YOUR GAMES TAB */}
        {tab === 'yourgames' && (
          <div className="pt-8 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-2xl font-bold text-white">{t(settings.language, 'tabYourGames')}</h2>
                <span className="text-sm text-[#8c8c8c]">({sortedOwnedGames.length})</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#242424] rounded-full p-1">
                {(
                  [
                    ['recent', 'Recent'],
                    ['az', 'A-Z'],
                    ['console', 'Console'],
                  ] as const
                ).map(([s, lbl]) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLibrarySort(s)}
                    className={`px-3.5 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                      librarySort === s ? 'bg-white text-[#0e0e0e]' : 'text-[#bebebe] hover:text-white'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {sortedOwnedGames.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {sortedOwnedGames.map((g) => (
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
              <div className="bg-[#242424] rounded-2xl p-10 text-center text-[#bebebe]">
                No owned or free-to-play titles found yet.
              </div>
            )}

            {hiddenGamesList.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-lg font-semibold text-[#bebebe]">{t(settings.language, 'hiddenGames')}</h3>
                  <span className="text-xs text-[#8c8c8c]">({hiddenGamesList.length})</span>
                </div>
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
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{t(settings.language, 'tabConsoles')}</h2>
                <p className="text-sm text-[#bebebe] mt-1">{t(settings.language, 'consolesHint')}</p>
              </div>
              <button type="button" onClick={loadConsoles} className="psbox-btn text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingConsoles ? 'psbox-spinner' : ''}`} />
                Refresh
              </button>
            </div>

            {consoles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {consoles.map((c) => (
                  <div
                    key={c.serverId}
                    className="bg-[#242424] hover:ring-2 hover:ring-white/80 rounded-2xl p-6 flex flex-col justify-between gap-5 transition-all"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-24 h-24 rounded-xl bg-[#0e0e0e]/60 flex items-center justify-center shrink-0">
                        <XboxChassisArtwork consoleType={c.consoleType} isOn={c.powerState === 'On'} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xl text-white truncate">{c.deviceName}</h3>
                        <div className="text-sm text-[#bebebe] mt-0.5">{c.consoleType}</div>
                        <div className="flex items-center gap-2 text-xs mt-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              c.powerState === 'On'
                                ? 'bg-[#107c10]'
                                : c.powerState === 'ConnectedStandby'
                                  ? 'bg-sky-400'
                                  : 'bg-[#8c8c8c]'
                            }`}
                          />
                          <span className="text-[#bebebe] font-medium">
                            {c.powerState === 'ConnectedStandby' ? 'Sleeping (Ready to Wake)' : c.powerState}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => launchConsole(c)}
                      className="psbox-btn psbox-btn-primary text-sm w-full"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      {t(settings.language, 'streamConsole')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#242424] rounded-2xl p-8 space-y-4 max-w-2xl">
                <div className="flex items-center gap-3 text-lg font-bold">
                  <HardDrive className="w-5 h-5 text-[#107c10]" />
                  {t(settings.language, 'noConsoles')}
                </div>
                <ol className="list-decimal list-inside space-y-2 text-sm text-[#bebebe]">
                  <li>On your Xbox, sign in with this same Microsoft account.</li>
                  <li>Go to Settings &gt; Devices &amp; connections &gt; Remote features and enable Remote features.</li>
                  <li>Set Power options to Sleep so your console can wake automatically.</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB (Split-screen PSBox Search + On-Screen Keyboard + Filters) */}
        {tab === 'search' && (
          <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Search Box, On-Screen Keyboard, Filter Chips */}
            <div className="lg:col-span-5 space-y-4">
              <div className="relative">
                <Search className="w-5 h-5 text-[#8c8c8c] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(settings.language, 'searchPlaceholder')}
                  className="w-full bg-[#242424] border border-white/15 focus:border-white rounded-xl pl-12 pr-10 py-3.5 text-white outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bebebe] hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* PSBox On-Screen Keyboard Grid */}
              <div className="hidden sm:block bg-[#242424]/70 rounded-2xl p-3 space-y-1.5 select-none">
                {[
                  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
                ].map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-10 gap-1.5">
                    {row.map((keyChar) => (
                      <button
                        key={keyChar}
                        type="button"
                        onClick={() => setSearchQuery((q) => q + keyChar.toLowerCase())}
                        className="h-9 rounded-lg bg-[#2c2c2c] hover:bg-white hover:text-[#0e0e0e] text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        {keyChar}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSearchQuery((q) => `${q} `)}
                    className="h-9 rounded-lg bg-[#2c2c2c] hover:bg-white hover:text-[#0e0e0e] text-xs font-semibold cursor-pointer"
                  >
                    SPACE
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                    className="h-9 rounded-lg bg-[#2c2c2c] hover:bg-white hover:text-[#0e0e0e] text-xs font-semibold cursor-pointer"
                  >
                    DELETE
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="h-9 rounded-lg bg-[#2c2c2c] hover:bg-white hover:text-[#0e0e0e] text-xs font-semibold cursor-pointer"
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              {/* PSBox 2x2 Filter Chips + Genre Dropdown */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMkb((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    filterMkb ? 'bg-[#107c10] text-white' : 'bg-[#242424] text-[#bebebe] hover:text-white'
                  }`}
                >
                  Mouse &amp; Keyboard
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTouch((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    filterTouch ? 'bg-[#107c10] text-white' : 'bg-[#242424] text-[#bebebe] hover:text-white'
                  }`}
                >
                  Touch Controls
                </button>
                <button
                  type="button"
                  onClick={() => setFilterFree((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    filterFree ? 'bg-[#107c10] text-white' : 'bg-[#242424] text-[#bebebe] hover:text-white'
                  }`}
                >
                  Free to Play
                </button>
                <button
                  type="button"
                  onClick={() => setFilterWishlist((v) => !v)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    filterWishlist ? 'bg-[#107c10] text-white' : 'bg-[#242424] text-[#bebebe] hover:text-white'
                  }`}
                >
                  Wishlist Only
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="bg-[#242424] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none"
                >
                  {availableGenres.map((g) => (
                    <option key={g} value={g}>
                      Genre: {g}
                    </option>
                  ))}
                </select>
                <select
                  value={filterConsole}
                  onChange={(e) => setFilterConsole(e.target.value as 'all' | 'XSX' | 'XB1')}
                  className="bg-[#242424] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-white outline-none"
                >
                  <option value="all">Console: All</option>
                  <option value="XSX">Xbox Series X|S</option>
                  <option value="XB1">Xbox One</option>
                </select>
              </div>

              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(Number(e.target.value))}
                className="w-full bg-[#242424] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white outline-none"
              >
                <option value={0}>Plan: All plans</option>
                <option value={1}>Game Pass Essential</option>
                <option value={2}>Game Pass Premium</option>
                <option value={3}>Game Pass Ultimate</option>
              </select>
            </div>

            {/* Right: Search Results Grid */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Results</h2>
                <span className="text-xs text-[#8c8c8c]">{searchResults.length} titles</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
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
          </div>
        )}

        {/* SETTINGS TAB (Full PSBox Settings Parity) */}
        {tab === 'settings' && (
          <div className="pt-8 max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-6 h-6 text-[#107c10]" />
                <h2 className="text-2xl font-bold text-white">{t(settings.language, 'settings')}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateSettings(DEFAULT_APP_SETTINGS);
                  showToast('Settings restored to factory defaults.');
                }}
                className="psbox-btn text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore default settings
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Column 1: Display, Video & Stream Quality */}
              <div className="bg-[#242424] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                  Display, Video &amp; Stream Quality
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                    {t(settings.language, 'language')}
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value as LangCode })}
                    className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {LANG_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                    {t(settings.language, 'resolution')}
                  </label>
                  <select
                    value={settings.resolution}
                    onChange={(e) => updateSettings({ resolution: e.target.value as ResolutionMode })}
                    className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="720p">720p (uses less data)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="1080pHQ">1080p HQ (High Bitrate)</option>
                    <option value="1440p">Best (1440p Auto)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Maximum bitrate
                    </label>
                    <select
                      value={settings.maxBitrateMbps}
                      onChange={(e) => updateSettings({ maxBitrateMbps: Number(e.target.value) })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value={0}>Automatic</option>
                      <option value={15}>15 Mbps</option>
                      <option value={25}>25 Mbps (exp)</option>
                      <option value={35}>35 Mbps (exp)</option>
                      <option value={50}>50 Mbps (exp)</option>
                      <option value={-1}>Unlimited</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      FPS Limiter
                    </label>
                    <select
                      value={settings.fpsLimit}
                      onChange={(e) => updateSettings({ fpsLimit: Number(e.target.value) as 0 | 30 | 60 | 120 })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value={0}>Unlimited</option>
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                      <option value={120}>120 FPS</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Upscaling
                    </label>
                    <select
                      value={settings.upscaler}
                      onChange={(e) => updateSettings({ upscaler: e.target.value as UpscalerMode })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="fsr">FSR</option>
                      <option value="fsr_clean">FSR + clean-up</option>
                      <option value="ai">AI (Anime4K)</option>
                      <option value="ai_clean">AI + clean-up</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      {t(settings.language, 'sharpness')}
                    </label>
                    <select
                      value={settings.sharpness}
                      onChange={(e) => updateSettings({ sharpness: e.target.value as SharpnessLevel })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Block smoothing
                    </label>
                    <select
                      value={settings.deband}
                      onChange={(e) => updateSettings({ deband: e.target.value as DebandLevel })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="auto">Auto</option>
                      <option value="off">Off</option>
                      <option value="low">Low</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Video Decoder
                    </label>
                    <select
                      value={settings.videoDecoder}
                      onChange={(e) => updateSettings({ videoDecoder: e.target.value as 'hw' | 'sw' })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="hw">Hardware (Recommended)</option>
                      <option value="sw">Software (CPU)</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center justify-between text-sm text-white pt-1">
                  <span>120 Hz output (VRR)</span>
                  <input
                    type="checkbox"
                    checked={settings.highRefresh}
                    onChange={(e) => updateSettings({ highRefresh: e.target.checked })}
                    className="w-4 h-4 accent-[#107c10]"
                  />
                </label>
              </div>

              {/* Column 2: Region, Audio, Glyphs & Alerts */}
              <div className="bg-[#242424] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-white/10 pb-2">
                  Region, Audio &amp; Controls
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                    {t(settings.language, 'region')}
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setSelectedRegion(val);
                      await psboxApi.updateRegion(val).catch(() => {});
                    }}
                    className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {regions.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name} {r.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      {t(settings.language, 'countryBypass')}
                    </label>
                    <select
                      value={settings.loginCountry}
                      onChange={async (e) => {
                        const val = e.target.value;
                        updateSettings({ loginCountry: val });
                        await psboxApi.updateRegion(undefined, val).catch(() => {});
                      }}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="">Off</option>
                      <option value="us">United States (US)</option>
                      <option value="br">Brazil (BR)</option>
                      <option value="jp">Japan (JP)</option>
                      <option value="kr">South Korea (KR)</option>
                      <option value="pl">Poland (PL)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Store country
                    </label>
                    <select
                      value={settings.storeCountry}
                      onChange={(e) => updateSettings({ storeCountry: e.target.value })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="">Auto</option>
                      <option value="US">United States (US)</option>
                      <option value="BR">Brazil (BR)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="JP">Japan (JP)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Button Glyphs
                    </label>
                    <select
                      value={glyphStyle}
                      onChange={(e) => updateSettings({ glyphStyle: e.target.value as GlyphStyle })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="playstation">PlayStation (✕ ○ □ △)</option>
                      <option value="xbox">Xbox (A B X Y)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Confirm button
                    </label>
                    <select
                      value={settings.circleConfirms ? 'circle' : 'cross'}
                      onChange={(e) => updateSettings({ circleConfirms: e.target.value === 'circle' })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="cross">Cross / A (Western)</option>
                      <option value="circle">Circle / B (Japanese)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Game volume ({settings.gameVolume}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={settings.gameVolume}
                      onChange={(e) => updateSettings({ gameVolume: Number(e.target.value) })}
                      className="w-full accent-[#107c10]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#8c8c8c] uppercase mb-1.5">
                      Audio-to-Haptics
                    </label>
                    <select
                      value={settings.audioHaptics}
                      onChange={(e) => updateSettings({ audioHaptics: Number(e.target.value) as 0 | 1 | 2 | 3 })}
                      className="w-full bg-[#0e0e0e] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value={0}>Off</option>
                      <option value={1}>Low</option>
                      <option value={2}>Medium</option>
                      <option value={3}>High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-1 text-sm text-white">
                  <label className="flex items-center justify-between">
                    <span>Controller Rumble / Trigger Vibration</span>
                    <input
                      type="checkbox"
                      checked={settings.triggerRumble}
                      onChange={(e) => updateSettings({ triggerRumble: e.target.checked })}
                      className="w-4 h-4 accent-[#107c10]"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Queue ready chime</span>
                    <input
                      type="checkbox"
                      checked={settings.queueReadyAlert}
                      onChange={(e) => updateSettings({ queueReadyAlert: e.target.checked })}
                      className="w-4 h-4 accent-[#107c10]"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Preview features (xCloud F2P)</span>
                    <input
                      type="checkbox"
                      checked={settings.previewFeatures}
                      onChange={(e) => updateSettings({ previewFeatures: e.target.checked })}
                      className="w-4 h-4 accent-[#107c10]"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Controller & Input Studio Launchers (matches PSBox Stick/Trigger/Gyro/Pad/Keys/Lightbar testers) */}
            <div className="bg-[#242424] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Controller &amp; Input Calibration Studio</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {(
                  [
                    ['sticks', 'Stick Deadzone'],
                    ['triggers', 'Trigger Feel'],
                    ['gyro', 'Gyro Aiming'],
                    ['pad', 'Pad & Touchpad'],
                    ['keys', 'Keyboard Keys'],
                    ['lightbar', 'Light Bar'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setControllerModalTab(key)}
                    className="px-3 py-3 rounded-xl bg-[#0e0e0e]/70 hover:bg-white hover:text-[#0e0e0e] text-xs font-semibold text-white flex flex-col items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Gamepad2 className="w-4 h-4 text-[#107c10]" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Diagnostics, Support & What's New (matches PSBox Sign-In Check, Network Test, Bug Report, Ko-fi) */}
            <div className="bg-[#242424] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Diagnostics, Support &amp; Updates</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSignInCheckOpen(true)}
                  className="psbox-btn text-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-[#107c10]" />
                  Check my sign-in
                </button>
                <button
                  type="button"
                  onClick={() => setNetworkTestOpen(true)}
                  className="psbox-btn text-xs"
                >
                  <Wifi className="w-4 h-4 text-[#107c10]" />
                  Network test
                </button>
                <button
                  type="button"
                  onClick={() => setInfoQrMode('report')}
                  className="psbox-btn text-xs"
                >
                  <Bug className="w-4 h-4 text-amber-400" />
                  Report a problem
                </button>
                <button
                  type="button"
                  onClick={() => setInfoQrMode('support')}
                  className="psbox-btn text-xs"
                >
                  <Heart className="w-4 h-4 text-rose-400" />
                  Support (Ko-fi)
                </button>
                <button
                  type="button"
                  onClick={() => setInfoQrMode('whatsnew')}
                  className="psbox-btn text-xs"
                >
                  <Activity className="w-4 h-4 text-sky-400" />
                  What&apos;s New
                </button>
              </div>
            </div>

            {/* Cloudflare Worker Relay */}
            <div className="bg-[#242424] rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Link2 className="w-4 h-4 text-[#107c10]" />
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
              <p className="text-xs text-[#bebebe] leading-relaxed">
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
                  className="flex-1 bg-[#0e0e0e] border border-white/15 focus:border-[#107c10] rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
                <button type="submit" className="psbox-btn text-xs shrink-0">
                  {relaySaved ? 'Saved!' : 'Save Relay URL'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Desktop Bottom Hints + Connected Pads Bar matching PSBox drawHints + drawPads */}
      <footer className="hidden sm:flex fixed bottom-0 inset-x-0 z-20 pointer-events-none bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/85 to-transparent px-10 py-3.5 items-center justify-between text-xs text-[#bebebe]">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Gamepad2 className={`w-4 h-4 ${connectedPads > 0 ? 'text-[#107c10]' : 'text-[#8c8c8c]'}`} />
          <span>{connectedPads > 0 ? `${connectedPads} Controller Connected` : 'Keyboard / Touch Input'}</span>
        </div>
        <div className="flex items-center gap-5 pointer-events-auto">
          <span className="inline-flex items-center gap-1.5">
            <ButtonGlyph icon="cross" style={glyphStyle} />
            <span>Select</span>
          </span>
          <button
            type="button"
            onClick={() => setTab('search')}
            className="inline-flex items-center gap-1.5 hover:text-white cursor-pointer"
          >
            <ButtonGlyph icon="triangle" style={glyphStyle} />
            <span>Search</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className="inline-flex items-center gap-1.5 hover:text-white cursor-pointer"
          >
            <ButtonGlyph icon="options" style={glyphStyle} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 hover:text-white cursor-pointer"
          >
            <ButtonGlyph icon="touchpad" style={glyphStyle} />
            <span>Sign out</span>
          </button>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Dock */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0e0e0e]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 flex items-center justify-around"
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
                active ? 'text-[#107c10]' : 'text-[#bebebe]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notification matching PSBox ToastView */}
      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#242424] border border-white/20 text-white text-sm font-semibold shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* Details Modal */}
      {detailsProduct && (
        <GameDetailsModal
          lang={settings.language}
          product={detailsProduct}
          settings={settings}
          wishlisted={settings.wishlist.includes(detailsProduct.productId)}
          favorited={settings.favorites.includes(detailsProduct.productId)}
          hidden={settings.hidden.includes(detailsProduct.productId)}
          glyphStyle={glyphStyle}
          playtimeSec={settings.playtimeSecByProduct[detailsProduct.productId] ?? 0}
          onToggleWishlist={() => toggleWishlist(detailsProduct.productId)}
          onToggleFavorite={() => toggleFavorite(detailsProduct.productId)}
          onToggleHidden={() => {
            toggleHidden(detailsProduct.productId);
            setDetailsProduct(null);
          }}
          onSaveGameProfile={(prof) => saveGameProfile(detailsProduct.productId, prof)}
          onPlay={() => launchGame(detailsProduct)}
          onClose={() => setDetailsProduct(null)}
        />
      )}

      {/* Diagnostics & Controller Studio Modals */}
      {signInCheckOpen && profile && (
        <SignInCheckModal
          demoMode={demoMode}
          gamertag={profile.gamertag}
          subscription={profile.subscription || 'FREE'}
          previewFeatures={settings.previewFeatures}
          onClose={() => setSignInCheckOpen(false)}
        />
      )}
      {networkTestOpen && <NetworkTestModal onClose={() => setNetworkTestOpen(false)} />}
      {controllerModalTab && (
        <ControllerToolsModal
          initialTab={controllerModalTab}
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={() => setControllerModalTab(null)}
        />
      )}
      {infoQrMode && <InfoQrModal mode={infoQrMode} onClose={() => setInfoQrMode(null)} />}

      {/* Fullscreen Stream Player */}
      {activeStream && (
        <StreamPlayer
          title={activeStream.title}
          heroUrl={activeStream.heroUrl}
          targetId={activeStream.targetId}
          isHome={activeStream.isHome}
          demoMode={demoMode}
          regionName={selectedRegion}
          cloudTimeRemainingSec={profile?.playtimeRemainingSec ?? -1}
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
