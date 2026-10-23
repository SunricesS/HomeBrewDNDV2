/**
 * ============================================================
 * WebDND — Map Grid & Cell System (Harita Izgara ve Hücre Yönetimi)
 * ============================================================
 * Arka plan yüklendiğinde veya değiştirildiğinde canvası kare hücrelere böler.
 * Boyut (size), kenar kalınlığı (thickness), renk, saydamlık ve çizgi tipini yönetir.
 * Gelecekteki oyuncu hareket sistemi (player movement system) ve
 * hücreye hizalama (snap-to-grid) için API sağlar.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'webdnd_map_grid_settings';

  const DEFAULT_SETTINGS = {
    enabled: true,
    size: 50,
    thickness: 1,
    color: '#ffffff',
    opacity: 0.35,
    style: 'solid', // 'solid' | 'dashed' | 'dotted'
    snapToGrid: false,
    showCoordinates: false
  };

  class MapGridManager {
    constructor() {
      this.settings = Object.assign({}, DEFAULT_SETTINGS);
      this.canvas = null;
      this.ctx = null;
      this.gameMap = null;
      this.highlightLayer = [];
      this.throttledEmit = null;

      this.init();
    }

    init() {
      // Yerel ayarları oku
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          this.settings = Object.assign({}, DEFAULT_SETTINGS, parsed);
        }
      } catch (e) {
        console.warn('Grid ayarları localStorage okunamadı:', e);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupDOM());
      } else {
        this.setupDOM();
      }
    }

    setupDOM() {
      this.gameMap = document.getElementById('map-content');
      this.canvas = document.getElementById('grid-layer');

      if (!this.canvas && this.gameMap) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'grid-layer';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '1';
        this.canvas.style.pointerEvents = 'none';
        this.gameMap.insertBefore(this.canvas, this.gameMap.firstChild);
      }

      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
      }

      // Throttled Socket Emit (DM değişiklikleri için)
      if (typeof throttle === 'function') {
        this.throttledEmit = throttle((settings) => {
          if (typeof socket !== 'undefined' && socket) {
            socket.emit('updateMapGrid', settings);
          }
        }, 60);
      } else {
        this.throttledEmit = (settings) => {
          if (typeof socket !== 'undefined' && socket) {
            socket.emit('updateMapGrid', settings);
          }
        };
      }

      this.bindUIControls();
      this.bindSocketEvents();
      this.resize();
      this.draw();

      // Pencere boyutu değişimini dinle
      window.addEventListener('resize', () => this.resize());
    }

    // ============================================================
    // CANVAS YÖNETİMİ & ÇİZİM (RENDER)
    // ============================================================

    resize() {
      if (!this.canvas || !this.gameMap) return;

      const w = this.gameMap.clientWidth || parseInt(this.gameMap.style.width, 10) || 2000;
      const h = this.gameMap.clientHeight || parseInt(this.gameMap.style.height, 10) || 1500;

      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }

      this.draw();
      this.updateInfoSummary();
    }

    draw() {
      if (!this.canvas || !this.ctx || !this.gameMap) return;

      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (!this.settings.enabled) {
        return;
      }

      const size = Math.max(10, Number(this.settings.size) || 50);
      const thickness = Math.max(0.5, Number(this.settings.thickness) || 1);
      const opacity = Math.max(0, Math.min(1, Number(this.settings.opacity) ?? 0.35));
      const color = this.settings.color || '#ffffff';

      // 1px ve tek sayılı kalınlıklarda Canvas bulanıklığını önlemek için 0.5px offset
      const isOdd = Math.round(thickness) % 2 === 1;
      const halfOffset = isOdd ? 0.5 : 0;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'butt';

      // Çizgi stili (düz, kesikli, noktalı)
      if (this.settings.style === 'dashed') {
        ctx.setLineDash([Math.max(4, size / 8), Math.max(3, size / 12)]);
      } else if (this.settings.style === 'dotted') {
        ctx.setLineDash([2, 3]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();

      // Dikey çizgiler (Vertical Lines)
      for (let x = 0; x <= w; x += size) {
        const drawX = Math.round(x) + halfOffset;
        ctx.moveTo(drawX, 0);
        ctx.lineTo(drawX, h);
      }

      // Yatay çizgiler (Horizontal Lines)
      for (let y = 0; y <= h; y += size) {
        const drawY = Math.round(y) + halfOffset;
        ctx.moveTo(0, drawY);
        ctx.lineTo(w, drawY);
      }

      ctx.stroke();

      // Hücre Vurguları (Movement Highlight overlay)
      if (this.highlightLayer && this.highlightLayer.length > 0) {
        this.highlightLayer.forEach(hl => {
          ctx.fillStyle = hl.color || 'rgba(59, 130, 246, 0.3)';
          ctx.fillRect(hl.col * size, hl.row * size, size, size);
          if (hl.border) {
            ctx.strokeStyle = hl.border;
            ctx.lineWidth = 2;
            ctx.strokeRect(hl.col * size, hl.row * size, size, size);
          }
        });
      }

      // Hücre Koordinatları (A1, B2 veya 0,0)
      if (this.settings.showCoordinates && size >= 25) {
        ctx.setLineDash([]);
        ctx.globalAlpha = Math.min(0.9, opacity + 0.25);
        ctx.fillStyle = color;
        const fontSize = Math.min(12, Math.max(9, Math.floor(size * 0.22)));
        ctx.font = `600 ${fontSize}px monospace`;
        ctx.textBaseline = 'top';

        let colIdx = 0;
        for (let x = 0; x < w; x += size) {
          const colLetter = this.getColumnLabel(colIdx);
          let rowIdx = 1;
          for (let y = 0; y < h; y += size) {
            ctx.fillText(`${colLetter}${rowIdx}`, x + 3, y + 3);
            rowIdx++;
          }
          colIdx++;
        }
      }

      ctx.restore();
    }

    // Sütun indeksini A, B, ... Z, AA, AB formatına dönüştür
    getColumnLabel(idx) {
      let label = '';
      let num = idx;
      while (num >= 0) {
        label = String.fromCharCode(65 + (num % 26)) + label;
        num = Math.floor(num / 26) - 1;
      }
      return label;
    }

    // ============================================================
    // ARKA PLAN RESMİ YÜKLENDİĞİNDE TETİKLENEN METOT
    // ============================================================

    onBackgroundLoaded(imgWidth, imgHeight) {
      // Arka plan geldiğinde grid'i otomatik etkinleştir (kullanıcı isteği)
      this.settings.enabled = true;

      const toggleEl = document.getElementById('grid-toggle-enabled');
      if (toggleEl) toggleEl.checked = true;

      // Boyutları yenile ve yeniden çiz
      setTimeout(() => {
        this.resize();
        this.draw();
      }, 50);

      this.saveLocal();
    }

    // ============================================================
    // HAREKET SİSTEMİ & HÜCREYE HİZALAMA (SNAP TO GRID API)
    // ============================================================

    isSnapEnabled() {
      return !!this.settings.snapToGrid;
    }

    /**
     * Verilen (x, y) piksel koordinatını en yakın hücre merkezine veya sınırına hizalar.
     * @param {number} x - Token left pozisyonu
     * @param {number} y - Token top pozisyonu
     * @param {number} tokenSize - Token boyutu (piksel, örn: 50)
     * @returns {{x: number, y: number, col: number, row: number}}
     */
    snap(x, y, tokenSize = 50) {
      const size = Math.max(10, Number(this.settings.size) || 50);
      const tSize = Number(tokenSize) || 50;

      // Token'ın merkez noktasını bul
      const centerX = x + tSize / 2;
      const centerY = y + tSize / 2;

      // Merkezin düştüğü hücre sütun ve satırı
      const col = Math.floor(centerX / size);
      const row = Math.floor(centerY / size);

      // Hücre kaplama boyutu (1x1, 2x2 vs.)
      const cellSpan = Math.max(1, Math.round(tSize / size));

      let snappedX, snappedY;

      if (cellSpan <= 1) {
        // Tek hücre: token'ı hücre içine tam ortala
        snappedX = col * size + (size - tSize) / 2;
        snappedY = row * size + (size - tSize) / 2;
      } else {
        // Çoklu hücre (büyük yaratık): span kadar hücrenin merkezine oturt
        snappedX = col * size + (cellSpan * size - tSize) / 2;
        snappedY = row * size + (cellSpan * size - tSize) / 2;
      }

      return {
        x: Math.max(0, Math.round(snappedX)),
        y: Math.max(0, Math.round(snappedY)),
        col: Math.max(0, col),
        row: Math.max(0, row),
        cellSize: size
      };
    }

    /**
     * Koordinattan sütun/satır döner.
     */
    getCell(x, y) {
      const size = Math.max(10, Number(this.settings.size) || 50);
      return {
        col: Math.floor(x / size),
        row: Math.floor(y / size)
      };
    }

    /**
     * Sütun ve satırdan hücre koordinatlarını ve merkezini döner.
     */
    getCellCoords(col, row) {
      const size = Math.max(10, Number(this.settings.size) || 50);
      return {
        x: col * size,
        y: row * size,
        width: size,
        height: size,
        centerX: (col + 0.5) * size,
        centerY: (row + 0.5) * size
      };
    }

    /**
     * D&D 5e kuralına göre iki hücre arasındaki mesafeyi feet (ayak) cinsinden hesaplar.
     * 1 Hücre = 5 feet. Çapraz hareket kuralı (Chebyshev distance).
     */
    getDistanceInFeet(col1, row1, col2, row2) {
      const dx = Math.abs(col2 - col1);
      const dy = Math.abs(row2 - row1);
      return Math.max(dx, dy) * 5;
    }

    /**
     * İki hücre arasındaki kare sayısını döner.
     */
    getDistanceInCells(col1, row1, col2, row2) {
      const dx = Math.abs(col2 - col1);
      const dy = Math.abs(row2 - row1);
      return Math.max(dx, dy);
    }

    /**
     * Gelecekteki hareket menzili (movement range) gösterimi için hücreleri vurgular.
     * @param {Array<{col: number, row: number, color?: string, border?: string}>} cells
     */
    highlightCells(cells) {
      this.highlightLayer = Array.isArray(cells) ? cells : [];
      this.draw();
    }

    clearHighlights() {
      this.highlightLayer = [];
      this.draw();
    }

    // ============================================================
    // UI KONTROLLERİ & EVENT BINDINGS
    // ============================================================

    bindUIControls() {
      const toggleEnabled = document.getElementById('grid-toggle-enabled');
      const toggleSnap = document.getElementById('grid-toggle-snap');
      const sizeRange = document.getElementById('grid-size-range');
      const sizeNum = document.getElementById('grid-size-num');
      const sizeVal = document.getElementById('grid-size-val');
      const thicknessRange = document.getElementById('grid-thickness-range');
      const thicknessNum = document.getElementById('grid-thickness-num');
      const thicknessVal = document.getElementById('grid-thickness-val');
      const colorInput = document.getElementById('grid-color-input');
      const opacityRange = document.getElementById('grid-opacity-range');
      const opacityVal = document.getElementById('grid-opacity-val');
      const styleSelect = document.getElementById('grid-style-select');
      const toggleCoords = document.getElementById('grid-toggle-coords');
      const btnReset = document.getElementById('btn-reset-grid');
      const presetBtns = document.querySelectorAll('.grid-preset-pill');
      const swatchBtns = document.querySelectorAll('.grid-swatch-btn');

      // İlk UI durumunu ayarlarla eşitle
      this.updateUI();

      // Grid Enabled
      if (toggleEnabled) {
        toggleEnabled.addEventListener('change', (e) => {
          this.setSetting('enabled', e.target.checked);
        });
      }

      // Snap to Grid
      if (toggleSnap) {
        toggleSnap.addEventListener('change', (e) => {
          this.setSetting('snapToGrid', e.target.checked);
        });
      }

      // Hücre Büyüklüğü (Range)
      if (sizeRange && sizeNum && sizeVal) {
        sizeRange.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          sizeNum.value = val;
          sizeVal.textContent = `${val} px`;
          this.updateActivePresetPill(val);
          this.setSetting('size', val);
        });

        sizeNum.addEventListener('change', (e) => {
          let val = parseInt(e.target.value, 10);
          if (isNaN(val)) val = 50;
          val = Math.max(10, Math.min(500, val));
          sizeRange.value = Math.min(250, val);
          sizeNum.value = val;
          sizeVal.textContent = `${val} px`;
          this.updateActivePresetPill(val);
          this.setSetting('size', val);
        });
      }

      // Hızlı Boyut Butonları (Presets)
      presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.getAttribute('data-size'), 10);
          if (!isNaN(val)) {
            if (sizeRange) sizeRange.value = val;
            if (sizeNum) sizeNum.value = val;
            if (sizeVal) sizeVal.textContent = `${val} px`;
            this.updateActivePresetPill(val);
            this.setSetting('size', val);
          }
        });
      });

      // Kenar / Çizgi Kalınlığı (Thickness)
      if (thicknessRange && thicknessNum && thicknessVal) {
        thicknessRange.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          thicknessNum.value = val;
          thicknessVal.textContent = `${val} px`;
          this.setSetting('thickness', val);
        });

        thicknessNum.addEventListener('change', (e) => {
          let val = parseFloat(e.target.value);
          if (isNaN(val)) val = 1;
          val = Math.max(0.5, Math.min(10, val));
          thicknessRange.value = val;
          thicknessNum.value = val;
          thicknessVal.textContent = `${val} px`;
          this.setSetting('thickness', val);
        });
      }

      // Renk (Native Color Picker)
      if (colorInput) {
        colorInput.addEventListener('input', (e) => {
          this.setSetting('color', e.target.value);
        });
      }

      // Hızlı Renk Kutucukları (Swatches)
      swatchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const col = btn.getAttribute('data-color');
          if (col) {
            if (colorInput) colorInput.value = col;
            this.setSetting('color', col);
          }
        });
      });

      // Saydamlık (Opacity)
      if (opacityRange && opacityVal) {
        opacityRange.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          opacityVal.textContent = `%${Math.round(val * 100)}`;
          this.setSetting('opacity', val);
        });
      }

      // Çizgi Tipi
      if (styleSelect) {
        styleSelect.addEventListener('change', (e) => {
          this.setSetting('style', e.target.value);
        });
      }

      // Koordinatlar
      if (toggleCoords) {
        toggleCoords.addEventListener('change', (e) => {
          this.setSetting('showCoordinates', e.target.checked);
        });
      }

      // Sıfırla Butonu
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          this.settings = Object.assign({}, DEFAULT_SETTINGS);
          this.updateUI();
          this.draw();
          this.saveLocal();
          this.broadcastSettings();
        });
      }
    }

    updateActivePresetPill(size) {
      const presetBtns = document.querySelectorAll('.grid-preset-pill');
      presetBtns.forEach(b => {
        const pSize = parseInt(b.getAttribute('data-size'), 10);
        if (pSize === size) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    }

    updateUI() {
      const toggleEnabled = document.getElementById('grid-toggle-enabled');
      const toggleSnap = document.getElementById('grid-toggle-snap');
      const sizeRange = document.getElementById('grid-size-range');
      const sizeNum = document.getElementById('grid-size-num');
      const sizeVal = document.getElementById('grid-size-val');
      const thicknessRange = document.getElementById('grid-thickness-range');
      const thicknessNum = document.getElementById('grid-thickness-num');
      const thicknessVal = document.getElementById('grid-thickness-val');
      const colorInput = document.getElementById('grid-color-input');
      const opacityRange = document.getElementById('grid-opacity-range');
      const opacityVal = document.getElementById('grid-opacity-val');
      const styleSelect = document.getElementById('grid-style-select');
      const toggleCoords = document.getElementById('grid-toggle-coords');

      if (toggleEnabled) toggleEnabled.checked = !!this.settings.enabled;
      if (toggleSnap) toggleSnap.checked = !!this.settings.snapToGrid;
      if (sizeRange) sizeRange.value = Math.min(250, this.settings.size || 50);
      if (sizeNum) sizeNum.value = this.settings.size || 50;
      if (sizeVal) sizeVal.textContent = `${this.settings.size || 50} px`;
      if (thicknessRange) thicknessRange.value = this.settings.thickness || 1;
      if (thicknessNum) thicknessNum.value = this.settings.thickness || 1;
      if (thicknessVal) thicknessVal.textContent = `${this.settings.thickness || 1} px`;
      if (colorInput) colorInput.value = this.settings.color || '#ffffff';
      if (opacityRange) opacityRange.value = this.settings.opacity ?? 0.35;
      if (opacityVal) opacityVal.textContent = `%${Math.round((this.settings.opacity ?? 0.35) * 100)}`;
      if (styleSelect) styleSelect.value = this.settings.style || 'solid';
      if (toggleCoords) toggleCoords.checked = !!this.settings.showCoordinates;

      this.updateActivePresetPill(this.settings.size || 50);
      this.updateInfoSummary();
    }

    updateInfoSummary() {
      if (!this.gameMap) return;
      const w = this.canvas ? this.canvas.width : (this.gameMap.clientWidth || 2000);
      const h = this.canvas ? this.canvas.height : (this.gameMap.clientHeight || 1500);
      const size = Math.max(10, Number(this.settings.size) || 50);

      const cols = Math.ceil(w / size);
      const rows = Math.ceil(h / size);
      const total = cols * rows;

      const dimEl = document.getElementById('grid-info-dimensions');
      const cellsEl = document.getElementById('grid-info-cells');
      const totalEl = document.getElementById('grid-info-total');

      if (dimEl) dimEl.textContent = `${w} × ${h} px`;
      if (cellsEl) cellsEl.textContent = `${cols} sütun × ${rows} satır`;
      if (totalEl) totalEl.textContent = `${total.toLocaleString()} Hücre (${cols * 5}×${rows * 5} ft)`;
    }

    setSetting(key, val, emit = true) {
      this.settings[key] = val;
      this.draw();
      this.updateInfoSummary();
      this.saveLocal();

      if (emit) {
        this.broadcastSettings();
      }
    }

    saveLocal() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (e) {
        // Sessizce yut
      }
    }

    broadcastSettings() {
      if (typeof role !== 'undefined' && role !== 'dm') return;
      if (this.throttledEmit) {
        this.throttledEmit(this.settings);
      }
    }

    // ============================================================
    // SOCKET SENKRONİZASYONU
    // ============================================================

    bindSocketEvents() {
      if (typeof socket === 'undefined' || !socket) return;

      socket.on('mapGridUpdated', (incoming) => {
        if (!incoming || typeof incoming !== 'object') return;

        // Sunucudan gelen ayarları birleştir
        this.settings = Object.assign({}, this.settings, incoming);
        this.updateUI();
        this.draw();
        this.saveLocal();
      });
    }

    // ============================================================
    // DIŞA AÇIK API (EXTERNAL API)
    // ============================================================

    getSettings() {
      return Object.assign({}, this.settings);
    }

    setSettings(newSettings, emit = true) {
      if (!newSettings || typeof newSettings !== 'object') return;
      this.settings = Object.assign({}, this.settings, newSettings);
      this.updateUI();
      this.draw();
      this.saveLocal();
      if (emit) this.broadcastSettings();
    }
  }

  // Singleton instance oluştur ve window'a bağla
  window.__webdnd_grid = new MapGridManager();
})();
