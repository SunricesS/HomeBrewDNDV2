/**
 * WebDND — TEHLİKELİ ARAZİ / ALAN (TERRAIN HAZARD) MOTORU
 * 
 * Özellikler:
 * 1. Fare ile haritada serbest / şekilsiz çokgen (polygon) alan çizimi (Freehand Lasso / Polygon).
 * 2. Harita üzerinde animasyonlu, temalı (Lav, Asit, Zehirli Sis, Buz, Dikenli Çalı) tehlikeli zemin görseli.
 * 3. Her tur/round belirlenen hasar ve durum efektini alan içindeki tokenlara uygulama.
 * 4. Belirlenen tur sayısı (ömür) bitince arazinin kendisini haritadan otomatik olarak yok etmesi.
 */

(function () {
  'use strict';

  // I18n çeviri yardımcısı
  const t = (key, params, fallback) => (window.I18n ? window.I18n.t(key, params, fallback) : (fallback || key));

  // State
  let isTerrainDrawingActive = false;
  let currentDrawnPoints = [];
  let isPointerDown = false;
  let drawingOverlaySvg = null;
  let drawingPolygonEl = null;
  let drawingStrokeLine = null;
  let floatingBannerEl = null;

  // Dışa aktarılan global state
  window.__webdnd_pendingTerrainPoints = null;

  // Ses Sentezleyici (Web Audio API)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTerrainPulseSound(theme = 'fire') {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Derin uğultu / kaynama osilatörü
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      if (theme === 'acid' || theme === 'poison') {
        // Tıslama / kabarcık sesi
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
      } else if (theme === 'ice') {
        // Çatırdama / kristal
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(300, now);
      } else {
        // Lav / Ateş tok uğultu
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.55);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, now);
      }

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.58);
    } catch (e) {}
  }

  // ============================================================
  // 1. DÜNYA KOORDİNAT HESAPLAMALARI
  // ============================================================

  function getMapCoordinates(e) {
    const mapContainer = document.getElementById('game-map');
    if (!mapContainer) return { x: 0, y: 0 };
    const rect = mapContainer.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const zoom = window.__webdnd_zoom || 1;
    const panX = window.__webdnd_panX || 0;
    const panY = window.__webdnd_panY || 0;

    return {
      x: Math.round(((clientX - rect.left) - panX) / zoom),
      y: Math.round(((clientY - rect.top) - panY) / zoom)
    };
  }

  // ============================================================
  // 2. FARE İLE SERBEST ALAN ÇİZİM MOTORU (FREEHAND LASSO DRAWING)
  // ============================================================

  function startTerrainDrawing(options = {}) {
    if (isTerrainDrawingActive) return;
    isTerrainDrawingActive = true;
    currentDrawnPoints = [];
    isPointerDown = false;

    const mapContent = document.getElementById('map-content');
    const gameMap = document.getElementById('game-map');
    if (!mapContent || !gameMap) return;

    // Modalları çizim esnasında geçici gizle
    const markerModal = document.getElementById('dm-marker-modal');
    const editModal = document.getElementById('dm-marker-editor-modal');
    if (markerModal && !markerModal.classList.contains('hidden')) {
      markerModal._tempHiddenForDraw = true;
      markerModal.classList.add('hidden');
    }
    if (editModal && !editModal.classList.contains('hidden')) {
      editModal._tempHiddenForDraw = true;
      editModal.classList.add('hidden');
    }

    // Üst Bilgi Banner'ı Göster
    showDrawingBanner();

    // Çizim Katmanı SVG Oluştur
    drawingOverlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawingOverlaySvg.setAttribute('id', 'terrain-drawing-overlay');
    drawingOverlaySvg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:9999;cursor:crosshair;pointer-events:all;';

    // Çizilen poligon ve dış hat
    drawingPolygonEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    drawingPolygonEl.setAttribute('class', 'terrain-drawing-active-poly');
    drawingPolygonEl.style.cssText = 'fill:rgba(245, 158, 11, 0.28); stroke:#f59e0b; stroke-width:3; stroke-dasharray:6 4; stroke-linejoin:round;';

    drawingOverlaySvg.appendChild(drawingPolygonEl);
    mapContent.appendChild(drawingOverlaySvg);

    // Olay Dinleyicileri
    drawingOverlaySvg.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    drawingOverlaySvg.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);

    window.addEventListener('keydown', onKeyDown);
  }

  function showDrawingBanner() {
    if (floatingBannerEl) floatingBannerEl.remove();

    floatingBannerEl = document.createElement('div');
    floatingBannerEl.className = 'terrain-drawing-banner';
    floatingBannerEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">🖌️</span>
        <div>
          <strong style="color:#fde047; font-size:12px;">${t('terrain_drawing_title', {}, 'Serbest Şekilli Arazi Çizimi Aktif')}</strong>
          <div style="font-size:11px; color:#e2e8f0;">${t('terrain_drawing_hint', {}, 'Fareyi basılı tutarak haritada şekilsiz alanı çizin (Bıraktığınızda kapanır • ESC: İptal)')}</div>
        </div>
      </div>
      <button type="button" id="btn-cancel-terrain-draw" style="background:rgba(239, 68, 68, 0.3); border:1px solid #ef4444; color:#fca5a5; font-size:11px; padding:3px 8px; border-radius:4px; cursor:pointer;">✕ İptal (ESC)</button>
    `;

    const gameMap = document.getElementById('game-map');
    if (gameMap) gameMap.appendChild(floatingBannerEl);

    document.getElementById('btn-cancel-terrain-draw')?.addEventListener('click', cancelTerrainDrawing);
  }

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    currentDrawnPoints = [];

    const pt = getMapCoordinates(e);
    currentDrawnPoints.push(pt);
    updateDrawingSvg();
  }

  function onPointerMove(e) {
    if (!isPointerDown) return;
    if (e.touches) e.preventDefault();

    const pt = getMapCoordinates(e);
    const last = currentDrawnPoints[currentDrawnPoints.length - 1];

    // Çok sık nokta eklememek için mesafe eşiği (en az 9px)
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 9) {
      currentDrawnPoints.push(pt);
      updateDrawingSvg();
    }
  }

  function onPointerUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (currentDrawnPoints.length >= 3) {
      // Çizim tamamlandı! Poligonu otomatik kapat
      finishTerrainDrawing(currentDrawnPoints);
    } else {
      // Çok az nokta varsa temizle
      currentDrawnPoints = [];
      updateDrawingSvg();
    }
  }

  function updateDrawingSvg() {
    if (!drawingPolygonEl) return;
    const ptsStr = currentDrawnPoints.map(p => `${p.x},${p.y}`).join(' ');
    drawingPolygonEl.setAttribute('points', ptsStr);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cancelTerrainDrawing();
    }
  }

  function finishTerrainDrawing(points) {
    cleanupDrawingEventListeners();

    // Noktaları sadeleştir (isteğe bağlı hafif yumuşatma)
    const cleanedPoints = points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    window.__webdnd_pendingTerrainPoints = cleanedPoints;

    // UI Güncelle
    const btnDraw = document.getElementById('dm-marker-btn-draw-terrain');
    const statusWrap = document.getElementById('dm-marker-terrain-drawn-status');
    const ptsCount = document.getElementById('dm-marker-terrain-points-count');

    if (btnDraw) {
      btnDraw.innerHTML = `<span>✅</span> <span>${t('terrain_drawn_btn', { count: cleanedPoints.length }, `Alan Çizildi (${cleanedPoints.length} Köşe) • Yeniden Çiz`)}</span>`;
      btnDraw.style.background = 'linear-gradient(135deg, #15803d, #166534)';
      btnDraw.style.borderColor = '#22c55e';
    }
    if (statusWrap && ptsCount) {
      statusWrap.style.display = 'block';
      ptsCount.textContent = cleanedPoints.length;
    }

    // Token adı varsayılan ise güzel bir isim ver
    const nameInput = document.getElementById('dm-marker-name');
    const durationInput = document.getElementById('dm-marker-obj-terrain-duration');
    const durVal = durationInput ? durationInput.value : 5;
    if (nameInput && (!nameInput.value || nameInput.value.trim() === 'X' || nameInput.value.includes('Arazi'))) {
      const themeSelect = document.getElementById('dm-marker-obj-terrain-theme');
      const theme = themeSelect ? themeSelect.value : 'fire';
      const themeNames = {
        fire: 'Lav Denizi',
        acid: 'Zehirli Asit Havuzu',
        poison: 'Boğucu Sis Alanı',
        ice: 'Dondurucu Buz Zemini',
        bramble: 'Dikenli Çalı Alanı',
        custom: 'Büyülü Enerji Alanı'
      };
      nameInput.value = `${themeNames[theme] || 'Tehlikeli Arazi'} (${durVal} Tur)`;
    }

    // Harita üstünde anlık geçici onay parlaması
    showToast(`✨ ${cleanedPoints.length} noktalı şekilsiz arazi haritada kilitlendi! "Token Ekle" butonuyla spawn edebilirsiniz.`);
  }

  function cancelTerrainDrawing() {
    cleanupDrawingEventListeners();
    window.__webdnd_pendingTerrainPoints = null;

    const btnDraw = document.getElementById('dm-marker-btn-draw-terrain');
    if (btnDraw) {
      btnDraw.innerHTML = `<span>🖌️</span> <span>${t('btn_draw_terrain', {}, 'Haritada Araziyi Çiz (Fare ile Serbest Alan)')}</span>`;
      btnDraw.style.background = 'linear-gradient(135deg, #d97706, #b45309)';
      btnDraw.style.borderColor = '#f59e0b';
    }
    const statusWrap = document.getElementById('dm-marker-terrain-drawn-status');
    if (statusWrap) statusWrap.style.display = 'none';

    showToast(t('terrain_draw_cancelled', {}, 'Arazi çizimi iptal edildi.'));
  }

  function cleanupDrawingEventListeners() {
    isTerrainDrawingActive = false;
    isPointerDown = false;

    if (drawingOverlaySvg) {
      drawingOverlaySvg.remove();
      drawingOverlaySvg = null;
    }
    if (floatingBannerEl) {
      floatingBannerEl.remove();
      floatingBannerEl = null;
    }

    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);

    // Çizim için geçici gizlenen modalları geri aç
    const markerModal = document.getElementById('dm-marker-modal');
    const editModal = document.getElementById('dm-marker-editor-modal');
    if (markerModal && markerModal._tempHiddenForDraw) {
      markerModal._tempHiddenForDraw = false;
      markerModal.classList.remove('hidden');
    }
    if (editModal && editModal._tempHiddenForDraw) {
      editModal._tempHiddenForDraw = false;
      editModal.classList.remove('hidden');
    }
  }

  function showToast(message) {
    const gameMap = document.getElementById('game-map');
    if (!gameMap) return;
    const toast = document.createElement('div');
    toast.className = 'dice-toast';
    toast.innerHTML = message;
    gameMap.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2800);
  }

  // ============================================================
  // 3. HARİTADA ARAZİLERİN RENDER EDİLMESİ (SVG POLYGON LAYER)
  // ============================================================

  function getOrCreateTerrainSvgLayer() {
    let layer = document.getElementById('terrain-hazards-layer');
    if (!layer) {
      const mapContent = document.getElementById('map-content');
      if (!mapContent) return null;
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      layer.setAttribute('id', 'terrain-hazards-layer');
      layer.className = 'terrain-hazards-layer';
      layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9;';
      mapContent.insertBefore(layer, mapContent.firstChild);
    }
    return layer;
  }

  /**
   * Belirli bir Arazi marker'ını haritada render eder veya günceller.
   */
  function renderTerrainHazard(marker) {
    if (!marker || marker.objectType !== 'terrain') return;

    const layer = getOrCreateTerrainSvgLayer();
    if (!layer) return;

    const cfg = marker.objectConfig || {};
    let points = Array.isArray(cfg.points) ? cfg.points : [];

    // Nokta yoksa varsayılan şekil oluştur
    if (points.length < 3) {
      const rad = cfg.radius || 110;
      const cx = (marker.x || 200) + (marker.size || 50) / 2;
      const cy = (marker.y || 200) + (marker.size || 50) / 2;
      points = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const r = rad * (0.8 + Math.sin(i * 3) * 0.2);
        points.push({ x: Math.round(cx + Math.cos(ang) * r), y: Math.round(cy + Math.sin(ang) * r) });
      }
    }

    const ptsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    const theme = cfg.theme || 'fire';

    // Ağırlık merkezi (Centroid) hesapla
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const centroidX = Math.round(sumX / points.length);
    const centroidY = Math.round(sumY / points.length);

    let group = document.getElementById(`terrain-group-${marker.id}`);
    if (!group) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', `terrain-group-${marker.id}`);
      group.setAttribute('class', `terrain-hazard-group theme-${theme}`);
      group.dataset.markerId = marker.id;

      // 1. Zemin Işıltı Dalgası (Pulse glow layer)
      const glowPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      glowPoly.setAttribute('class', 'terrain-poly-glow');
      group.appendChild(glowPoly);

      // 2. Ana Tehlike Çokgeni (Animated dashed stroke & semi-transparent fill)
      const mainPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      mainPoly.setAttribute('class', 'terrain-poly-main');
      group.appendChild(mainPoly);

      layer.appendChild(group);
    }

    // Sınıfı güncelle (tema değişikliği için)
    group.setAttribute('class', `terrain-hazard-group theme-${theme}`);

    const glowPoly = group.querySelector('.terrain-poly-glow');
    const mainPoly = group.querySelector('.terrain-poly-main');

    if (glowPoly) glowPoly.setAttribute('points', ptsStr);
    if (mainPoly) mainPoly.setAttribute('points', ptsStr);

    // Merkez Rozetini Güncelle / Oluştur
    updateTerrainCenterBadge(marker, centroidX, centroidY);
  }

  /**
   * Arazinin merkezinde şık bir cam kart rozeti gösterir (Kalan Tur, Hasar, İsim).
   */
  function updateTerrainCenterBadge(marker, cx, cy) {
    const mapContent = document.getElementById('map-content');
    if (!mapContent) return;

    const cfg = marker.objectConfig || {};
    const remainingDur = cfg.remainingDuration != null ? cfg.remainingDuration : (cfg.duration || 5);
    const damage = cfg.damage || 0;
    const damageType = cfg.damageType || 'fire';
    const theme = cfg.theme || 'fire';

    const themeIcons = {
      fire: '🔥',
      acid: '🧪',
      poison: '💨',
      ice: '❄️',
      bramble: '🌿',
      custom: '✨'
    };
    const icon = themeIcons[theme] || '🌋';

    let badge = document.getElementById(`terrain-badge-${marker.id}`);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = `terrain-badge-${marker.id}`;
      badge.className = `terrain-center-badge theme-${theme}`;
      mapContent.appendChild(badge);
    }

    badge.className = `terrain-center-badge theme-${theme}`;
    badge.style.left = `${cx}px`;
    badge.style.top = `${cy}px`;

    const isDm = typeof role !== 'undefined' && role === 'dm';
    const dmActionsHtml = isDm ? `
      <div class="terrain-badge-actions">
        <button type="button" class="terrain-mini-action-btn btn-trigger-terrain" title="Tetikle (Hasar Ver)" data-id="${marker.id}">⚡</button>
        <button type="button" class="terrain-mini-action-btn btn-del-terrain" title="Arazini Kaldır" data-id="${marker.id}">✕</button>
      </div>
    ` : '';

    badge.innerHTML = `
      <div class="terrain-badge-header">
        <span class="terrain-badge-icon">${icon}</span>
        <span class="terrain-badge-name">${escapeHtml(marker.name || 'Tehlikeli Arazi')}</span>
        ${dmActionsHtml}
      </div>
      <div class="terrain-badge-meta">
        <span class="terrain-badge-duration" title="Kalan Ömür">⏳ ${remainingDur} Tur Kaldı</span>
        ${damage > 0 ? `<span class="terrain-badge-damage" title="Tur Başı Hasar">💥 ${damage} ${damageType}</span>` : ''}
      </div>
    `;

    // DM Aksiyonları Dinleyici
    if (isDm) {
      badge.querySelector('.btn-trigger-terrain')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof socket !== 'undefined') {
          socket.emit('triggerObjectTerrain', marker.id);
        }
      });

      badge.querySelector('.btn-del-terrain')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`"${marker.name}" tehlikeli arazisini haritadan kaldırmak istiyor musunuz?`)) {
          if (typeof socket !== 'undefined') {
            socket.emit('deleteMarker', marker.id);
          }
        }
      });
    }
  }

  function removeTerrainHazard(markerId) {
    const group = document.getElementById(`terrain-group-${markerId}`);
    if (group) {
      group.classList.add('terrain-dissolving');
      setTimeout(() => { if (group.parentNode) group.parentNode.removeChild(group); }, 600);
    }

    const badge = document.getElementById(`terrain-badge-${markerId}`);
    if (badge) {
      badge.classList.add('terrain-dissolving');
      setTimeout(() => { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 600);
    }
  }

  function refreshAllTerrains() {
    if (!window.__webdnd_markers) return;
    Object.values(window.__webdnd_markers).forEach(m => {
      if (m && m.objectType === 'terrain') {
        renderTerrainHazard(m);
      }
    });
  }

  // ============================================================
  // 4. ARAZİ PATLAMA VE HASAR PULSE EFEKTLERİ
  // ============================================================

  function playTerrainPulseEffect(data) {
    const { markerId, damage, damageType, affectedTargets } = data || {};

    const group = document.getElementById(`terrain-group-${markerId}`);
    if (group) {
      group.classList.remove('terrain-pulse-flash');
      void group.offsetWidth;
      group.classList.add('terrain-pulse-flash');
      setTimeout(() => group.classList.remove('terrain-pulse-flash'), 650);
    }

    // Ses efekti
    const m = window.__webdnd_markers ? window.__webdnd_markers[markerId] : null;
    const theme = m?.objectConfig?.theme || 'fire';
    playTerrainPulseSound(theme);

    // Ekran hafif sarsıntı
    const gameMap = document.getElementById('game-map');
    if (gameMap) {
      gameMap.classList.remove('map-screen-shake');
      void gameMap.offsetWidth;
      gameMap.classList.add('map-screen-shake');
      setTimeout(() => gameMap.classList.remove('map-screen-shake'), 240);
    }

    // Etkilenen her token üzerinde sıçrayan hasar metni
    if (Array.isArray(affectedTargets)) {
      const mapContent = document.getElementById('map-content');
      affectedTargets.forEach(at => {
        const tokenEl = document.querySelector(`.token[data-id="${at.id}"]`) ||
                        document.querySelector(`.token[data-character-id="${at.id}"]`);
        if (tokenEl && mapContent) {
          // Token titremesi
          tokenEl.classList.remove('token-impact-shake');
          void tokenEl.offsetWidth;
          tokenEl.classList.add('token-impact-shake');
          setTimeout(() => tokenEl.classList.remove('token-impact-shake'), 420);

          if (at.damage > 0) {
            const tLeft = parseFloat(tokenEl.style.left) || tokenEl.offsetLeft || 0;
            const tTop = parseFloat(tokenEl.style.top) || tokenEl.offsetTop || 0;
            const tSize = tokenEl.offsetWidth || 50;

            const floatText = document.createElement('div');
            floatText.className = 'token-floating-dmg';
            floatText.style.color = '#f97316';
            floatText.textContent = `-${at.damage}`;
            floatText.style.left = `${tLeft + tSize / 2}px`;
            floatText.style.top = `${tTop}px`;

            mapContent.appendChild(floatText);
            setTimeout(() => floatText.remove(), 1600);
          }
        }
      });
    }
  }

  // ============================================================
  // 5. SOCKET DİNLEYİCİLERİ VE BAŞLATMA
  // ============================================================

  function initTerrainSockets() {
    if (typeof socket === 'undefined') return;

    // Araziden hasar yayıldığında
    socket.on('objectTerrainPulseApplied', (data) => {
      playTerrainPulseEffect(data);
    });

    // Yeni marker eklendiğinde
    socket.on('newMarker', (markerData) => {
      if (markerData && markerData.objectType === 'terrain') {
        setTimeout(() => renderTerrainHazard(markerData), 50);
      }
    });

    // Marker güncellendiğinde
    socket.on('updateMarkerData', (markerData) => {
      if (markerData && markerData.objectType === 'terrain') {
        renderTerrainHazard(markerData);
      } else {
        removeTerrainHazard(markerData.id);
      }
    });

    // Marker silindiğinde
    socket.on('removeMarker', (markerId) => {
      removeTerrainHazard(markerId);
    });
  }

  // DOM Yüklendiğinde Buton ve Form Bağlantıları
  function initDomBindings() {
    const btnDrawTerrain = document.getElementById('dm-marker-btn-draw-terrain');
    if (btnDrawTerrain) {
      btnDrawTerrain.addEventListener('click', () => {
        startTerrainDrawing();
      });
    }

    const btnRedrawEdit = document.getElementById('dm-marker-edit-btn-redraw-terrain');
    if (btnRedrawEdit) {
      btnRedrawEdit.addEventListener('click', () => {
        startTerrainDrawing();
      });
    }

    const btnTestTerrain = document.getElementById('dm-marker-btn-test-terrain');
    if (btnTestTerrain) {
      btnTestTerrain.addEventListener('click', () => {
        const id = window.editingMarkerId;
        if (id && typeof socket !== 'undefined') {
          socket.emit('triggerObjectTerrain', id);
        }
      });
    }

    // İlk yüklemede haritadaki arazileri çiz
    setTimeout(refreshAllTerrains, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTerrainSockets();
      initDomBindings();
    });
  } else {
    initTerrainSockets();
    initDomBindings();
  }

  // Dışa aktarılan API
  window.__webdnd_startTerrainDrawing = startTerrainDrawing;
  window.__webdnd_renderTerrainHazard = renderTerrainHazard;
  window.__webdnd_removeTerrainHazard = removeTerrainHazard;
  window.__webdnd_refreshAllTerrains = refreshAllTerrains;

  console.log('WebDND Tehlikeli Arazi (Terrain Hazard) motoru yüklendi.');
})();
