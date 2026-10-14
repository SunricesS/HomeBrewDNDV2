'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Sparkles, User, Crown, Sword, Plus, ChevronLeft, Dices, Image as ImageIcon, CheckCircle, RefreshCw } from 'lucide-react';

const TRANSLATIONS = {
  tr: {
    title: 'WEBDND',
    subtitle: 'GELİŞMİŞ MASAÜSTÜ ROL YAPMA PLATFORMU',
    rolePrompt: 'Oyun Dünyasına Nasıl Katılacaksınız?',
    dmTitle: 'Zindan Efendisi (DM)',
    dmDesc: 'Haritayı, yaratıkları, tuzakları ve anlatıyı yönet. Tüm kuralların ve kaderin hakimi ol.',
    dmAction: 'DM Olarak Başla',
    playerTitle: 'Maceracı / Oyuncu',
    playerDesc: 'Kahramanını seç veya yeni bir efsane yarat. Zarlarla kaderini çiz ve savaşa katıl.',
    playerAction: 'Karakterini Seç',
    selectProfile: 'Maceracı Profilini Seç',
    loadingProfiles: 'Profiller yükleniyor...',
    noProfiles: 'Kayıtlı profil bulunamadı.',
    back: 'Geri Dön',
    selectCharacter: 'Karakterini Seç',
    loadingCharacters: 'Karakterler getiriliyor...',
    noCharacters: 'Bu profile ait karakter bulunamadı. Yeni bir karakter oluşturabilirsiniz!',
    createNewChar: 'Yeni Karakter Oluştur',
    createCharTitle: 'Yeni Maceracı Kaydı',
    charName: 'Karakter Adı',
    charNamePlaceholder: 'Örn: Raistlin Majere, Drizzt...',
    maxHp: 'Maksimum Can (HP)',
    baseAc: 'Zırh Sınıfı (AC)',
    avatarUrl: 'Avatar Görsel URL (İsteğe Bağlı)',
    avatarPlaceholder: 'https://i.ibb.co/... veya resim linki',
    statsTitle: 'Temel Nitelikler (Ability Scores)',
    rollStats: 'Zar At (4d6 Drop Lowest)',
    standardArray: 'Standart Dizi',
    createAndPlay: 'Karakteri Oluştur ve Savaşa Gir',
    cancel: 'İptal',
    galleryLink: 'Resim & Harita Galerisi',
    activeHero: 'Maceracı',
    hpLabel: 'Can Değeri',
    acLabel: 'Zırh',
    corruptionLabel: 'Yozlaşma',
    str: 'KUV (STR)',
    dex: 'ÇEV (DEX)',
    con: 'DAY (CON)',
    int: 'ZEK (INT)',
    wis: 'BİL (WIS)',
    chr: 'KAR (CHA)',
  },
  en: {
    title: 'WEBDND',
    subtitle: 'ADVANCED TABLETOP VTT PLATFORM',
    rolePrompt: 'How will you enter the realm?',
    dmTitle: 'Dungeon Master (DM)',
    dmDesc: 'Control maps, monsters, combat encounters, and darkness. Rule the fate of the realm.',
    dmAction: 'Enter as DM',
    playerTitle: 'Adventurer / Player',
    playerDesc: 'Choose your hero or forge a new legend. Roll the dice and test your destiny.',
    playerAction: 'Choose Character',
    selectProfile: 'Select Your Profile',
    loadingProfiles: 'Loading profiles...',
    noProfiles: 'No profiles found.',
    back: 'Back',
    selectCharacter: 'Select Your Character',
    loadingCharacters: 'Loading characters...',
    noCharacters: 'No characters found for this profile. You can forge a new one!',
    createNewChar: 'Create New Character',
    createCharTitle: 'Forge New Character',
    charName: 'Character Name',
    charNamePlaceholder: 'e.g. Raistlin Majere, Drizzt...',
    maxHp: 'Maximum HP',
    baseAc: 'Armor Class (AC)',
    avatarUrl: 'Avatar Image URL (Optional)',
    avatarPlaceholder: 'https://i.ibb.co/... or direct image link',
    statsTitle: 'Ability Scores',
    rollStats: 'Roll Stats (4d6)',
    standardArray: 'Standard Array',
    createAndPlay: 'Create & Enter Game',
    cancel: 'Cancel',
    galleryLink: 'System Image Gallery',
    activeHero: 'Adventurer',
    hpLabel: 'Hit Points',
    acLabel: 'Armor Class',
    corruptionLabel: 'Corruption',
    str: 'STR',
    dex: 'DEX',
    con: 'CON',
    int: 'INT',
    wis: 'WIS',
    chr: 'CHA',
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState('tr');
  const [step, setStep] = useState('role'); // 'role' | 'profile' | 'character' | 'create'
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);

  // New character form state
  const [formData, setFormData] = useState({
    name: '',
    hp_max: 50,
    ac: 10,
    avatar_url: '',
    stats: { str: 10, dex: 10, int: 10, con: 10, wis: 10, chr: 10 }
  });
  const [creatingChar, setCreatingChar] = useState(false);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.tr;

  // Language toggle
  useEffect(() => {
    const savedLang = localStorage.getItem('dnd_lang') || 'tr';
    setLang(savedLang);
  }, []);

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('dnd_lang', newLang);
  };

  // Start game helper
  const startGame = (role, character = null) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dnd_role', role);
      if (selectedProfile) {
        sessionStorage.setItem('dnd_profile', JSON.stringify(selectedProfile));
      }
      if (character) {
        sessionStorage.setItem('dnd_character', JSON.stringify(character));
      }
      router.push('/game');
    }
  };

  // Fetch profiles when entering profile step
  const handleSelectPlayerRole = async () => {
    setStep('profile');
    setLoadingProfiles(true);
    try {
      const res = await fetch('/api/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  // Choose profile and fetch its characters
  const handleChooseProfile = async (profile) => {
    setSelectedProfile(profile);
    setStep('character');
    setLoadingCharacters(true);
    try {
      const res = await fetch(`/api/characters/${profile.id}`);
      if (res.ok) {
        const data = await res.json();
        setCharacters(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoadingCharacters(false);
    }
  };

  // Stat rolling helper (4d6 drop lowest)
  const roll4d6 = () => {
    const rolls = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    rolls.sort((a, b) => a - b);
    return rolls[1] + rolls[2] + rolls[3];
  };

  const handleRollAllStats = () => {
    setFormData(prev => ({
      ...prev,
      stats: {
        str: roll4d6(),
        dex: roll4d6(),
        con: roll4d6(),
        int: roll4d6(),
        wis: roll4d6(),
        chr: roll4d6()
      }
    }));
  };

  const handleStandardArray = () => {
    setFormData(prev => ({
      ...prev,
      stats: { str: 15, dex: 14, con: 13, int: 12, wis: 10, chr: 8 }
    }));
  };

  // Create character form submit
  const handleCreateCharacter = async (e) => {
    e.preventDefault();
    if (!selectedProfile) return;
    if (!formData.name.trim()) return;

    setCreatingChar(true);
    try {
      const payload = {
        user_id: selectedProfile.id,
        name: formData.name.trim(),
        hp_max: Number(formData.hp_max) || 50,
        ac: Number(formData.ac) || 10,
        ac_bonus: 0,
        stats: formData.stats,
        avatar_url: formData.avatar_url.trim() || null
      };

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdData = await res.json();
        const createdChar = Array.isArray(createdData) ? createdData[0] : createdData;
        startGame('player', createdChar);
      } else {
        alert('Karakter kaydedilemedi.');
      }
    } catch (err) {
      console.error('Character creation error:', err);
      alert('Hata oluştu.');
    } finally {
      setCreatingChar(false);
    }
  };

  const calcModifier = (score) => {
    const mod = Math.floor(((Number(score) || 10) - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0a0705] via-[#140f0c] to-[#070504] text-stone-200 flex flex-col justify-between overflow-x-hidden selection:bg-amber-500/20">
      
      {/* Background Decorative Embers & Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-black/80" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      {/* Top Header Navigation */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between border-b border-amber-900/25 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 p-0.5 shadow-lg shadow-amber-900/40 flex items-center justify-center">
            <Sword className="w-5 h-5 text-stone-950" />
          </div>
          <div>
            <h1 className="font-cinzel text-xl font-bold tracking-widest text-amber-300 drop-shadow-sm">
              {t.title}
            </h1>
            <p className="text-[10px] tracking-wider text-amber-500/80 font-sans uppercase">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="/gallery"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:text-amber-300 bg-stone-900/60 hover:bg-stone-800/80 border border-amber-900/40 transition"
          >
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.galleryLink}</span>
          </a>

          {/* Language Switcher */}
          <div className="flex items-center bg-stone-900/80 rounded-lg p-0.5 border border-amber-900/40 text-xs">
            <button
              onClick={() => changeLanguage('tr')}
              className={`px-2.5 py-1 rounded font-medium transition ${lang === 'tr' ? 'bg-amber-600 text-stone-950 font-bold shadow' : 'text-stone-400 hover:text-stone-200'}`}
            >
              TR
            </button>
            <button
              onClick={() => changeLanguage('en')}
              className={`px-2.5 py-1 rounded font-medium transition ${lang === 'en' ? 'bg-amber-600 text-stone-950 font-bold shadow' : 'text-stone-400 hover:text-stone-200'}`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center items-center">
        
        {/* STEP 1: ROLE SELECTION */}
        {step === 'role' && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            <div className="text-center mb-8">
              <h2 className="font-cinzel text-2xl md:text-3xl font-extrabold text-amber-200 mb-2 drop-shadow">
                {t.rolePrompt}
              </h2>
              <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Dungeon Master Card */}
              <div
                onClick={() => startGame('dm')}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-b from-stone-900/90 to-[#19120c]/95 border border-amber-700/30 hover:border-amber-500/80 p-8 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-amber-900/20 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Crown className="w-32 h-32 text-amber-500" />
                </div>
                <div>
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400 group-hover:scale-110 transition-transform">
                    <Crown className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel text-xl font-bold text-amber-300 mb-2">
                    {t.dmTitle}
                  </h3>
                  <p className="text-sm text-stone-400 leading-relaxed font-sans mb-6">
                    {t.dmDesc}
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-stone-950 font-cinzel font-bold text-sm tracking-wide shadow-lg shadow-amber-950/50 group-hover:brightness-110 transition"
                >
                  {t.dmAction}
                </button>
              </div>

              {/* Player Card */}
              <div
                onClick={handleSelectPlayerRole}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-b from-stone-900/90 to-[#19120c]/95 border border-amber-700/30 hover:border-amber-500/80 p-8 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-amber-900/20 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sword className="w-32 h-32 text-amber-500" />
                </div>
                <div>
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400 group-hover:scale-110 transition-transform">
                    <User className="w-7 h-7" />
                  </div>
                  <h3 className="font-cinzel text-xl font-bold text-amber-300 mb-2">
                    {t.playerTitle}
                  </h3>
                  <p className="text-sm text-stone-400 leading-relaxed font-sans mb-6">
                    {t.playerDesc}
                  </p>
                </div>
                <button
                  type="button"
                  className="w-full py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-cinzel font-bold text-sm tracking-wide border border-amber-700/50 group-hover:border-amber-500 shadow transition"
                >
                  {t.playerAction}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PROFILE SELECTION */}
        {step === 'profile' && (
          <div className="w-full max-w-xl bg-stone-900/85 backdrop-blur-xl border border-amber-800/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-amber-900/30">
              <button
                onClick={() => setStep('role')}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.back}
              </button>
              <h2 className="font-cinzel text-lg font-bold text-amber-200">
                {t.selectProfile}
              </h2>
              <div className="w-12" />
            </div>

            {loadingProfiles ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-400">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <p className="text-sm">{t.loadingProfiles}</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-10 text-stone-400 font-sans">
                {t.noProfiles}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => handleChooseProfile(profile)}
                    className="group flex items-center justify-between p-4 rounded-xl bg-stone-950/60 hover:bg-amber-950/30 border border-amber-900/30 hover:border-amber-500/60 cursor-pointer transition-all shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-800 border border-amber-700/40 flex items-center justify-center text-amber-400 font-bold font-cinzel">
                        {profile.username ? profile.username[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-200 group-hover:text-amber-300 transition">
                          {profile.username}
                        </h4>
                        <span className="inline-block text-[11px] font-sans px-2 py-0.5 rounded bg-stone-800/80 text-amber-400/90 border border-amber-900/30">
                          {profile.role || 'player'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-amber-500 font-semibold group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: CHARACTER SELECTION */}
        {step === 'character' && (
          <div className="w-full max-w-4xl bg-stone-900/85 backdrop-blur-xl border border-amber-800/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-amber-900/30">
              <button
                onClick={() => setStep('profile')}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.back}
              </button>
              <div className="text-center">
                <h2 className="font-cinzel text-lg font-bold text-amber-200">
                  {t.selectCharacter}
                </h2>
                <span className="text-xs text-amber-500/80 font-sans">
                  {selectedProfile?.username}
                </span>
              </div>
              <button
                onClick={() => setStep('create')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-stone-100 text-xs font-bold shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.createNewChar}
              </button>
            </div>

            {loadingCharacters ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-400">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <p className="text-sm">{t.loadingCharacters}</p>
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-stone-400 text-sm mb-6 max-w-md mx-auto">
                  {t.noCharacters}
                </p>
                <button
                  onClick={() => setStep('create')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-stone-950 font-cinzel font-bold text-sm shadow-lg hover:brightness-110 transition"
                >
                  {t.createNewChar}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[32rem] overflow-y-auto pr-1">
                {characters.map((char) => (
                  <div
                    key={char.id}
                    onClick={() => startGame('player', char)}
                    className="group relative p-4 rounded-xl bg-stone-950/70 hover:bg-amber-950/20 border border-amber-900/35 hover:border-amber-500/70 cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between"
                  >
                    <div>
                      {/* Avatar & Title Row */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-800 border border-amber-600/40 flex-shrink-0 flex items-center justify-center">
                          {char.avatar_url ? (
                            <img
                              src={char.avatar_url}
                              alt={char.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Sword className="w-6 h-6 text-amber-500/70" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-cinzel font-bold text-base text-amber-200 truncate group-hover:text-amber-300">
                            {char.name}
                          </h4>
                          <span className="text-[11px] text-stone-400 font-sans">
                            AC: <strong className="text-stone-200">{(char.ac || 10) + (char.ac_bonus || 0)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* HP Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[11px] font-mono text-stone-400 mb-1">
                          <span>HP</span>
                          <span className="text-stone-200 font-bold">{char.hp_current ?? char.hp_max} / {char.hp_max}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden border border-amber-950">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((char.hp_current ?? char.hp_max) / (char.hp_max || 1)) * 100))}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats Pills */}
                      {char.stats && (
                        <div className="grid grid-cols-6 gap-1 text-center py-2 px-1 rounded-lg bg-black/40 border border-stone-800/80 mb-3 text-[10px] font-mono">
                          <div><span className="text-amber-500/80 block">STR</span>{char.stats.str ?? 10}</div>
                          <div><span className="text-amber-500/80 block">DEX</span>{char.stats.dex ?? 10}</div>
                          <div><span className="text-amber-500/80 block">CON</span>{char.stats.con ?? 10}</div>
                          <div><span className="text-amber-500/80 block">INT</span>{char.stats.int ?? 10}</div>
                          <div><span className="text-amber-500/80 block">WIS</span>{char.stats.wis ?? 10}</div>
                          <div><span className="text-amber-500/80 block">CHA</span>{char.stats.chr ?? 10}</div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="w-full py-2 px-3 rounded-lg bg-stone-900 group-hover:bg-amber-600 text-stone-300 group-hover:text-stone-950 font-cinzel text-xs font-bold border border-amber-900/40 group-hover:border-amber-500 transition"
                    >
                      {t.activeHero} Seç →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: CHARACTER CREATION */}
        {step === 'create' && (
          <div className="w-full max-w-2xl bg-stone-900/90 backdrop-blur-xl border border-amber-800/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-amber-900/30">
              <button
                onClick={() => setStep('character')}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.back}
              </button>
              <h2 className="font-cinzel text-lg font-bold text-amber-200">
                {t.createCharTitle}
              </h2>
              <div className="w-12" />
            </div>

            <form onSubmit={handleCreateCharacter} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                    {t.charName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.charNamePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-amber-900/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                      {t.maxHp}
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.hp_max}
                      onChange={(e) => setFormData({ ...formData, hp_max: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-amber-900/50 text-stone-100 focus:outline-none focus:border-amber-500 text-sm font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                      {t.baseAc}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.ac}
                      onChange={(e) => setFormData({ ...formData, ac: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-amber-900/50 text-stone-100 focus:outline-none focus:border-amber-500 text-sm font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                  {t.avatarUrl}
                </label>
                <input
                  type="url"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  placeholder={t.avatarPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950/80 border border-amber-900/50 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              {/* Stats Grid with Quick Rollers */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-amber-300">
                    {t.statsTitle}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRollAllStats}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-700/50 text-[11px] font-sans transition"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      {t.rollStats}
                    </button>
                    <button
                      type="button"
                      onClick={handleStandardArray}
                      className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-600/50 text-[11px] font-sans transition"
                    >
                      {t.standardArray}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {['str', 'dex', 'con', 'int', 'wis', 'chr'].map((statKey) => (
                    <div key={statKey} className="flex flex-col items-center p-2 rounded-xl bg-stone-950/60 border border-amber-900/40">
                      <span className="text-[11px] font-bold text-amber-400 uppercase mb-1">
                        {statKey}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.stats[statKey]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            stats: {
                              ...formData.stats,
                              [statKey]: Number(e.target.value) || 10
                            }
                          })
                        }
                        className="w-12 text-center bg-stone-900 rounded border border-stone-700 py-1 text-sm font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-stone-400 font-mono mt-1">
                        {calcModifier(formData.stats[statKey])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-amber-900/30">
                <button
                  type="button"
                  onClick={() => setStep('character')}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creatingChar}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-700 text-stone-950 font-cinzel font-bold text-xs tracking-wider shadow-lg hover:brightness-110 disabled:opacity-50 transition"
                >
                  {creatingChar ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {t.createAndPlay}
                </button>
              </div>
            </form>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-4 text-center border-t border-amber-900/20 bg-black/40 text-[11px] text-stone-500 font-sans">
        WebDND &bull; Baldur&apos;s Gate 3 & D&D 5e Inspired Tabletop Experience &bull; Next.js & Tailwind CSS
      </footer>

    </div>
  );
}
