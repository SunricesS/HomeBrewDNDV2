/**
 * WebDND — Modern Panel & Detachable Modules Manager
 * Handles:
 *  1. 4-Tab Sidebar Navigation (Dice & Log, Combat, Bestiary, Map)
 *  2. Accordion Collapsible & Reorderable PanelModules
 *  3. Detachable Draggable Floating Windows (Pop-out to Canvas)
 *  4. Damage Channels Space-Saving Mini-Tabs (Physical, Fire, Cold)
 *  5. Contextual DM Pen Toolbar Swatch
 *  6. Quick Monster Summon Command Palette (Ctrl + K)
 */

(function () {
  'use strict';

  const STORAGE_TAB_KEY = 'webdnd_active_sidebar_tab';
  const STORAGE_COLLAPSED_KEY = 'webdnd_modules_collapsed';
  const STORAGE_ORDER_KEY = 'webdnd_tab_module_order';
  const STORAGE_FLOATING_KEY = 'webdnd_floating_windows';

  class PanelManager {
    constructor() {
      this.activeTab = localStorage.getItem(STORAGE_TAB_KEY) || 'combat';
      this.collapsedStates = {};
      this.tabOrders = {};
      this.floatingStates = {};
      this.floatingWindows = new Map(); // moduleId -> HTMLElement

      try {
        this.collapsedStates = JSON.parse(localStorage.getItem(STORAGE_COLLAPSED_KEY) || '{}');
        this.tabOrders = JSON.parse(localStorage.getItem(STORAGE_ORDER_KEY) || '{}');
        this.floatingStates = JSON.parse(localStorage.getItem(STORAGE_FLOATING_KEY) || '{}');
      } catch (e) {
        console.warn('[PanelManager] Failed to parse localStorage state:', e);
      }

      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    setup() {
      this.createFloatingLayer();
      this.setupTabs();
      this.setupModules();
      this.setupCanvasDropZone();
      this.setupDamageChannelMiniTabs();
      this.setupDmPenToolbar();
      this.setupCommandPalette();
      this.setupShortcutsGuide();
    }

    // ============================================================
    // 1. FLOATING WINDOWS LAYER (ON CANVAS)
    // ============================================================
    createFloatingLayer() {
      let layer = document.getElementById('floating-windows-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'floating-windows-layer';
        layer.className = 'floating-windows-layer';
        
        const gameMap = document.getElementById('game-map');
        if (gameMap) {
          gameMap.appendChild(layer);
        } else {
          document.body.appendChild(layer);
        }
      }
      this.floatingLayer = layer;
    }

    // ============================================================
    // 2. TABBED SIDEBAR (4 MAIN TABS)
    // ============================================================
    setupTabs() {
      const tabBtns = document.querySelectorAll('.panel-tab-btn');
      const tabContents = document.querySelectorAll('.panel-tab-content');

      if (!tabBtns.length) return;

      const activateTab = (tabId) => {
        this.activeTab = tabId;
        localStorage.setItem(STORAGE_TAB_KEY, tabId);

        tabBtns.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-tab-target') === tabId);
        });

        tabContents.forEach(content => {
          content.classList.toggle('active', content.getAttribute('data-tab-content') === tabId);
        });

        if (tabId === 'tokens' && typeof window.renderMapTokensList === 'function') {
          window.renderMapTokensList();
        }

        const panel = document.getElementById('control-panel');
        if (panel) panel.scrollTop = 0;
      };

      // Check role
      const role = sessionStorage.getItem('dnd_role');
      const playerTabBtn = document.getElementById('tab-btn-player');
      const playerInfoPanel = document.getElementById('player-info-panel');

      if (role !== 'dm') {
        // Player mode: show dice-log and player tabs only
        tabBtns.forEach(btn => {
          const target = btn.getAttribute('data-tab-target');
          if (target === 'combat' || target === 'tokens' || target === 'map') {
            btn.style.display = 'none';
          }
        });
        if (playerTabBtn) {
          playerTabBtn.style.display = 'flex';
          playerTabBtn.addEventListener('click', (e) => {
            e.preventDefault();
            tabBtns.forEach(b => b.classList.remove('active'));
            playerTabBtn.classList.add('active');
            tabContents.forEach(c => c.classList.remove('active'));
            if (playerInfoPanel) playerInfoPanel.classList.remove('hidden');
          });
        }
      } else {
        if (playerTabBtn) playerTabBtn.style.display = 'none';
      }

      tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.getAttribute('data-tab-target');
          if (target && target !== 'player') {
            if (playerInfoPanel && role !== 'dm') playerInfoPanel.classList.add('hidden');
            activateTab(target);
          }
        });
      });

      // Restore active tab or default
      let defaultTab = (role !== 'dm') ? 'dice-log' : this.activeTab;
      const tabExists = document.querySelector(`.panel-tab-content[data-tab-content="${defaultTab}"]`);
      if (!tabExists) defaultTab = (role !== 'dm') ? 'dice-log' : 'combat';
      activateTab(defaultTab);
    }

    // ============================================================
    // 3. PANEL MODULES (ACCORDION + REORDER + POP-OUT)
    // ============================================================
    // Helper to get correct container for modules within a tab
    getModuleContainer(tabContent) {
      if (!tabContent) return null;
      const attackContainer = tabContent.querySelector('#attack-panel-container');
      return attackContainer || tabContent;
    }

    getTabIdForModule(mod) {
      const tabContent = mod.closest('.panel-tab-content');
      return tabContent ? tabContent.getAttribute('data-tab-content') : null;
    }

    // ============================================================
    // 3. PANEL MODULES (ACCORDION + REORDER + POP-OUT)
    // ============================================================
    setupModules() {
      const modules = document.querySelectorAll('.panel-module');
      const tabContainers = document.querySelectorAll('.panel-tab-content');

      // 3.1. Reorder modules based on saved preference per tab
      tabContainers.forEach(tabContent => {
        const tabId = tabContent.getAttribute('data-tab-content');
        if (!tabId) return;

        const container = this.getModuleContainer(tabContent);
        const savedOrder = this.tabOrders[tabId];
        if (Array.isArray(savedOrder) && savedOrder.length) {
          const stickyBar = container.querySelector('.tab-sticky-attack-bar');
          savedOrder.forEach(modId => {
            const modEl = container.querySelector(`:scope > .panel-module[data-module-id="${modId}"]`);
            if (modEl) {
              if (stickyBar) {
                container.insertBefore(modEl, stickyBar);
              } else {
                container.appendChild(modEl);
              }
            }
          });

          // Also append any new modules not in savedOrder to ensure they are rendered at the bottom before stickyBar
          const allModules = Array.from(container.querySelectorAll(':scope > .panel-module'));
          allModules.forEach(modEl => {
            const mId = modEl.getAttribute('data-module-id');
            if (mId && !savedOrder.includes(mId)) {
              if (stickyBar) {
                container.insertBefore(modEl, stickyBar);
              } else {
                container.appendChild(modEl);
              }
            }
          });
        }
      });

      // 3.2. Initialize each module
      modules.forEach(mod => {
        const modId = mod.getAttribute('data-module-id');
        if (!modId) return;

        const header = mod.querySelector('.panel-module-header');
        const collapseBtn = mod.querySelector('.module-collapse-btn');
        const popoutBtn = mod.querySelector('.module-popout-btn');
        const upBtn = mod.querySelector('.module-reorder-up');
        const downBtn = mod.querySelector('.module-reorder-down');
        const dragHandle = mod.querySelector('.panel-module-drag-handle');
        const dockedNotice = mod.querySelector('.panel-module-docked-notice');
        const dockBackBtn = dockedNotice ? dockedNotice.querySelector('.btn-dock-back-inline') : null;

        // Restore collapsed state
        if (this.collapsedStates[modId]) {
          mod.classList.add('is-collapsed');
        }

        // Toggle Accordion on header click
        if (header) {
          header.addEventListener('click', (e) => {
            if (e.target.closest('.panel-module-actions, .panel-module-drag-handle, button, input, select')) return;
            this.toggleCollapse(mod, modId);
          });
        }

        if (collapseBtn) {
          collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCollapse(mod, modId);
          });
        }

        // Reorder Up
        if (upBtn) {
          upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveModule(mod, 'up');
          });
        }

        // Reorder Down
        if (downBtn) {
          downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.moveModule(mod, 'down');
          });
        }

        // Pop-out / Detach
        if (popoutBtn) {
          popoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.popOutModule(mod, modId);
          });
        }

        // Dock back inline button
        if (dockBackBtn) {
          dockBackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dockModule(modId);
          });
        }

        // Robust HTML5 Drag and Drop for reordering AND detaching to canvas
        if (header) {
          header.setAttribute('draggable', 'true');

          header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.panel-module-actions, .panel-module-btn, button, input, select')) {
              header.setAttribute('draggable', 'false');
            } else {
              header.setAttribute('draggable', 'true');
            }
          });

          header.addEventListener('dragstart', (e) => {
            if (e.target.closest('.panel-module-actions, .panel-module-btn, button, input, select') || header.getAttribute('draggable') !== 'true') {
              e.preventDefault();
              return;
            }

            mod.classList.add('dragging');
            window.__webdnd_draggingModuleId = modId;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', modId);
            e.dataTransfer.setData('application/webdnd-module', modId);

            if (dragHandle) dragHandle.style.cursor = 'grabbing';

            this.showCanvasDropIndicator(mod);
          });

          header.addEventListener('dragend', () => {
            mod.classList.remove('dragging');
            header.setAttribute('draggable', 'true');
            window.__webdnd_draggingModuleId = null;
            if (dragHandle) dragHandle.style.cursor = 'grab';

            this.hideCanvasDropIndicator();

            const tabId = this.getTabIdForModule(mod);
            if (tabId && mod.parentElement) {
              this.saveTabOrder(tabId, mod.parentElement);
            }
          });
        }

        // Check if was previously popped out
        if (this.floatingStates[modId] && this.floatingStates[modId].open) {
          setTimeout(() => this.popOutModule(mod, modId, this.floatingStates[modId]), 100);
        }
      });

      // Tab container dragover to handle sorting within its module container
      tabContainers.forEach(tabContent => {
        const container = this.getModuleContainer(tabContent);
        if (!container) return;

        container.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const draggingEl = container.querySelector('.panel-module.dragging');
          if (!draggingEl) return;

          const afterElement = getDragAfterElement(container, e.clientY);
          const stickyBar = container.querySelector('.tab-sticky-attack-bar');

          if (afterElement == null) {
            if (stickyBar) {
              container.insertBefore(draggingEl, stickyBar);
            } else {
              container.appendChild(draggingEl);
            }
          } else {
            container.insertBefore(draggingEl, afterElement);
          }
        });

        container.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.hideCanvasDropIndicator();
          const tabId = tabContent.getAttribute('data-tab-content');
          if (tabId) {
            this.saveTabOrder(tabId, container);
          }
        });
      });

      function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll(':scope > .panel-module:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          } else {
            return closest;
          }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
      }
    }

    toggleCollapse(mod, modId) {
      const isCollapsed = mod.classList.toggle('is-collapsed');
      this.collapsedStates[modId] = isCollapsed;
      localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify(this.collapsedStates));
    }

    moveModule(mod, direction) {
      if (!mod) return;
      const parent = mod.parentElement;
      if (!parent) return;

      if (direction === 'up') {
        const prev = mod.previousElementSibling;
        if (prev && prev.classList.contains('panel-module')) {
          prev.before(mod);
          this.pulseModule(mod);
        }
      } else if (direction === 'down') {
        const next = mod.nextElementSibling;
        if (next && next.classList.contains('panel-module')) {
          next.after(mod);
          this.pulseModule(mod);
        }
      }

      const tabId = this.getTabIdForModule(mod);
      if (tabId) {
        this.saveTabOrder(tabId, parent);
      }
    }

    saveTabOrder(tabId, container) {
      if (!tabId || !container) return;
      const order = [...container.querySelectorAll(':scope > .panel-module')]
        .map(m => m.getAttribute('data-module-id'))
        .filter(Boolean);
      this.tabOrders[tabId] = order;
      localStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(this.tabOrders));
    }

    pulseModule(mod) {
      if (!mod) return;
      mod.classList.remove('module-reorder-pulse');
      void mod.offsetWidth; // trigger reflow
      mod.classList.add('module-reorder-pulse');
      setTimeout(() => mod.classList.remove('module-reorder-pulse'), 500);
    }


    // ============================================================
    // 4. FLOATING WINDOWS (DETACHABLE / POP-OUT TO CANVAS)
    // ============================================================
    popOutModule(mod, modId, savedPos = null) {
      if (this.floatingWindows.has(modId)) {
        // Already popped out, bring to front and update position if given
        const win = this.floatingWindows.get(modId);
        if (savedPos && savedPos.left != null && savedPos.top != null) {
          win.style.left = `${savedPos.left}px`;
          win.style.top = `${savedPos.top}px`;
          if (this.floatingStates[modId]) {
            this.floatingStates[modId].left = savedPos.left;
            this.floatingStates[modId].top = savedPos.top;
            localStorage.setItem(STORAGE_FLOATING_KEY, JSON.stringify(this.floatingStates));
          }
        }
        this.bringWindowToFront(win);
        return;
      }

      const titleEl = mod.querySelector('.panel-module-title');
      const iconEl = mod.querySelector('.panel-module-icon');
      const title = titleEl ? titleEl.textContent : 'Module';
      const icon = iconEl ? iconEl.textContent : '📦';
      const body = mod.querySelector('.panel-module-body');
      const dockedNotice = mod.querySelector('.panel-module-docked-notice');

      if (!body) return;

      // Position: default or restored
      let left = 140;
      let top = 90;
      if (savedPos && savedPos.left != null && savedPos.top != null) {
        left = savedPos.left;
        top = savedPos.top;
      } else {
        // Cascade windows
        const count = this.floatingWindows.size;
        left = 120 + (count * 30);
        top = 70 + (count * 30);
      }

      // Keep within bounds
      left = Math.max(10, Math.min(left, window.innerWidth - 380));
      top = Math.max(10, Math.min(top, window.innerHeight - 300));

      // Create Floating Window Element
      const win = document.createElement('div');
      win.className = 'floating-panel-window active-window';
      win.id = `popout-${modId}`;
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;

      win.innerHTML = `
        <div class="floating-window-header">
          <div class="floating-window-title">
            <span class="floating-icon">${icon}</span>
            <span>${title}</span>
          </div>
          <div class="floating-window-actions">
            <button type="button" class="floating-btn floating-btn-dock" title="Panele Geri Sabitle">⤓</button>
            <button type="button" class="floating-btn floating-btn-close" title="Kapat">✕</button>
          </div>
        </div>
        <div class="floating-window-body"></div>
      `;

      // Crucial: Stop all clicks & pointer events on floating window from propagating to canvas
      const stopAllCanvasEvents = (e) => {
        e.stopPropagation();
      };
      win.addEventListener('pointerdown', stopAllCanvasEvents);
      win.addEventListener('mousedown', stopAllCanvasEvents);
      win.addEventListener('click', stopAllCanvasEvents);
      win.addEventListener('touchstart', stopAllCanvasEvents, { passive: true });

      // Move module body content into floating window
      const winBody = win.querySelector('.floating-window-body');
      while (body.firstChild) {
        winBody.appendChild(body.firstChild);
      }

      // Hide sidebar body & show docked notice
      body.style.display = 'none';
      if (dockedNotice) dockedNotice.classList.remove('hidden');

      // Dock & Close handlers
      const dockBtn = win.querySelector('.floating-btn-dock');
      const closeBtn = win.querySelector('.floating-btn-close');

      dockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dockModule(modId);
      });

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dockModule(modId);
      });

      // Draggable behavior on window header
      this.makeWindowDraggable(win, modId);

      // Add to DOM layer
      this.floatingLayer.appendChild(win);
      this.floatingWindows.set(modId, win);
      this.bringWindowToFront(win);

      // Save state
      this.floatingStates[modId] = { open: true, left: left, top: top };
      localStorage.setItem(STORAGE_FLOATING_KEY, JSON.stringify(this.floatingStates));

      this.showToast(`🪟 "${title}" yüzen pencereye dönüştürüldü.`);
    }

    dockModule(modId) {
      const win = this.floatingWindows.get(modId);
      if (!win) return;

      const mod = document.querySelector(`.panel-module[data-module-id="${modId}"]`);
      if (mod) {
        const body = mod.querySelector('.panel-module-body');
        const dockedNotice = mod.querySelector('.panel-module-docked-notice');
        const winBody = win.querySelector('.floating-window-body');

        // Move all content back into original module body
        if (body && winBody) {
          while (winBody.firstChild) {
            body.appendChild(winBody.firstChild);
          }
          body.style.display = '';
        }

        if (dockedNotice) dockedNotice.classList.add('hidden');
        mod.classList.remove('is-collapsed');

        const titleEl = mod.querySelector('.panel-module-title');
        const title = titleEl ? titleEl.textContent : 'Modül';
        this.showToast(`⤓ "${title}" sağ panele geri sabitlendi.`);
      }

      // Remove floating window
      win.remove();
      this.floatingWindows.delete(modId);

      // Update state
      if (this.floatingStates[modId]) {
        this.floatingStates[modId].open = false;
        localStorage.setItem(STORAGE_FLOATING_KEY, JSON.stringify(this.floatingStates));
      }
    }

    makeWindowDraggable(win, modId) {
      const header = win.querySelector('.floating-window-header');
      if (!header) return;

      let isDragging = false;
      let startX, startY;
      let initialLeft, initialTop;

      const onPointerDown = (e) => {
        if (e.target.closest('.floating-btn')) return;
        isDragging = true;
        this.bringWindowToFront(win);

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(win.style.left, 10) || win.offsetLeft;
        initialTop = parseInt(win.style.top, 10) || win.offsetTop;

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        e.preventDefault();
        e.stopPropagation();
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        // Boundaries
        newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - win.offsetWidth - 10));
        newTop = Math.max(10, Math.min(newTop, window.innerHeight - 80));

        win.style.left = `${newLeft}px`;
        win.style.top = `${newTop}px`;

        // Check if hovering near the right sidebar (dock target cue)
        const cp = document.getElementById('control-panel') || document.getElementById('modern-control-panel');
        if (cp) {
          const cpRect = cp.getBoundingClientRect();
          if (e.clientX >= cpRect.left - 20) {
            cp.classList.add('dock-target-hover');
          } else {
            cp.classList.remove('dock-target-hover');
          }
        }

        e.stopPropagation();
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);

        // Remove dock target highlight on right panel
        const cp = document.getElementById('control-panel') || document.getElementById('modern-control-panel');
        if (cp) {
          cp.classList.remove('dock-target-hover');
          const cpRect = cp.getBoundingClientRect();
          // If dropped over the right sidebar, re-dock automatically!
          if (e.clientX >= cpRect.left - 20) {
            this.dockModule(modId);
            if (e) e.stopPropagation();
            return;
          }
        }

        // Save position
        if (this.floatingStates[modId]) {
          this.floatingStates[modId].left = parseInt(win.style.left, 10);
          this.floatingStates[modId].top = parseInt(win.style.top, 10);
          localStorage.setItem(STORAGE_FLOATING_KEY, JSON.stringify(this.floatingStates));
        }
        if (e) e.stopPropagation();
      };

      header.addEventListener('pointerdown', onPointerDown);
    }

    // ============================================================
    // CANVAS DROP ZONE FOR DETACHING MODULES
    // ============================================================
    setupCanvasDropZone() {
      const gameMap = document.getElementById('game-map');
      if (!gameMap) return;

      let dropOverlay = document.getElementById('map-undock-drop-overlay');
      if (!dropOverlay) {
        dropOverlay = document.createElement('div');
        dropOverlay.id = 'map-undock-drop-overlay';
        dropOverlay.className = 'map-undock-drop-overlay hidden';
        dropOverlay.innerHTML = `
          <div class="map-undock-drop-box">
            <div class="map-undock-drop-icon">🪟</div>
            <div class="map-undock-drop-text">Buraya Bırakarak Yüzen Pencere Yap</div>
            <div class="map-undock-drop-sub">Modül harita üzerinde bağımsız pencereye dönüşür</div>
          </div>
        `;
        gameMap.appendChild(dropOverlay);
      }

      gameMap.addEventListener('dragover', (e) => {
        const isModule = window.__webdnd_draggingModuleId ||
                         e.dataTransfer.types.includes('application/webdnd-module') ||
                         document.querySelector('.panel-module.dragging');

        if (!isModule) return;

        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (dropOverlay.classList.contains('hidden')) {
          dropOverlay.classList.remove('hidden');
        }

        const box = dropOverlay.querySelector('.map-undock-drop-box');
        if (box) {
          const rect = gameMap.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          box.style.left = `${x}px`;
          box.style.top = `${y}px`;
        }
      });

      gameMap.addEventListener('dragleave', (e) => {
        if (!gameMap.contains(e.relatedTarget)) {
          dropOverlay.classList.add('hidden');
        }
      });

      gameMap.addEventListener('drop', (e) => {
        dropOverlay.classList.add('hidden');

        const draggingEl = document.querySelector('.panel-module.dragging');
        const modId = e.dataTransfer.getData('application/webdnd-module') ||
                      e.dataTransfer.getData('text/plain') ||
                      window.__webdnd_draggingModuleId ||
                      (draggingEl ? draggingEl.getAttribute('data-module-id') : null);

        if (!modId) return;

        e.preventDefault();
        e.stopPropagation();

        const mod = document.querySelector(`.panel-module[data-module-id="${modId}"]`);
        if (!mod) return;

        // Position window with center-ish offset under cursor
        const dropX = Math.max(15, Math.min(e.clientX - 180, window.innerWidth - 380));
        const dropY = Math.max(15, Math.min(e.clientY - 25, window.innerHeight - 250));

        this.popOutModule(mod, modId, { left: dropX, top: dropY });
      });
    }

    showCanvasDropIndicator(mod) {
      const dropOverlay = document.getElementById('map-undock-drop-overlay');
      if (dropOverlay) {
        dropOverlay.classList.remove('hidden');
        const titleEl = mod ? mod.querySelector('.panel-module-title') : null;
        const textEl = dropOverlay.querySelector('.map-undock-drop-text');
        if (textEl && titleEl) {
          textEl.textContent = `"${titleEl.textContent}" Yüzen Pencere Yap`;
        }
      }
    }

    hideCanvasDropIndicator() {
      const dropOverlay = document.getElementById('map-undock-drop-overlay');
      if (dropOverlay) {
        dropOverlay.classList.add('hidden');
      }
    }

    showToast(messageHtml) {
      const container = document.getElementById('game-map') || document.body;
      const toast = document.createElement('div');
      toast.className = 'dice-toast';
      toast.style.zIndex = '9999';
      toast.innerHTML = messageHtml;
      container.appendChild(toast);
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 2500);
    }

    bringWindowToFront(activeWin) {
      document.querySelectorAll('.floating-panel-window').forEach(w => {
        w.classList.remove('active-window');
      });
      activeWin.classList.add('active-window');

      let maxZ = 1000;
      document.querySelectorAll('.floating-panel-window').forEach(w => {
        const z = parseInt(window.getComputedStyle(w).zIndex, 10) || 1000;
        if (z > maxZ) maxZ = z;
      });
      activeWin.style.zIndex = maxZ + 2;
    }

    // ============================================================
    // 5. DAMAGE CHANNELS MINI-TABS (SPACE SAVING)
    // ============================================================
    setupDamageChannelMiniTabs() {
      const channelTabs = document.querySelectorAll('.damage-channel-tab-btn');
      const channels = document.querySelectorAll('.atk-damage-channel');

      if (!channelTabs.length || !channels.length) return;

      const showChannel = (channelKey) => {
        channelTabs.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-channel-tab') === channelKey);
        });

        channels.forEach(ch => {
          const chKey = ch.getAttribute('data-channel');
          if (chKey === channelKey) {
            ch.style.display = 'block';
          } else {
            ch.style.display = 'none';
          }
        });
      };

      channelTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const key = btn.getAttribute('data-channel-tab');
          if (key) showChannel(key);
        });
      });

      // Default to physical
      showChannel('phys');

      // Observe dice badge changes to show indicator dot
      const checkActiveDice = () => {
        ['phys', 'elem1', 'elem2'].forEach(key => {
          const badgesEl = document.getElementById(`atk-${key}-badges`);
          const dot = document.querySelector(`.channel-has-dice-dot[data-channel-dot="${key}"]`);
          if (badgesEl && dot) {
            const hasDice = badgesEl.querySelectorAll('.atk-pool-die-badge').length > 0;
            dot.classList.toggle('visible', hasDice);
          }
        });
      };

      // Poll or observe dice badges
      setInterval(checkActiveDice, 1000);
    }

    // ============================================================
    // 6. CONTEXTUAL DM PEN TOOLBAR INTEGRATION
    // ============================================================
    setupDmPenToolbar() {
      const penColorInput = document.getElementById('dm-pen-color');
      const swatchBtn = document.getElementById('map-draw-pen-swatch-btn');

      if (!penColorInput) return;

      const updateColor = (color) => {
        if (swatchBtn) {
          swatchBtn.style.backgroundColor = color;
        }

        // Socket emit to sync token appearance
        if (typeof socket !== 'undefined' && socket && socket.emit) {
          socket.emit('updateTokenAppearance', { color: color });
        }

        // Update local player color
        if (typeof allPlayers !== 'undefined' && typeof myId !== 'undefined' && allPlayers && allPlayers[myId]) {
          allPlayers[myId].color = color;
        }

        // Also update map draw color if drawing tool active
        if (typeof setDrawColor === 'function') {
          setDrawColor(color);
        }
      };

      penColorInput.addEventListener('input', (e) => updateColor(e.target.value));
      penColorInput.addEventListener('change', (e) => updateColor(e.target.value));

      // Initial color
      if (swatchBtn && penColorInput.value) {
        swatchBtn.style.backgroundColor = penColorInput.value;
      }
    }

    // ============================================================
    // 7. QUICK MONSTER SUMMON COMMAND PALETTE (CTRL + K)
    // ============================================================
    setupCommandPalette() {
      let modal = document.getElementById('quick-command-palette-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quick-command-palette-modal';
        modal.className = 'cmd-palette-backdrop hidden';
        modal.innerHTML = `
          <div class="cmd-palette-container" id="cmd-palette-container">
            <div class="cmd-palette-header">
              <span class="cmd-palette-search-icon">🔍</span>
              <input type="text" id="cmd-palette-input" class="cmd-palette-input"
                placeholder="Canavar veya şablon ara... (Enter: Merkezde Spawn, Shift+Enter: Yerleştir)"
                autocomplete="off" spellcheck="false">
              <span class="cmd-palette-badge">ESC</span>
            </div>
            <div class="cmd-palette-results" id="cmd-palette-results"></div>
            <div class="cmd-palette-footer">
              <div class="cmd-footer-keys">
                <span class="cmd-footer-key"><kbd>↑</kbd><kbd>↓</kbd> Gezin</span>
                <span class="cmd-footer-key"><kbd>Enter</kbd> Spawn (Merkez)</span>
                <span class="cmd-footer-key"><kbd>Shift</kbd>+<kbd>Enter</kbd> Yerleştir</span>
              </div>
              <div><kbd>Esc</kbd> Kapat</div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const input = document.getElementById('cmd-palette-input');
      const resultsContainer = document.getElementById('cmd-palette-results');
      let selectedIndex = 0;
      let currentFilteredPresets = [];

      const openPalette = () => {
        modal.classList.remove('hidden');
        if (input) {
          input.value = '';
          input.focus();
        }
        renderResults('');
      };

      const closePalette = () => {
        modal.classList.add('hidden');
      };

      // Keyboard shortcut Ctrl + K or Cmd + K
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          if (modal.classList.contains('hidden')) {
            openPalette();
          } else {
            closePalette();
          }
        } else if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          closePalette();
        }
      });

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closePalette();
      });

      // Filter and render monster list
      const renderResults = (query = '') => {
        const q = query.toLowerCase().trim();
        // Presets from client.js
        const presets = (typeof currentTokenPresets !== 'undefined' && Array.isArray(currentTokenPresets)) 
          ? currentTokenPresets 
          : (window.__currentTokenPresets || []);

        // Default creature catalog if no custom presets yet
        const defaultCreatures = [
          { name: 'Goblin', hp: 7, ac: 15, size: 40, color: '#22c55e', imgUrl: '' },
          { name: 'Orc Warrior', hp: 15, ac: 13, size: 50, color: '#dc2626', imgUrl: '' },
          { name: 'Skeleton Archer', hp: 13, ac: 13, size: 45, color: '#cbd5e1', imgUrl: '' },
          { name: 'Zombie', hp: 22, ac: 8, size: 50, color: '#84cc16', imgUrl: '' },
          { name: 'Dire Wolf', hp: 37, ac: 14, size: 70, color: '#64748b', imgUrl: '' },
          { name: 'Young Red Dragon', hp: 178, ac: 18, size: 120, color: '#b91c1c', imgUrl: '' }
        ];

        const combinedList = [...presets];
        // Append defaults if name doesn't collide
        defaultCreatures.forEach(def => {
          if (!combinedList.some(p => p.name.toLowerCase() === def.name.toLowerCase())) {
            combinedList.push(def);
          }
        });

        currentFilteredPresets = q 
          ? combinedList.filter(p => (p.name || '').toLowerCase().includes(q))
          : combinedList;

        selectedIndex = 0;
        resultsContainer.innerHTML = '';

        if (!currentFilteredPresets.length) {
          resultsContainer.innerHTML = `
            <div style="text-align:center; padding:24px; color:#8a7b68; font-style:italic;">
              "${query}" ile eşleşen canavar veya şablon bulunamadı.
            </div>
          `;
          return;
        }

        currentFilteredPresets.forEach((preset, idx) => {
          const item = document.createElement('div');
          item.className = `cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`;
          item.setAttribute('data-index', idx);

          const initial = (preset.name || 'M')[0].toUpperCase();
          const avatarHtml = preset.imgUrl 
            ? `<img src="${preset.imgUrl}" alt="" onerror="this.parentNode.textContent='${initial}'">`
            : initial;

          item.innerHTML = `
            <div class="cmd-palette-item-left">
              <div class="cmd-palette-avatar" style="background:${preset.color || '#e5c158'};">
                ${avatarHtml}
              </div>
              <div class="cmd-palette-meta">
                <span class="cmd-palette-name">${preset.name || 'İsimsiz Canavar'}</span>
                <span class="cmd-palette-stats">
                  <span>HP ${preset.hp ?? 10}</span>
                  <span>•</span>
                  <span>AC ${preset.ac ?? 10}</span>
                  <span>•</span>
                  <span>${preset.size ?? 50}px</span>
                </span>
              </div>
            </div>
            <div class="cmd-palette-actions">
              <button type="button" class="cmd-palette-btn cmd-btn-spawn" title="Merkezde Spawn Et">⚡ Spawn</button>
              <button type="button" class="cmd-palette-btn cmd-btn-place" title="Haritada Tıkla ve Bırak">🎯 Yerleştir</button>
            </div>
          `;

          // Button Actions
          const spawnBtn = item.querySelector('.cmd-btn-spawn');
          const placeBtn = item.querySelector('.cmd-btn-place');

          spawnBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.spawnMonster(preset);
            closePalette();
          });

          placeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.placeMonster(preset);
            closePalette();
          });

          item.addEventListener('click', () => {
            this.spawnMonster(preset);
            closePalette();
          });

          resultsContainer.appendChild(item);
        });
      };

      // Input listener
      if (input) {
        input.addEventListener('input', (e) => {
          renderResults(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
          const items = resultsContainer.querySelectorAll('.cmd-palette-item');
          if (!items.length) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection(items);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection(items);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const targetPreset = currentFilteredPresets[selectedIndex];
            if (targetPreset) {
              if (e.shiftKey) {
                this.placeMonster(targetPreset);
              } else {
                this.spawnMonster(targetPreset);
              }
              closePalette();
            }
          }
        });
      }

      function updateSelection(items) {
        items.forEach((it, i) => {
          it.classList.toggle('selected', i === selectedIndex);
          if (i === selectedIndex) {
            it.scrollIntoView({ block: 'nearest' });
          }
        });
      }
    }

    spawnMonster(preset) {
      if (typeof spawnTokenFromPreset === 'function') {
        spawnTokenFromPreset(preset, null, null);
      } else if (window.__spawnTokenFromPreset) {
        window.__spawnTokenFromPreset(preset, null, null);
      } else {
        // Fallback: fill form and click spawn button
        if (typeof applyTokenPresetToForm === 'function') {
          applyTokenPresetToForm(preset);
        }
        const spawnBtn = document.getElementById('btn-add-marker');
        if (spawnBtn) spawnBtn.click();
      }
    }

    placeMonster(preset) {
      if (typeof activateTokenPlacementMode === 'function') {
        activateTokenPlacementMode(preset);
      } else if (window.__activateTokenPlacementMode) {
        window.__activateTokenPlacementMode(preset);
      } else {
        this.spawnMonster(preset);
      }
    }

    // ============================================================
    // 7. KEYBOARD SHORTCUTS GUIDE
    // ============================================================
    setupShortcutsGuide() {
      const searchInput = document.getElementById('shortcuts-search-input');
      const container = document.getElementById('shortcuts-list-container');
      if (!searchInput || !container) return;

      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const groups = container.querySelectorAll('.shortcuts-group');
        let totalVisible = 0;

        groups.forEach(group => {
          const items = group.querySelectorAll('.shortcut-item');
          let groupVisibleCount = 0;

          items.forEach(item => {
            const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();
            const text = item.textContent.toLowerCase();
            const matches = !query || keywords.includes(query) || text.includes(query);

            item.style.display = matches ? 'flex' : 'none';
            if (matches) {
              groupVisibleCount++;
              totalVisible++;
            }
          });

          // Hide empty groups
          group.style.display = groupVisibleCount > 0 ? 'flex' : 'none';
        });

        // Handle empty message
        let emptyEl = container.querySelector('.shortcuts-empty-state');
        if (totalVisible === 0) {
          if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'shortcuts-empty-state';
            emptyEl.textContent = 'Eşleşen kısayol bulunamadı.';
            container.appendChild(emptyEl);
          }
          emptyEl.style.display = 'block';
        } else if (emptyEl) {
          emptyEl.style.display = 'none';
        }
      });
    }
  }

  // Expose to window and instantiate
  window.WebDNDPanelManager = new PanelManager();
})();
