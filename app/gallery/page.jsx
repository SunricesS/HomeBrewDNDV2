'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Copy, Check, ArrowLeft, Upload, Image as ImageIcon, Eye, ExternalLink, RefreshCw } from 'lucide-react';

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery-images');
      if (res.ok) {
        const data = await res.json();
        setImages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load gallery images:', err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  const copyToClipboard = (url) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Görsel URL panoya kopyalandı! / Copied to clipboard!');
      }).catch(() => {
        fallbackCopy(url);
      });
    } else {
      fallbackCopy(url);
    }
  };

  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Görsel URL panoya kopyalandı! / Copied to clipboard!');
    } catch (err) {
      prompt('URL:', text);
    }
    document.body.removeChild(ta);
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      setUploading(true);
      try {
        const payload = {
          image: base64Data,
          name: uploadName.trim() || file.name.replace(/\.[^/.]+$/, '')
        };

        const res = await fetch('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          showToast('Resim başarıyla yüklendi! / Uploaded successfully!');
          setShowUploadModal(false);
          setUploadName('');
          fetchImages();
        } else {
          alert('Yükleme başarısız oldu.');
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert('Yükleme sırasında hata oluştu.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredImages = images.filter((img) =>
    (img.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0705] via-[#140f0c] to-[#070504] text-stone-200 flex flex-col justify-between selection:bg-amber-500/20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl bg-amber-600 text-stone-950 font-medium text-sm shadow-2xl shadow-amber-950/80 border border-amber-400 animate-bounce">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full px-6 py-4 flex items-center justify-between border-b border-amber-900/30 bg-black/60 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-amber-300 border border-amber-900/40 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Ana Sayfa / Giriş</span>
          </Link>
          <div className="h-4 w-px bg-amber-900/40" />
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-amber-500" />
            <h1 className="font-cinzel text-lg sm:text-xl font-bold text-amber-300">
              Sistem Harita & Resim Galerisi
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-950 font-cinzel font-bold text-xs tracking-wide shadow-lg shadow-amber-950/40 transition"
          >
            <Upload className="w-4 h-4" />
            <span>Yeni Resim Yükle</span>
          </button>
          <Link
            href="/game"
            className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-800/50 font-cinzel text-xs font-bold transition"
          >
            Oyuna Dön ⚔️
          </Link>
        </div>
      </header>

      {/* Main Gallery Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        
        {/* Search & Meta Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Resim adına göre filtrele..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-900/80 border border-amber-900/40 text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 text-sm shadow-inner"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-stone-400 font-sans">
            <span>Toplam: <strong className="text-amber-400">{images.length}</strong> görsel</span>
            <button
              onClick={fetchImages}
              className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-300 border border-stone-800 transition"
              title="Yenile"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-stone-400">
            <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
            <p className="text-sm font-sans">Kayıtlı harita ve görseller yükleniyor...</p>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-24 bg-stone-900/30 rounded-2xl border border-dashed border-amber-900/30">
            <ImageIcon className="w-12 h-12 text-stone-600 mx-auto mb-3" />
            <p className="text-stone-400 text-sm mb-4">Aramanızla eşleşen resim bulunamadı.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-600/40 text-xs font-semibold hover:bg-amber-600/30 transition"
            >
              Yeni Görsel Yükle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-stone-950/70 border border-amber-900/30 hover:border-amber-500/70 shadow-lg hover:shadow-amber-950/30 transition-all duration-300"
              >
                {/* Image Container */}
                <div
                  onClick={() => copyToClipboard(img.url)}
                  className="relative aspect-square w-full overflow-hidden bg-stone-900 cursor-pointer"
                  title="Tıklayarak URL'yi kopyalayın"
                >
                  <img
                    src={img.url}
                    alt={img.name || 'Galeri Resmi'}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 text-[11px] font-bold shadow flex items-center gap-1">
                      <Copy className="w-3 h-3" /> URL Kopyala
                    </span>
                  </div>
                </div>

                {/* Info Bar */}
                <div className="p-2.5 bg-stone-950/90 border-t border-amber-900/20 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-stone-300 truncate" title={img.name}>
                    {img.name || 'İsimsiz Resim'}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(img);
                      }}
                      className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition"
                      title="Büyük Önizleme"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition"
                      title="Doğrudan Aç"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[90vh] bg-stone-950 rounded-2xl border border-amber-800/50 p-4 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-900/30">
              <h3 className="font-cinzel text-base font-bold text-amber-300 truncate">
                {previewImage.name || 'Resim Önizleme'}
              </h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-stone-400 hover:text-stone-100 text-lg px-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto max-h-[70vh] flex items-center justify-center bg-stone-900 rounded-lg p-2">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[68vh] max-w-full object-contain rounded"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 mt-2 border-t border-amber-900/30">
              <button
                onClick={() => {
                  copyToClipboard(previewImage.url);
                  setPreviewImage(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow transition"
              >
                <Copy className="w-3.5 h-3.5" /> URL Kopyala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          onClick={() => setShowUploadModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-stone-950 rounded-2xl border border-amber-800/50 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-amber-900/30">
              <h3 className="font-cinzel text-base font-bold text-amber-300">
                Buluta Harita / Resim Yükle
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-stone-400 hover:text-stone-100 text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  Resim / Harita Adı:
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Örn: Ejderha İni Haritası, Goblin Token..."
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-amber-900/40 text-stone-100 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  Resim Dosyası Seç:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadFile}
                  disabled={uploading}
                  className="w-full text-xs text-stone-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-stone-950 hover:file:bg-amber-500 cursor-pointer"
                />
              </div>

              {uploading && (
                <div className="flex items-center justify-center gap-2 py-3 text-amber-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Resim ImgBB ve Supabase&apos;e yükleniyor...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-amber-900/30">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-medium hover:bg-stone-700 transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-4 text-center border-t border-amber-900/20 bg-black/40 text-[11px] text-stone-500 font-sans">
        WebDND &bull; Bulut Resim Sistemi (ImgBB & Supabase) &bull; Next.js + Tailwind CSS
      </footer>

    </div>
  );
}
