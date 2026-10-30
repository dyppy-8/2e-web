/**
 * polish-chrome.js - Fluid Navigation, Header Scroll Collapse & Touch Polish
 * Progressive enhancement: pure vanilla ES module, zero external deps,
 * fully wrapped in try/catch, never throws, never blocks app clicks.
 */

(function initChromePolish() {
  'use strict';

  /* --------------------------------------------------------------------------
     1. Large Title Collapse & Header Compact Title (iOS Style)
     -------------------------------------------------------------------------- */
  try {
    const header = document.querySelector('.app-header');
    if (header) {
      let compactTitle = header.querySelector('.header-compact-title');
      if (!compactTitle) {
        compactTitle = document.createElement('span');
        compactTitle.className = 'header-compact-title';
        compactTitle.setAttribute('aria-hidden', 'true');
        header.appendChild(compactTitle);
      }

      function updateCollapse() {
        try {
          const activePanel = document.querySelector('.panel.active') || document.getElementById('todo-panel');
          if (!activePanel) return;

          const activeH2 = activePanel.querySelector('.section-head h2');
          if (activeH2 && compactTitle) {
            const h2Text = activeH2.textContent.trim();
            if (compactTitle.textContent !== h2Text) {
              compactTitle.textContent = h2Text;
            }
          }

          const panelScroll = activePanel.querySelector('.panel-scroll') || activePanel;
          const scrollTop = panelScroll ? panelScroll.scrollTop : 0;
          // Collapse from 0 to 70px
          const collapse = Math.min(1, Math.max(0, scrollTop / 70));

          activePanel.style.setProperty('--collapse', collapse.toFixed(3));
          header.style.setProperty('--collapse', collapse.toFixed(3));
        } catch (e) {
          // Silent fallback
        }
      }

      let ticking = false;
      function onScroll() {
        if (!ticking) {
          requestAnimationFrame(() => {
            updateCollapse();
            ticking = false;
          });
          ticking = true;
        }
      }

      // Attach scroll listeners to panel scroll containers
      const scrollContainers = document.querySelectorAll('.panel-scroll');
      scrollContainers.forEach((el) => {
        el.addEventListener('scroll', onScroll, { passive: true });
      });

      // Observe active panel class changes (tab switching)
      const panels = document.querySelectorAll('.panel');
      if (typeof MutationObserver !== 'undefined' && panels.length > 0) {
        const observer = new MutationObserver((mutations) => {
          let shouldUpdate = false;
          for (const m of mutations) {
            if (m.attributeName === 'class') {
              shouldUpdate = true;
              break;
            }
          }
          if (shouldUpdate) {
            requestAnimationFrame(updateCollapse);
          }
        });

        panels.forEach((p) => {
          observer.observe(p, { attributes: true, attributeFilter: ['class'] });
        });
      }

      // Initial collapse calculation
      requestAnimationFrame(updateCollapse);
    }
  } catch (err) {
    // Header collapse feature failed safely
  }

  /* --------------------------------------------------------------------------
     2. Dock: Instant Response on Pointer-Down (0ms Pressed State)
     -------------------------------------------------------------------------- */
  try {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener(
        'pointerdown',
        () => {
          btn.classList.add('is-pressed');
        },
        { passive: true }
      );

      const clearPressed = () => {
        btn.classList.remove('is-pressed');
      };

      btn.addEventListener('pointerup', clearPressed, { passive: true });
      btn.addEventListener('pointercancel', clearPressed, { passive: true });
      btn.addEventListener('pointerleave', clearPressed, { passive: true });
    });
  } catch (err) {
    // Dock pointer polish failed safely
  }
})();
