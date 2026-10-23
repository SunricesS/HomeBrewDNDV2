/**
 * WebDND — Canvas Layout Editor
 * Allows users to reposition floating UI elements on the game canvas.
 * 
 * Ways to use:
 *  1. Press F6 or click the 🎛️ button in zoom controls to enter Layout Edit Mode
 *  2. Or hold ALT + Click & Drag any canvas HUD element to move it directly!
 * 
 * Draggable Elements:
 *  - ✏️ Çizim & Şekil Araçları (#map-draw-toolbar)
 *  - ⚔️ İnisiyatif & Tur Takip Çubuğu (#bg3-combat-bar-container)
 *  - 🎯 Aksiyon & Saldırı Çubuğu (#bg3-bottom-hotbar)
 *  - 💥 Alan Hasarı Butonu (#dm-aoe-damage-btn)
 *  - ⚔️ Savaş Modu Butonu (#combat-mode-toggle-btn)
 *  - 🔍 Zoom & Kamera Kontrolleri (#map-zoom-controls)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'webdnd_layout_positions';
  const TOGGLE_KEY = 'F6';

  // ====================================================================
  // Draggable element definitions (All 6 Canvas HUD Elements)
  // ====================================================================
  const DRAGGABLE_ELEMENTS = [
    {
      id: 'map-draw-toolbar',
      labelKey: 'layout_el_draw_toolbar',
      labelFallback: '✏️ Çizim Araçları',
      defaultPosition: { top: 18, left: 18, bottom: null, right: null },
      positionType: 'absolute',
      hasTransform: false,
      parentSelector: '#game-map'
    },
    {
      id: 'bg3-combat-bar-container',
      labelKey: 'layout_el_combat_bar',
      labelFallback: '⚔️ İnisiyatif & Tur Takibi',
      defaultPosition: { top: 18, left: null, bottom: null, right: null },
      positionType: 'fixed',
      hasTransform: true, // CSS has transform: translateX(-50%) & left: 40%
      parentSelector: null
    },
    {
      id: 'bg3-bottom-hotbar',
      labelKey: 'layout_el_action_hotbar',
      labelFallback: '🎯 Aksiyon & Saldırı Çubuğu',
      defaultPosition: { top: null, left: null, bottom: 18, right: null },
      positionType: 'fixed',
      hasTransform: true, // CSS has transform: translateX(-50%) & left: 40%
      parentSelector: null
    },
    {
      id: 'dm-aoe-damage-btn',
      labelKey: 'layout_el_aoe_btn',
      labelFallback: '💥 Alan Hasarı (AoE)',
      defaultPosition: { top: null, left: 24, bottom: 74, right: null },
      positionType: 'fixed',
      hasTransform: false,
      parentSelector: null
    },
    {
      id: 'combat-mode-toggle-btn',
      labelKey: 'layout_el_combat_btn',
      labelFallback: '⚔️ Savaş Modu',
      defaultPosition: { top: null, left: 24, bottom: 24, right: null },
      positionType: 'fixed',
      hasTransform: false,
      parentSelector: null
    },
    {
      id: 'map-zoom-controls',
      labelKey: 'layout_el_zoom_controls',
      labelFallback: '🔍 Zoom Kontrolleri',
      defaultPosition: { top: null, left: null, bottom: 20, right: 20 },
      positionType: 'absolute',
      hasTransform: false,
      parentSelector: '#game-map'
    }
  ];

  class LayoutEditor {
    constructor() {
      this.isActive = false;
      this.savedPositions = {};
      this.dragState = null;
      this.overlayEl = null;
      this.toastTimeout = null;

      // Bound handlers
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseUp = this._onMouseUp.bind(this);
      this._onTouchMove = this._onTouchMove.bind(this);
      this._onTouchEnd = this._onTouchEnd.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onLanguageChange = this._onLanguageChange.bind(this);

      this._loadPositions();
      this._init();
    }

    // ================================================================
    // INITIALIZATION
    // ================================================================
    _init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._setup());
      } else {
        this._setup();
      }
    }

    _setup() {
      // Apply saved positions on load
      this._applySavedPositions();

      // Listen for toggle shortcut (F6 / ESC)
      document.addEventListener('keydown', this._onKeyDown);

      // Mouse & Touch drag handlers
      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup', this._onMouseUp);
      document.addEventListener('touchmove', this._onTouchMove, { passive: false });
      document.addEventListener('touchend', this._onTouchEnd);

      // On-screen toggle button
      const toggleBtn = document.getElementById('btn-toggle-layout-editor');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        });
      }

      // Quick Alt+Drag setup
      this._setupAltDrag();

      // Viewport resize clamping
      window.addEventListener('resize', this._onResize);

      // Live language changes
      window.addEventListener('dnd:languageChange', this._onLanguageChange);
      document.addEventListener('dnd:languageChange', this._onLanguageChange);
    }

    // ================================================================
    // QUICK ALT + DRAG SUPPORT
    // ================================================================
    _setupAltDrag() {
      DRAGGABLE_ELEMENTS.forEach(def => {
        const el = document.getElementById(def.id);
        if (!el) return;

        el.addEventListener('mousedown', (e) => {
          // Only trigger on Alt + Left Click when not already in edit mode
          if (!e.altKey || this.isActive || e.button !== 0) return;

          e.preventDefault();
          e.stopPropagation();
          this._startDrag(e, def, true /* isAltDrag */);
        }, true);
      });
    }

    // ================================================================
    // PERSISTENCE
    // ================================================================
    _loadPositions() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.savedPositions = raw ? JSON.parse(raw) : {};

        // Sanity check: clean out any corrupt or offscreen positions
        const mapH = window.innerHeight || 900;
        const mapW = window.innerWidth || 1400;

        Object.keys(this.savedPositions).forEach(id => {
          const pos = this.savedPositions[id];
          if (!pos || typeof pos.top !== 'number' || typeof pos.left !== 'number') {
            delete this.savedPositions[id];
            return;
          }
          if (pos.top > mapH || pos.top < 0 || pos.left > mapW || pos.left < 0) {
            delete this.savedPositions[id];
          }
        });
      } catch (e) {
        console.warn('[LayoutEditor] Failed to parse saved positions:', e);
        this.savedPositions = {};
      }
    }

    _savePositions() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.savedPositions));
      } catch (e) {
        console.warn('[LayoutEditor] Failed to save positions:', e);
      }
    }

    // ================================================================
    // APPLY SAVED POSITIONS
    // ================================================================
    _applySavedPositions() {
      const parentRect = this._getMapRect();

      DRAGGABLE_ELEMENTS.forEach(def => {
        const el = document.getElementById(def.id);
        if (!el) return;

        const saved = this.savedPositions[def.id];
        // If not custom moved, preserve stylesheet defaults!
        if (!saved || typeof saved.top !== 'number' || typeof saved.left !== 'number') return;

        const maxLeft = Math.max(0, parentRect.width - 60);
        const maxTop = Math.max(0, parentRect.height - 40);

        let left = Math.max(4, Math.min(maxLeft, saved.left));
        let top = Math.max(4, Math.min(maxTop, saved.top));

        // Apply custom coordinates
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';

        if (def.hasTransform) {
          el.style.transform = 'none';
          el.classList.add('layout-custom-positioned');
        }
      });
    }

    _onResize() {
      this._applySavedPositions();
    }

    _onLanguageChange() {
      if (this.isActive) {
        this._refreshLabels();
      }
    }

    _refreshLabels() {
      document.querySelectorAll('.layout-edit-badge').forEach(badge => {
        const parent = badge.parentElement;
        if (!parent) return;
        const def = DRAGGABLE_ELEMENTS.find(d => d.id === parent.id);
        if (def) {
          badge.textContent = this._getLabel(def);
        }
      });

      const titleEl = document.querySelector('.layout-edit-title');
      if (titleEl) titleEl.textContent = this._t('layout_editor_title', 'Düzen Düzenleyici');

      const resetBtn = document.getElementById('layout-edit-reset-btn');
      if (resetBtn) resetBtn.innerHTML = `🔄 ${this._t('layout_reset', 'Sıfırla')}`;

      const closeBtn = document.getElementById('layout-edit-close-btn');
      if (closeBtn) closeBtn.innerHTML = `✕ ${this._t('layout_close', 'Kapat')}`;
    }

    // ================================================================
    // TOGGLE EDIT MODE
    // ================================================================
    _onKeyDown(e) {
      if (e.key === 'Escape' && this.isActive) {
        e.preventDefault();
        e.stopPropagation();
        this.deactivate();
        return;
      }

      if (e.key === TOGGLE_KEY) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (e.target.isContentEditable) return;

        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      }
    }

    toggle() {
      if (this.isActive) {
        this.deactivate();
      } else {
        this.activate();
      }
    }

    // ================================================================
    // ACTIVATE EDIT MODE
    // ================================================================
    activate() {
      if (this.isActive) return;
      this.isActive = true;

      const toggleBtn = document.getElementById('btn-toggle-layout-editor');
      if (toggleBtn) toggleBtn.classList.add('active');

      this._createOverlay();

      // Mark all 6 draggable elements
      DRAGGABLE_ELEMENTS.forEach(def => {
        const el = document.getElementById(def.id);
        if (!el) return;

        // If the element is normally hidden, reveal it temporarily in preview mode
        const cs = getComputedStyle(el);
        if (el.classList.contains('hidden') || cs.display === 'none' || cs.visibility === 'hidden') {
          el.dataset.layoutWasHidden = 'true';
          el.classList.remove('hidden');
          el.classList.add('layout-preview-visible');
        }

        el.classList.add('layout-editable');

        // Create label badge
        const badge = document.createElement('div');
        badge.className = 'layout-edit-badge';
        badge.textContent = this._getLabel(def);

        // Smart badge placement: place below if near top, else above
        const rect = el.getBoundingClientRect();
        if (rect.top < 65) {
          badge.classList.add('badge-bottom');
        } else {
          badge.classList.add('badge-top');
        }

        el.appendChild(badge);

        // Create drag handle overlay
        const handle = document.createElement('div');
        handle.className = 'layout-drag-handle';
        handle.innerHTML = '<span class="layout-drag-icon">⠿</span>';
        handle.dataset.layoutId = def.id;

        handle.addEventListener('mousedown', (e) => this._startDrag(e, def, false));
        handle.addEventListener('touchstart', (e) => this._startDrag(e, def, false), { passive: false });

        el.appendChild(handle);
      });

      // Show toast notification
      this._showToast(this._t('layout_mode_on', '🔓 Düzen Düzenleme Modu Açık — Öğeleri sürükleyerek konumlandırın'));

      document.body.classList.add('layout-edit-active');
    }

    // ================================================================
    // DEACTIVATE EDIT MODE
    // ================================================================
    deactivate() {
      if (!this.isActive) return;
      this.isActive = false;

      const toggleBtn = document.getElementById('btn-toggle-layout-editor');
      if (toggleBtn) toggleBtn.classList.remove('active');

      // Remove decorations
      document.querySelectorAll('.layout-editable').forEach(el => {
        el.classList.remove('layout-editable');
      });

      document.querySelectorAll('.layout-edit-badge, .layout-drag-handle').forEach(el => {
        el.remove();
      });

      // Restore elements that were hidden before edit mode
      DRAGGABLE_ELEMENTS.forEach(def => {
        const el = document.getElementById(def.id);
        if (!el) return;
        if (el.dataset.layoutWasHidden === 'true') {
          delete el.dataset.layoutWasHidden;
          el.classList.remove('layout-preview-visible');
          el.classList.add('hidden');
        }
      });

      // Remove overlay
      this._removeOverlay();

      document.body.classList.remove('layout-edit-active');

      // Save positions
      this._savePositions();

      this._showToast(this._t('layout_mode_off', '🔒 Düzen Düzenleme Modu Kapatıldı — Konumlar kaydedildi'));
    }

    // ================================================================
    // DRAG & DROP
    // ================================================================
    _startDrag(e, def, isAltDrag = false) {
      e.preventDefault();
      e.stopPropagation();

      const el = document.getElementById(def.id);
      if (!el) return;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const rect = el.getBoundingClientRect();
      const parentRect = this._getMapRect();

      // If the element had CSS transform (e.g. translateX(-50%)),
      // neutralize it to 'none' and lock in the exact rendered screen coords
      if (def.hasTransform && el.style.transform !== 'none') {
        el.style.transform = 'none';
        el.classList.add('layout-custom-positioned');
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
      }

      this.dragState = {
        def: def,
        el: el,
        isAltDrag: isAltDrag,
        startMouseX: clientX,
        startMouseY: clientY,
        startElRect: rect,
        parentRect: parentRect,
        originalTransition: el.style.transition
      };

      el.style.transition = 'none';
      el.classList.add('layout-dragging');

      this._showPositionGuide(el);
    }

    _handleMove(clientX, clientY, e) {
      if (!this.dragState) return;
      if (e && e.cancelable) e.preventDefault();

      const { def, el, startMouseX, startMouseY, startElRect, parentRect } = this.dragState;

      const dx = clientX - startMouseX;
      const dy = clientY - startMouseY;

      // Calculate new position bounded within #game-map
      let newLeft = startElRect.left + dx;
      let newTop = startElRect.top + dy;

      const minLeft = 4;
      const maxLeft = Math.max(minLeft, parentRect.width - startElRect.width - 4);
      const minTop = 4;
      const maxTop = Math.max(minTop, parentRect.height - startElRect.height - 4);

      newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
      newTop = Math.max(minTop, Math.min(maxTop, newTop));

      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
      el.style.bottom = 'auto';
      el.style.right = 'auto';

      if (def.hasTransform) {
        el.style.transform = 'none';
        el.classList.add('layout-custom-positioned');
      }

      this.savedPositions[def.id] = {
        top: newTop,
        left: newLeft,
        bottom: null,
        right: null,
        hasCustomPosition: true
      };

      this._updatePositionGuide(el);
    }

    _onMouseMove(e) {
      if (!this.dragState) return;
      this._handleMove(e.clientX, e.clientY, e);
    }

    _onTouchMove(e) {
      if (!this.dragState || !e.touches || !e.touches[0]) return;
      this._handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }

    _endDrag() {
      if (!this.dragState) return;

      const { el, originalTransition, isAltDrag } = this.dragState;
      el.style.transition = originalTransition || '';
      el.classList.remove('layout-dragging');

      this._hidePositionGuide();

      el.classList.add('layout-snap');
      setTimeout(() => el.classList.remove('layout-snap'), 300);

      this.dragState = null;
      this._savePositions();

      if (isAltDrag) {
        this._showToast(this._t('layout_alt_drag_saved', '📍 Konum kaydedildi'));
      }
    }

    _onMouseUp() {
      this._endDrag();
    }

    _onTouchEnd() {
      this._endDrag();
    }

    _getMapRect() {
      const map = document.getElementById('game-map');
      if (map) return map.getBoundingClientRect();
      return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    }

    // ================================================================
    // OVERLAY
    // ================================================================
    _createOverlay() {
      if (this.overlayEl) return;

      const overlay = document.createElement('div');
      overlay.id = 'layout-edit-overlay';
      overlay.className = 'layout-edit-overlay';
      overlay.innerHTML = `
        <div class="layout-edit-header">
          <div class="layout-edit-header-left">
            <span class="layout-edit-icon">⚙️</span>
            <span class="layout-edit-title">${this._t('layout_editor_title', 'Düzen Düzenleyici')}</span>
            <span class="layout-edit-shortcut-badge">F6</span>
          </div>
          <div class="layout-edit-header-right">
            <button type="button" class="layout-edit-reset-btn" id="layout-edit-reset-btn">
              🔄 ${this._t('layout_reset', 'Sıfırla')}
            </button>
            <button type="button" class="layout-edit-close-btn" id="layout-edit-close-btn">
              ✕ ${this._t('layout_close', 'Kapat')}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;

      const closeBtn = document.getElementById('layout-edit-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.deactivate());

      const resetBtn = document.getElementById('layout-edit-reset-btn');
      if (resetBtn) resetBtn.addEventListener('click', () => this._resetPositions());
    }

    _removeOverlay() {
      if (this.overlayEl) {
        this.overlayEl.remove();
        this.overlayEl = null;
      }
    }

    // ================================================================
    // POSITION GUIDE (shows X, Y while dragging)
    // ================================================================
    _showPositionGuide(el) {
      let guide = document.getElementById('layout-position-guide');
      if (!guide) {
        guide = document.createElement('div');
        guide.id = 'layout-position-guide';
        guide.className = 'layout-position-guide';
        document.body.appendChild(guide);
      }
      this._updatePositionGuide(el);
      guide.classList.add('visible');
    }

    _updatePositionGuide(el) {
      const guide = document.getElementById('layout-position-guide');
      if (!guide) return;

      const rect = el.getBoundingClientRect();
      guide.innerHTML = `
        <span class="lpg-label">X:</span> <span class="lpg-value">${Math.round(rect.left)}px</span>
        <span class="lpg-sep">|</span>
        <span class="lpg-label">Y:</span> <span class="lpg-value">${Math.round(rect.top)}px</span>
      `;

      const guideX = Math.min(rect.left + rect.width / 2 - 60, window.innerWidth - 160);
      const guideY = Math.max(rect.top - 38, 80);
      guide.style.left = Math.max(8, guideX) + 'px';
      guide.style.top = guideY + 'px';
    }

    _hidePositionGuide() {
      const guide = document.getElementById('layout-position-guide');
      if (guide) {
        guide.classList.remove('visible');
        setTimeout(() => guide.remove(), 200);
      }
    }

    // ================================================================
    // RESET POSITIONS
    // ================================================================
    _resetPositions() {
      DRAGGABLE_ELEMENTS.forEach(def => {
        const el = document.getElementById(def.id);
        if (!el) return;

        el.style.top = '';
        el.style.left = '';
        el.style.bottom = '';
        el.style.right = '';

        if (def.hasTransform) {
          el.style.transform = '';
          el.classList.remove('layout-custom-positioned');
        }
      });

      // Clear storage
      this.savedPositions = {};
      this._savePositions();

      this._showToast(this._t('layout_reset_done', '↩️ Tüm öğeler varsayılan konumlarına döndürüldü'));
    }

    // ================================================================
    // TOAST NOTIFICATION
    // ================================================================
    _showToast(message) {
      const existing = document.getElementById('layout-toast');
      if (existing) existing.remove();

      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }

      const toast = document.createElement('div');
      toast.id = 'layout-toast';
      toast.className = 'layout-toast';
      toast.textContent = message;
      document.body.appendChild(toast);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add('visible');
        });
      });

      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // ================================================================
    // I18N HELPER
    // ================================================================
    _getLabel(def) {
      return this._t(def.labelKey, def.labelFallback);
    }

    _t(key, fallback) {
      if (typeof window.i18n !== 'undefined' && window.i18n.t) {
        const val = window.i18n.t(key);
        if (val && val !== key) return val;
      }
      return fallback || key;
    }
  }

  // ================================================================
  // EXPORT & AUTO-INITIALIZE
  // ================================================================
  window.LayoutEditor = LayoutEditor;
  window.layoutEditor = new LayoutEditor();

})();
