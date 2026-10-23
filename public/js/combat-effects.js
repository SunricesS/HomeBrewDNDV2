/**
 * ============================================================
 * WebDND — Combat Effects Engine (Saldırı & Görsel Efekt Motoru)
 * ============================================================
 * 1. Uzaktan Projectile (Mermi Uçuşu & İsabet Patlaması)
 * 2. Alan Hasarlı Uzaktan Saldırı (Ranged AoE - Haritada Nokta Seçimi & Patlama)
 * 3. Atılma Saldırısı (Dash / Charge Line - Hücreye Işınlanma & Rota Hasarı)
 * 4. Saldırı İttirme (Push/Knockback) & Çekme (Pull) Hücre Fiziği
 */

(function () {
  'use strict';

  // I18n helper
  const t = (key, params, fallback) => (window.I18n ? window.I18n.t(key, params, fallback) : (fallback || key));

  class CombatEffectsEngine {
    constructor() {
      this.gameMap = null;
      this.gameMapContainer = null;
      this.activeTargetingMode = null; // 'aoe' | 'dash' | null
      this.targetingCleanup = null;
      this.recentEffects = new Set();

      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupDOM());
      } else {
        this.setupDOM();
      }
    }

    setupDOM() {
      this.gameMap = document.getElementById('map-content');
      this.gameMapContainer = document.getElementById('game-map');

      this.bindSocket();
    }

    bindSocket() {
      if (typeof socket === 'undefined' || !socket) return;

      socket.on('combatEffectTriggered', (data) => {
        if (!data || typeof data !== 'object') return;
        this.handleIncomingEffect(data);
      });
    }

    // ============================================================
    // 1. UZAKTAN PROJECTILE (MERMİ / BÜYÜ FÜZESİ UÇUŞU)
    // ============================================================

    /**
     * İki nokta arasında animasyonlu bir mermi fırlatır.
     * @param {{x: number, y: number}} from - Başlangıç koordinatı
     * @param {{x: number, y: number}} to - Hedef koordinatı
     * @param {object} options - { style, color, speed, broadcast }
     * @returns {Promise<void>} Mermi hedefe ulaştığında resolve olur.
     */
    playProjectile(from, to, options = {}) {
      return new Promise((resolve) => {
        if (!this.gameMap) {
          resolve();
          return;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Hız hesabı (min 220ms, max 650ms)
        const speed = options.speed || 1200; // px / sec
        const duration = Math.max(220, Math.min(650, (distance / speed) * 1000));

        // Mermi DOM elemanı
        const projEl = document.createElement('div');
        projEl.className = 'combat-projectile';
        projEl.style.left = `${from.x}px`;
        projEl.style.top = `${from.y}px`;
        projEl.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

        const styleClass = options.style === 'arcane' ? 'projectile-arcane' : (options.style === 'arrow' ? 'projectile-arrow' : '');
        projEl.innerHTML = `
          <div class="projectile-trail"></div>
          <div class="projectile-core ${styleClass}"></div>
        `;

        this.gameMap.appendChild(projEl);

        // Diğer oyunculara yayınla
        if (options.broadcast !== false && typeof socket !== 'undefined' && socket) {
          socket.emit('triggerCombatEffect', {
            type: 'projectile',
            from,
            to,
            options: { style: options.style, speed: options.speed }
          });
        }

        // Uçuş animasyonu
        const startTime = performance.now();

        const animate = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / duration);

          // Easing (yumuşak hızlanma/yavaşlama)
          const easeProgress = progress * progress * (3 - 2 * progress);

          const currentX = from.x + dx * easeProgress;
          const currentY = from.y + dy * easeProgress;

          projEl.style.left = `${currentX}px`;
          projEl.style.top = `${currentY}px`;

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Hedefe ulaştı
            projEl.remove();
            this.playImpactFlash(to.x, to.y, options.style);
            resolve();
          }
        };

        requestAnimationFrame(animate);
      });
    }

    /**
     * Mermi isabet noktasında parıltı ve kıvılcım patlatır.
     */
    playImpactFlash(x, y, style = 'fire') {
      if (!this.gameMap) return;

      const flash = document.createElement('div');
      flash.className = 'projectile-impact-flash';
      flash.style.left = `${x}px`;
      flash.style.top = `${y}px`;

      if (style === 'arcane') {
        flash.style.background = 'radial-gradient(circle, #ffffff 20%, #38bdf8 60%, rgba(129, 140, 248, 0) 100%)';
        flash.style.boxShadow = '0 0 25px #bae6fd, 0 0 50px #38bdf8';
      }

      this.gameMap.appendChild(flash);
      setTimeout(() => flash.remove(), 400);
    }

    // ============================================================
    // 2. ATILMA SALDIRISI (DASH / CHARGE LINE BEAM)
    // ============================================================

    /**
     * Saldıran kişinin hedef hücreye atılmasını ve hat boyunca hasar vermesini görselleştirir.
     * @param {HTMLElement} attackerEl - Saldıranın token DOM'u
     * @param {{x: number, y: number}} from - Başlangıç koordinatı
     * @param {{x: number, y: number}} to - Hedef hücre koordinatı
     * @param {number} dashWidth - Koridor genişliği (px)
     * @param {object} options - Ek seçenekler
     * @returns {Promise<void>}
     */
    playDash(attackerEl, from, to, dashWidth = 50, options = {}) {
      return new Promise((resolve) => {
        if (!this.gameMap) {
          resolve();
          return;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // 1. Koridor Enerji Işını (Dash Corridor Beam)
        const beam = document.createElement('div');
        beam.className = 'dash-corridor-beam';
        beam.style.left = `${from.x}px`;
        beam.style.top = `${from.y}px`;
        beam.style.width = `${distance}px`;
        beam.style.height = `${dashWidth}px`;
        beam.style.marginTop = `${-dashWidth / 2}px`;
        beam.style.transform = `rotate(${angle}deg)`;

        this.gameMap.appendChild(beam);
        setTimeout(() => beam.remove(), 480);

        // 2. Ghost Afterimage Clones (Gölge kopyalar)
        if (attackerEl) {
          const cloneCount = Math.min(5, Math.max(2, Math.floor(distance / 70)));
          for (let i = 1; i <= cloneCount; i++) {
            const ratio = i / (cloneCount + 1);
            const gx = from.x + dx * ratio;
            const gy = from.y + dy * ratio;

            setTimeout(() => {
              const ghost = attackerEl.cloneNode(true);
              ghost.className = (ghost.className || '') + ' dash-ghost-clone';
              ghost.removeAttribute('id');
              ghost.style.left = `${gx - (attackerEl.offsetWidth || 50) / 2}px`;
              ghost.style.top = `${gy - (attackerEl.offsetHeight || 50) / 2}px`;
              this.gameMap.appendChild(ghost);
              setTimeout(() => ghost.remove(), 380);
            }, i * 25);
          }
        }

        // 3. Token'ı hedefe doğru hızla taşı
        if (attackerEl) {
          const tWidth = attackerEl.offsetWidth || 50;
          const tHeight = attackerEl.offsetHeight || 50;
          attackerEl.style.transition = 'left 0.22s cubic-bezier(0.16, 1, 0.3, 1), top 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
          attackerEl.style.left = `${to.x - tWidth / 2}px`;
          attackerEl.style.top = `${to.y - tHeight / 2}px`;
          setTimeout(() => {
            attackerEl.style.transition = '';
          }, 240);
        }

        // 4. Varış Patlaması (Arrival Shockwave)
        setTimeout(() => {
          const burst = document.createElement('div');
          burst.className = 'dash-arrival-burst';
          burst.style.left = `${to.x}px`;
          burst.style.top = `${to.y}px`;
          this.gameMap.appendChild(burst);
          setTimeout(() => burst.remove(), 450);

          // Sarsıntı
          const mapEl = document.getElementById('game-map');
          if (mapEl) {
            mapEl.classList.remove('map-screen-shake');
            void mapEl.offsetWidth;
            mapEl.classList.add('map-screen-shake');
            setTimeout(() => mapEl.classList.remove('map-screen-shake'), 280);
          }

          resolve();
        }, 180);

        // Diğer oyunculara yayınla
        if (options.broadcast !== false && typeof socket !== 'undefined' && socket) {
          socket.emit('triggerCombatEffect', {
            type: 'dash',
            from,
            to,
            dashWidth
          });
        }
      });
    }

    // ============================================================
    // 3. İTTİRME (PUSH) & ÇEKME (PULL) HÜCRE FİZİĞİ
    // ============================================================

    /**
     * Saldırı başarılı olduğunda hedefi saldırgandan uzağa iter veya kendine çeker.
     * @param {{x: number, y: number}} attackerPos - Saldırgan merkez koordinatı
     * @param {HTMLElement} targetEl - Hedef token DOM
     * @param {string} targetTokenId - Hedef token ID (socket için)
     * @param {{pushCells?: number, pullCells?: number}} effectConfig
     */
    applyPushOrPull(attackerPos, targetEl, targetTokenId, effectConfig = {}) {
      if (!targetEl || !attackerPos) return;

      const pushCells = parseInt(effectConfig.pushCells) || 0;
      const pullCells = parseInt(effectConfig.pullCells) || 0;

      if (pushCells <= 0 && pullCells <= 0) return;

      const currentLeft = parseFloat(targetEl.style.left) || targetEl.offsetLeft || 0;
      const currentTop = parseFloat(targetEl.style.top) || targetEl.offsetTop || 0;
      const tSize = targetEl.offsetWidth || 50;
      const targetCenter = { x: currentLeft + tSize / 2, y: currentTop + tSize / 2 };

      // Hücre büyüklüğü (Grid'den oku)
      const cellSize = (window.__webdnd_grid && window.__webdnd_grid.getSettings)
        ? (window.__webdnd_grid.getSettings().size || 50)
        : 50;

      let finalLeft = currentLeft;
      let finalTop = currentTop;

      const mapW = (this.gameMap ? this.gameMap.clientWidth : 2000) - tSize;
      const mapH = (this.gameMap ? this.gameMap.clientHeight : 1500) - tSize;

      if (pushCells > 0) {
        // İttirme: Saldırgandan hedefe doğru vektör
        let dx = targetCenter.x - attackerPos.x;
        let dy = targetCenter.y - attackerPos.y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) { dx = 1; dy = 0; dist = 1; }

        const ux = dx / dist;
        const uy = dy / dist;
        const pushDistance = pushCells * cellSize;

        const rawX = currentLeft + ux * pushDistance;
        const rawY = currentTop + uy * pushDistance;

        // Izgaraya hizala
        if (window.__webdnd_grid && window.__webdnd_grid.snap) {
          const snapped = window.__webdnd_grid.snap(rawX, rawY, tSize);
          finalLeft = snapped.x;
          finalTop = snapped.y;
        } else {
          finalLeft = Math.round(rawX);
          finalTop = Math.round(rawY);
        }
      } else if (pullCells > 0) {
        // Çekme: Hedefden saldırgana doğru vektör
        let dx = attackerPos.x - targetCenter.x;
        let dy = attackerPos.y - targetCenter.y;
        let dist = Math.hypot(dx, dy);
        if (dist === 0) { dx = 0; dy = 0; dist = 1; }

        const ux = dx / dist;
        const uy = dy / dist;
        // Saldırganın içine girmemesi için mesafeyi sınırla
        const maxPull = Math.max(0, dist - cellSize);
        const pullDistance = Math.min(pullCells * cellSize, maxPull);

        const rawX = currentLeft + ux * pullDistance;
        const rawY = currentTop + uy * pullDistance;

        if (window.__webdnd_grid && window.__webdnd_grid.snap) {
          const snapped = window.__webdnd_grid.snap(rawX, rawY, tSize);
          finalLeft = snapped.x;
          finalTop = snapped.y;
        } else {
          finalLeft = Math.round(rawX);
          finalTop = Math.round(rawY);
        }
      }

      // Harita sınırlarına kenetle
      finalLeft = Math.max(0, Math.min(mapW, finalLeft));
      finalTop = Math.max(0, Math.min(mapH, finalTop));

      // Yumuşak geri tepme / çekilme animasyonu
      targetEl.classList.add('token-knockback-moving');
      targetEl.style.left = `${finalLeft}px`;
      targetEl.style.top = `${finalTop}px`;

      // Toz bulutu efekti
      this.playDustPuff(targetCenter.x, targetCenter.y);

      setTimeout(() => {
        targetEl.classList.remove('token-knockback-moving');
      }, 380);

      // Bellek ve Socket Güncellemesi
      if (typeof allPlayers !== 'undefined' && allPlayers[targetTokenId]) {
        allPlayers[targetTokenId].x = finalLeft;
        allPlayers[targetTokenId].y = finalTop;
      }
      if (window.__webdnd_markers && window.__webdnd_markers[targetTokenId]) {
        window.__webdnd_markers[targetTokenId].x = finalLeft;
        window.__webdnd_markers[targetTokenId].y = finalTop;
      }

      if (typeof socket !== 'undefined' && socket) {
        socket.emit('playerMovement', { id: targetTokenId, x: finalLeft, y: finalTop });
      }
    }

    playDustPuff(x, y) {
      if (!this.gameMap) return;
      const puff = document.createElement('div');
      puff.className = 'knockback-dust-puff';
      puff.style.left = `${x}px`;
      puff.style.top = `${y}px`;
      this.gameMap.appendChild(puff);
      setTimeout(() => puff.remove(), 400);
    }

    // ============================================================
    // 4. İNTERAKTİF HEDEF SEÇİMİ (MAP TARGETING MODES)
    // ============================================================

    /**
     * Alan Hasarlı Uzaktan Saldırı için haritada daire hedef seçtirir.
     * @param {object} config - { aoeRadius, onSelected, onCancel }
     */
    startRangedAoeTargeting(config = {}) {
      this.cancelTargeting();
      this.activeTargetingMode = 'aoe';

      if (!this.gameMap || !this.gameMapContainer) return;

      const cellSize = (window.__webdnd_grid && window.__webdnd_grid.getSettings)
        ? (window.__webdnd_grid.getSettings().size || 50)
        : 50;

      const aoeMeters = config.aoeRadius || 2;
      const aoeRadiusPx = Math.round(aoeMeters * cellSize);
      const diameter = aoeRadiusPx * 2;

      // İmleci crosshair yap
      this.gameMapContainer.classList.add('combat-targeting-active');

      // Daire Hedef Göstergesi (Reticle)
      const reticle = document.createElement('div');
      reticle.className = 'combat-targeting-reticle';
      reticle.style.width = `${diameter}px`;
      reticle.style.height = `${diameter}px`;
      this.gameMap.appendChild(reticle);

      // Yüzen bilgi rozeti
      const badge = document.createElement('div');
      badge.className = 'targeting-floating-badge';
      badge.innerHTML = `<span>💥 Hedef Alanı Seç: <strong>${aoeMeters}m (~${Math.round(aoeRadiusPx / cellSize)} hücre)</strong></span><span style="opacity:0.6;">(Tıkla: Onayla • ESC: İptal)</span>`;
      document.body.appendChild(badge);

      const updatePos = (e) => {
        const rect = this.gameMap.getBoundingClientRect();
        const zoom = window.__webdnd_zoom || 1;
        let x = (e.clientX - rect.left) / zoom;
        let y = (e.clientY - rect.top) / zoom;

        // Izgaraya hizala
        if (window.__webdnd_grid && window.__webdnd_grid.snap) {
          const snapped = window.__webdnd_grid.snap(x - cellSize / 2, y - cellSize / 2, cellSize);
          x = snapped.x + cellSize / 2;
          y = snapped.y + cellSize / 2;
        }

        reticle.style.left = `${x}px`;
        reticle.style.top = `${y}px`;

        badge.style.left = `${e.clientX + 16}px`;
        badge.style.top = `${e.clientY + 16}px`;

        // Hedeflenen tokenları canlı algıla ve vurgula
        this.highlightTokensInRadius(x, y, aoeRadiusPx);
      };

      const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = this.gameMap.getBoundingClientRect();
        const zoom = window.__webdnd_zoom || 1;
        let x = (e.clientX - rect.left) / zoom;
        let y = (e.clientY - rect.top) / zoom;

        if (window.__webdnd_grid && window.__webdnd_grid.snap) {
          const snapped = window.__webdnd_grid.snap(x - cellSize / 2, y - cellSize / 2, cellSize);
          x = snapped.x + cellSize / 2;
          y = snapped.y + cellSize / 2;
        }

        const targets = this.findTokensInRadius(x, y, aoeRadiusPx);

        this.cancelTargeting();

        if (typeof config.onSelected === 'function') {
          config.onSelected({ x, y, radius: aoeRadiusPx, targets });
        }
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          this.cancelTargeting();
          if (typeof config.onCancel === 'function') config.onCancel();
        }
      };

      this.gameMapContainer.addEventListener('mousemove', updatePos);
      this.gameMap.addEventListener('click', onClick, { once: true });
      window.addEventListener('keydown', onKey);

      this.targetingCleanup = () => {
        reticle.remove();
        badge.remove();
        this.gameMapContainer.classList.remove('combat-targeting-active');
        this.gameMapContainer.removeEventListener('mousemove', updatePos);
        window.removeEventListener('keydown', onKey);
        this.clearTargetHighlights();
      };
    }

    /**
     * Atılma Saldırısı için başlangıçtan fare hücresine giden rota koridoru çizdirir.
     * @param {object} config - { attackerPos, dashWidth, onConfirmed, onCancel }
     */
    startDashTargeting(config = {}) {
      this.cancelTargeting();
      this.activeTargetingMode = 'dash';

      if (!this.gameMap || !this.gameMapContainer) return;

      const cellSize = (window.__webdnd_grid && window.__webdnd_grid.getSettings)
        ? (window.__webdnd_grid.getSettings().size || 50)
        : 50;

      const from = config.attackerPos || { x: 100, y: 100 };
      const dashWidth = Math.max(20, config.dashWidth || cellSize);

      this.gameMapContainer.classList.add('combat-targeting-active');

      // Koridor Önizleme Elemanı
      const corridor = document.createElement('div');
      corridor.className = 'dash-target-preview-corridor';
      this.gameMap.appendChild(corridor);

      // Yüzen bilgi rozeti
      const badge = document.createElement('div');
      badge.className = 'targeting-floating-badge';
      badge.innerHTML = `<span>⚡ Atılma Hedefi Seç</span>`;
      document.body.appendChild(badge);

      const updatePos = (e) => {
        const rect = this.gameMap.getBoundingClientRect();
        const zoom = window.__webdnd_zoom || 1;
        let mouseX = (e.clientX - rect.left) / zoom;
        let mouseY = (e.clientY - rect.top) / zoom;

        // Hedef hücre merkezini bul
        let targetX = mouseX;
        let targetY = mouseY;
        if (window.__webdnd_grid && window.__webdnd_grid.snap) {
          const snapped = window.__webdnd_grid.snap(mouseX - cellSize / 2, mouseY - cellSize / 2, cellSize);
          targetX = snapped.x + cellSize / 2;
          targetY = snapped.y + cellSize / 2;
        }

        const dx = targetX - from.x;
        const dy = targetY - from.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const cellCount = Math.round(distance / cellSize);

        corridor.style.left = `${from.x}px`;
        corridor.style.top = `${from.y}px`;
        corridor.style.width = `${distance}px`;
        corridor.style.height = `${dashWidth}px`;
        corridor.style.marginTop = `${-dashWidth / 2}px`;
        corridor.style.transform = `rotate(${angle}deg)`;

        badge.style.left = `${e.clientX + 16}px`;
        badge.style.top = `${e.clientY + 16}px`;

        // Koridor üzerindeki hedefleri bul
        const caughtTargets = this.highlightTokensInCorridor(from, { x: targetX, y: targetY }, dashWidth);
        badge.innerHTML = `<span>⚡ Atılma: <strong>${cellCount} Hücre (${cellCount * 5} ft)</strong> • <strong>${caughtTargets.length} Hedef</strong></span><span style="opacity:0.6;">(Tıkla: Onayla • ESC: İptal)</span>`;
      };

      const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = this.gameMap.getBoundingClientRect();
        const zoom = window.__webdnd_zoom || 1;
        let mouseX = (e.clientX - rect.left) / zoom;
        let mouseY = (e.clientY - rect.top) / zoom;

        let targetX = mouseX;
        let targetY = mouseY;
        if (window.__webdnd_grid && window.__webdnd_grid.snap) {
          const snapped = window.__webdnd_grid.snap(mouseX - cellSize / 2, mouseY - cellSize / 2, cellSize);
          targetX = snapped.x + cellSize / 2;
          targetY = snapped.y + cellSize / 2;
        }

        const targets = this.findTokensInCorridor(from, { x: targetX, y: targetY }, dashWidth);

        this.cancelTargeting();

        if (typeof config.onConfirmed === 'function') {
          config.onConfirmed({ destX: targetX, destY: targetY, targets });
        }
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          this.cancelTargeting();
          if (typeof config.onCancel === 'function') config.onCancel();
        }
      };

      this.gameMapContainer.addEventListener('mousemove', updatePos);
      this.gameMap.addEventListener('click', onClick, { once: true });
      window.addEventListener('keydown', onKey);

      this.targetingCleanup = () => {
        corridor.remove();
        badge.remove();
        this.gameMapContainer.classList.remove('combat-targeting-active');
        this.gameMapContainer.removeEventListener('mousemove', updatePos);
        window.removeEventListener('keydown', onKey);
        this.clearTargetHighlights();
      };
    }

    cancelTargeting() {
      if (typeof this.targetingCleanup === 'function') {
        this.targetingCleanup();
      }
      this.targetingCleanup = null;
      this.activeTargetingMode = null;
    }

    // ============================================================
    // YARDIMCI HESAPLAMA METOTLARI
    // ============================================================

    findTokensInRadius(cx, cy, radius) {
      const targets = [];
      if (!this.gameMap) return targets;

      const tokenEls = this.gameMap.querySelectorAll('.token');
      tokenEls.forEach(el => {
        const id = el.dataset.id;
        if (!id) return;
        const left = parseFloat(el.style.left) || el.offsetLeft || 0;
        const top = parseFloat(el.style.top) || el.offsetTop || 0;
        const size = parseFloat(el.dataset?.size) || el.offsetWidth || 50;
        const tCx = left + size / 2;
        const tCy = top + size / 2;

        if (Math.hypot(tCx - cx, tCy - cy) <= (radius + (size / 2) * 0.75)) {
          const resolved = this.resolveTargetData(id, tCx, tCy, el);
          if (resolved) targets.push(resolved);
        }
      });
      return targets;
    }

    highlightTokensInRadius(cx, cy, radius) {
      if (!this.gameMap) return [];
      const tokenEls = this.gameMap.querySelectorAll('.token');
      const inside = [];
      tokenEls.forEach(el => {
        const left = parseFloat(el.style.left) || el.offsetLeft || 0;
        const top = parseFloat(el.style.top) || el.offsetTop || 0;
        const size = parseFloat(el.dataset?.size) || el.offsetWidth || 50;
        const tCx = left + size / 2;
        const tCy = top + size / 2;

        if (Math.hypot(tCx - cx, tCy - cy) <= (radius + (size / 2) * 0.75)) {
          el.classList.add('token-corridor-targeted');
          inside.push(el);
        } else {
          el.classList.remove('token-corridor-targeted');
        }
      });
      return inside;
    }

    findTokensInCorridor(from, to, width) {
      const targets = [];
      if (!this.gameMap) return targets;

      const tokenEls = this.gameMap.querySelectorAll('.token');
      tokenEls.forEach(el => {
        const id = el.dataset.id;
        if (!id) return;
        const left = parseFloat(el.style.left) || el.offsetLeft || 0;
        const top = parseFloat(el.style.top) || el.offsetTop || 0;
        const size = parseFloat(el.dataset?.size) || el.offsetWidth || 50;
        const tCx = left + size / 2;
        const tCy = top + size / 2;

        const dist = this.distToSegment(tCx, tCy, from.x, from.y, to.x, to.y);
        if (dist <= (width / 2 + (size / 2) * 0.7)) {
          const resolved = this.resolveTargetData(id, tCx, tCy, el);
          if (resolved) targets.push(resolved);
        }
      });
      return targets;
    }

    highlightTokensInCorridor(from, to, width) {
      if (!this.gameMap) return [];
      const tokenEls = this.gameMap.querySelectorAll('.token');
      const inside = [];

      tokenEls.forEach(el => {
        const left = parseFloat(el.style.left) || el.offsetLeft || 0;
        const top = parseFloat(el.style.top) || el.offsetTop || 0;
        const size = parseFloat(el.dataset?.size) || el.offsetWidth || 50;
        const tCx = left + size / 2;
        const tCy = top + size / 2;

        const dist = this.distToSegment(tCx, tCy, from.x, from.y, to.x, to.y);
        if (dist <= (width / 2 + (size / 2) * 0.7)) {
          el.classList.add('token-corridor-targeted');
          inside.push(el);
        } else {
          el.classList.remove('token-corridor-targeted');
        }
      });
      return inside;
    }

    clearTargetHighlights() {
      if (!this.gameMap) return;
      this.gameMap.querySelectorAll('.token-corridor-targeted').forEach(el => {
        el.classList.remove('token-corridor-targeted');
      });
    }

    distToSegment(px, py, x1, y1, x2, y2) {
      const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      let u = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      u = Math.max(0, Math.min(1, u));
      return Math.hypot(px - (x1 + u * (x2 - x1)), py - (y1 + u * (y2 - y1)));
    }

    resolveTargetData(idStr, cx, cy, el) {
      // 1. Marker mı?
      if (window.__webdnd_markers && window.__webdnd_markers[idStr]) {
        const m = window.__webdnd_markers[idStr];
        return {
          type: 'marker',
          id: m.id,
          name: m.name || 'Marker',
          hp: m.hp,
          maxHp: m.maxHp,
          imgUrl: m.imgUrl || null,
          color: m.color || '#e74c3c',
          x: cx,
          y: cy,
          tokenEl: el
        };
      }
      // 2. Oyuncu karakteri mi?
      if (typeof allPlayers !== 'undefined' && allPlayers[idStr]) {
        const p = allPlayers[idStr];
        if (p.character) {
          return {
            type: 'character',
            id: p.character.id,
            playerId: p.id,
            name: p.character.name || 'Player',
            hp: p.character.hp_current,
            maxHp: p.character.hp_max,
            imgUrl: p.character.avatar_url || p.imgUrl || null,
            color: p.color || '#3498db',
            x: cx,
            y: cy,
            tokenEl: el
          };
        }
      }
      return null;
    }

    // ============================================================
    // 5. GELEN SOCKET EFEKTİNİ İŞLEME (BROADCAST HANDLER)
    // ============================================================

    handleIncomingEffect(data) {
      if (!data || !data.type) return;

      const key = `${data.type}:${JSON.stringify(data.from || {})}:${JSON.stringify(data.to || {})}`;
      if (this.recentEffects.has(key)) return;
      this.recentEffects.add(key);
      setTimeout(() => this.recentEffects.delete(key), 1200);

      if (data.type === 'projectile') {
        this.playProjectile(data.from, data.to, { ...data.options, broadcast: false });
      } else if (data.type === 'dash') {
        this.playDash(null, data.from, data.to, data.dashWidth, { broadcast: false });
      }
    }
  }

  // Singleton instance
  window.__webdnd_combat_effects = new CombatEffectsEngine();
})();
