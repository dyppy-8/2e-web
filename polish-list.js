// 2E - Polish List: Progressive enhancement for the todo list screen
// Pure progressive enhancement: every feature in try/catch, never throw, never preventDefault/stopPropagation, no imports.

(function initPolishList() {
  let isUpdating = false;

  function updateListDecorations() {
    if (isUpdating) return;
    try {
      const list = document.getElementById('todo-list');
      if (!list) return;

      isUpdating = true;

      // 1. Set avatar src based on person name
      const items = Array.from(list.querySelectorAll('.todo-item'));
      for (const item of items) {
        try {
          const personEl = item.querySelector('.todo-person');
          const avatarEl = item.querySelector('.todo-avatar');
          if (personEl && avatarEl) {
            const name = (personEl.textContent || '').trim();
            const targetSrc = (name === 'Eylül') ? './in_app_e_blue.png' : './in_app_e_pink.png';
            if (avatarEl.getAttribute('src') !== targetSrc) {
              avatarEl.src = targetSrc;
            }
          }
        } catch (_) {}
      }

      // 2. Insert handwritten group dividers
      // Remove existing dividers first
      const existingDividers = list.querySelectorAll('.list-divider');
      for (const d of existingDividers) {
        try { d.remove(); } catch (_) {}
      }

      if (items.length > 0) {
        const undoneItems = [];
        const doneItems = [];

        for (const item of items) {
          if (item.classList.contains('done')) {
            doneItems.push(item);
          } else {
            undoneItems.push(item);
          }
        }

        // Insert divider before first undone item
        if (undoneItems.length > 0) {
          const undoneDiv = document.createElement('li');
          undoneDiv.className = 'list-divider list-divider-undone';
          undoneDiv.setAttribute('aria-hidden', 'true');
          undoneDiv.innerHTML = '<span class="divider-text">Yapılacaklar · ' + undoneItems.length + '</span><span class="divider-line"></span>';
          list.insertBefore(undoneDiv, undoneItems[0]);
        }

        // Insert divider before first done item
        if (doneItems.length > 0) {
          const doneDiv = document.createElement('li');
          doneDiv.className = 'list-divider list-divider-done';
          doneDiv.setAttribute('aria-hidden', 'true');
          doneDiv.innerHTML = '<span class="divider-text">Yapıldı · ' + doneItems.length + '</span><span class="divider-line"></span>';
          list.insertBefore(doneDiv, doneItems[0]);
        }
      }
    } catch (_) {
      // never throw
    } finally {
      isUpdating = false;
    }
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

      // Initial execution
      updateListDecorations();
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
