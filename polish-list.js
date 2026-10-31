// 2E - Polish List: Apple Fluid Gestures & List Enhancements
// Pure progressive enhancement: every feature in try/catch, never throw.

(function initPolishList() {
  let isUpdating = false;

  // Spring animation helper
  function springAnimate({ from, to, velocity = 0, response = 0.35, dampingRatio = 1.0, onUpdate, onComplete }) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (onUpdate) onUpdate(to);
      if (onComplete) onComplete();
      return;
    }

    let x = from;
    let v = velocity;
    const k = Math.pow((2 * Math.PI) / response, 2);
    const c = (4 * Math.PI * dampingRatio) / response;
    let lastTime = performance.now();
    let frameId;

    function step(now) {
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) {
        frameId = requestAnimationFrame(step);
        return;
      }

      const a = -k * (x - to) - c * v;
      v += a * dt;
      x += v * dt;

      if (Math.abs(x - to) < 0.5 && Math.abs(v) < 10) {
        if (onUpdate) onUpdate(to);
        if (onComplete) onComplete();
        return;
      }

      if (onUpdate) onUpdate(x);
      frameId = requestAnimationFrame(step);
    }

    frameId = requestAnimationFrame(step);
  }

  // Ensure List Hero element exists and is updated
  function updateHero(undoneCount, doneCount, totalCount) {
    try {
      const panelScroll = document.querySelector('#todo-panel .panel-scroll') || document.querySelector('.panel-scroll') || document.getElementById('todo-panel');
      const form = document.getElementById('todo-form') || (panelScroll ? panelScroll.querySelector('form') : null);
      if (!form || !panelScroll) return;

      let hero = panelScroll.querySelector('.list-hero');
      if (!hero) {
        hero = document.createElement('section');
        hero.className = 'list-hero';
        hero.setAttribute('aria-hidden', 'true');
        form.parentNode.insertBefore(hero, form);
      }

      if (totalCount === 0) {
        hero.style.display = 'none';
        return;
      }

      hero.style.display = 'flex';
      const pct = Math.round((doneCount / totalCount) * 100);

      const titleText = undoneCount > 0 ? 'aktivite bizi bekliyor' : 'hepsi tamam!';
      const countText = String(undoneCount);
      const subText = doneCount + ' / ' + totalCount + ' yapıldı';

      hero.innerHTML = `
        <div class="hero-text-row">
          <div class="hero-count">${countText}</div>
          <div class="hero-label-col">
            <div class="hero-title">${titleText}</div>
            <div class="hero-sub">${subText}</div>
          </div>
        </div>
        <div class="hero-progress-strip">
          <div class="hero-progress-fill" style="width: ${pct}%"></div>
        </div>
      `;
    } catch (_) {}
  }

  // Update List Decorations (Hero, Dividers)
  function updateListDecorations() {
    if (isUpdating) return;
    try {
      const list = document.getElementById('todo-list');
      if (!list) return;

      isUpdating = true;
      const items = Array.from(list.querySelectorAll('.todo-item'));

      // Remove existing dividers
      const existingDividers = list.querySelectorAll('.list-divider');
      for (const d of existingDividers) {
        try { d.remove(); } catch (_) {}
      }

      const undoneItems = [];
      const doneItems = [];

      for (const item of items) {
        if (item.classList.contains('done')) {
          doneItems.push(item);
        } else {
          undoneItems.push(item);
        }
      }

      // Update hero
      updateHero(undoneItems.length, doneItems.length, items.length);

      if (items.length > 0) {
        // Insert undone divider
        if (undoneItems.length > 0) {
          const undoneDiv = document.createElement('li');
          undoneDiv.className = 'list-divider list-divider-undone';
          undoneDiv.setAttribute('aria-hidden', 'true');
          undoneDiv.innerHTML = '<span class="divider-text">yapılacaklar · ' + undoneItems.length + '</span><span class="divider-line"></span>';
          list.insertBefore(undoneDiv, undoneItems[0]);
        }

        // Insert done divider
        if (doneItems.length > 0) {
          const doneDiv = document.createElement('li');
          doneDiv.className = 'list-divider list-divider-done';
          doneDiv.setAttribute('aria-hidden', 'true');
          doneDiv.innerHTML = '<span class="divider-text">yapılanlar · ' + doneItems.length + '</span><span class="divider-line"></span>';
          list.insertBefore(doneDiv, doneItems[0]);
        }
      }
    } catch (_) {
    } finally {
      isUpdating = false;
    }
  }

  // Apple Fluid Interface Gesture Handler
  function attachGestures() {
    try {
      const list = document.getElementById('todo-list');
      if (!list) return;

      let activeLi = null;
      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let isDragging = false;
      let directionLocked = false;
      let currentX = 0;
      let history = [];
      let vibrated = false;
      let blockClick = false;

      list.addEventListener('pointerdown', function(e) {
        try {
          if (activeLi) return;
          // Ignore gestures that start on interactive buttons
          if (e.target.closest('button, input, a, .todo-check, .delete-item')) return;

          const li = e.target.closest('.todo-item');
          if (!li) return;

          activeLi = li;
          pointerId = e.pointerId;
          startX = e.clientX;
          startY = e.clientY;
          currentX = 0;
          isDragging = false;
          directionLocked = false;
          vibrated = false;
          blockClick = false;
          history = [{ x: startX, time: performance.now() }];

          // Pressed state instant response on pointer-down
          activeLi.classList.add('is-pressed');
          try { activeLi.setPointerCapture(pointerId); } catch (_) {}
        } catch (_) {}
      });

      list.addEventListener('pointermove', function(e) {
        try {
          if (!activeLi || e.pointerId !== pointerId) return;

          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          if (!directionLocked) {
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
              directionLocked = true;
              if (Math.abs(dy) > Math.abs(dx)) {
                // Vertical wins -> let browser scroll freely
                activeLi.classList.remove('is-pressed');
                try { activeLi.releasePointerCapture(pointerId); } catch (_) {}
                activeLi = null;
                return;
              }
              // Horizontal wins -> lock into swipe
              isDragging = true;
              blockClick = true;
              activeLi.classList.remove('is-pressed');
              activeLi.classList.add('swiping');
            }
          }

          if (!isDragging) return;

          const now = performance.now();
          history.push({ x: e.clientX, time: now });
          history = history.filter(pt => now - pt.time <= 100);

          // 1:1 direct tracking with rubber-band past 110px
          const d = 110;
          let x = dx;
          if (Math.abs(x) > d) {
            const sign = Math.sign(x);
            const overflow = Math.abs(x) - d;
            const rubber = (overflow * d * 0.55) / (d + 0.55 * overflow);
            x = sign * (d + rubber);
          }

          currentX = x;
          activeLi.style.setProperty('--swipe-x', x + 'px');

          if (x > 0) {
            activeLi.dataset.swipeDir = 'right';
          } else if (x < 0) {
            activeLi.dataset.swipeDir = 'left';
          } else {
            delete activeLi.dataset.swipeDir;
          }

          // Haptic feedback when crossing threshold ~90px
          if (!vibrated && Math.abs(x) >= 90) {
            vibrated = true;
            if (navigator.vibrate) try { navigator.vibrate(10); } catch (_) {}
          }
        } catch (_) {}
      });

      function finishGesture(e) {
        try {
          if (!activeLi || e.pointerId !== pointerId) return;

          const li = activeLi;
          const wasDragging = isDragging;
          activeLi = null;
          pointerId = null;

          li.classList.remove('is-pressed');

          if (!wasDragging) {
            return;
          }

          // Calculate velocity from last ~80ms
          let v = 0;
          if (history.length >= 2) {
            const first = history[0];
            const last = history[history.length - 1];
            const dt = last.time - first.time;
            if (dt > 5) {
              v = ((last.x - first.x) / dt) * 1000;
            }
          }

          // Momentum projection
          const projected = currentX + (v / 1000) * 0.998 / (1 - 0.998);
          const dampingRatio = Math.abs(v) > 400 ? 0.84 : 1.0;

          if (projected > 90) {
            // Commit swipe right (toggle done): spring back to 0 then click checkbox
            springAnimate({
              from: currentX,
              to: 0,
              velocity: v,
              response: 0.32,
              dampingRatio: dampingRatio,
              onUpdate: function(val) {
                li.style.setProperty('--swipe-x', val + 'px');
              },
              onComplete: function() {
                li.classList.remove('swiping');
                delete li.dataset.swipeDir;
                li.style.removeProperty('--swipe-x');
                const checkBtn = li.querySelector('.todo-check');
                if (checkBtn) checkBtn.click();
              }
            });
          } else if (projected < -90) {
            // Commit swipe left (delete): slide out to -width then click delete
            const target = - (li.offsetWidth + 60);
            springAnimate({
              from: currentX,
              to: target,
              velocity: v,
              response: 0.32,
              dampingRatio: 0.95,
              onUpdate: function(val) {
                li.style.setProperty('--swipe-x', val + 'px');
              },
              onComplete: function() {
                li.classList.remove('swiping');
                delete li.dataset.swipeDir;
                li.style.removeProperty('--swipe-x');
                const delBtn = li.querySelector('.delete-item');
                if (delBtn) delBtn.click();
              }
            });
          } else {
            // Cancel gesture: spring back to 0 with release velocity
            springAnimate({
              from: currentX,
              to: 0,
              velocity: v,
              response: 0.35,
              dampingRatio: dampingRatio,
              onUpdate: function(val) {
                li.style.setProperty('--swipe-x', val + 'px');
              },
              onComplete: function() {
                li.classList.remove('swiping');
                delete li.dataset.swipeDir;
                li.style.removeProperty('--swipe-x');
              }
            });
          }
        } catch (_) {}
      }

      list.addEventListener('pointerup', finishGesture);
      list.addEventListener('pointercancel', finishGesture);

      // Block click when a real drag occurred
      list.addEventListener('click', function(e) {
        if (blockClick) {
          e.stopPropagation();
          e.preventDefault();
          blockClick = false;
        }
      }, true);
    } catch (_) {}
  }

  function startObserver() {
    try {
      const list = document.getElementById('todo-list');
      if (!list) return;

      const observer = new MutationObserver(function(mutations) {
        if (isUpdating) return;
        try {
          let shouldUpdate = false;
          for (const m of mutations) {
            if (m.type === 'childList') {
              const nodes = [...m.addedNodes, ...m.removedNodes];
              const hasMeaningful = nodes.some(node =>
                node.nodeType === 1 && !node.classList.contains('list-divider')
              );
              if (hasMeaningful) {
                shouldUpdate = true;
                break;
              }
            } else if (m.type === 'attributes') {
              if (m.target && m.target.classList && m.target.classList.contains('todo-item')) {
                shouldUpdate = true;
                break;
              }
            }
          }
          if (shouldUpdate) {
            updateListDecorations();
          }
        } catch (_) {}
      });

      observer.observe(list, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });

      updateListDecorations();
      attachGestures();
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
