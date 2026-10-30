/**
 * polish.js - Progressive enhancement for mobile paper notebook todo app.
 * Pure enhancement: silently does nothing if elements are missing, never throws,
 * no app.js dependencies, no network, vanilla ES2020.
 */

(function initPolish() {
  /* ==========================================================================
     Shared Seeded PRNG Helpers (mulberry32 + date-string hash)
     ========================================================================== */
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getTodayDateStr() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* ==========================================================================
     Feature 1: GENERATIVE PAPER DOODLES (Margin Doodles)
     ========================================================================== */
  try {
    const canvas = document.querySelector('canvas.paper-doodles');
    if (canvas && typeof canvas.getContext === 'function') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const baseSeed = hashString(getTodayDateStr());
        const colors = ['#d96f97', '#5aa7d8', '#2a1f3d'];

        function buildShape(type, size) {
          switch (type) {
            case 0: {
              // Five-point star
              const pts = [];
              for (let i = 0; i <= 10; i++) {
                const a = (i * Math.PI) / 5 - Math.PI / 2;
                const r = i % 2 === 0 ? size / 2 : (size / 2) * 0.42;
                pts.push([Math.cos(a) * r, Math.sin(a) * r]);
              }
              return [pts];
            }
            case 1: {
              // Heart
              const pts = [];
              const steps = 24;
              const scale = size / 32;
              for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * Math.PI * 2;
                const x = 16 * Math.pow(Math.sin(t), 3);
                const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                pts.push([x * scale, y * scale]);
              }
              return [pts];
            }
            case 2: {
              // Spiral (2.5 turns = 5*PI rad)
              const pts = [];
              const maxTheta = 2.5 * Math.PI * 2;
              const steps = 30;
              for (let i = 0; i <= steps; i++) {
                const theta = (i / steps) * maxTheta;
                const r = (theta / maxTheta) * (size / 2);
                pts.push([Math.cos(theta) * r, Math.sin(theta) * r]);
              }
              return [pts];
            }
            case 3: {
              // Small loop-de-loop squiggle
              const pts = [];
              const steps = 26;
              for (let i = 0; i <= steps; i++) {
                const t = -1.5 + (i / steps) * 3;
                const x = t * (size / 3) + Math.cos(t * Math.PI) * (size / 6);
                const y = Math.sin(t * Math.PI) * (size / 3.2);
                pts.push([x, y]);
              }
              return [pts];
            }
            case 4: {
              // Tiny asterisk / sparkle (3 crossing strokes)
              const paths = [];
              for (const ang of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
                const dx = Math.cos(ang) * (size / 2);
                const dy = Math.sin(ang) * (size / 2);
                paths.push([
                  [-dx, -dy],
                  [-dx * 0.25, -dy * 0.25],
                  [dx * 0.25, dy * 0.25],
                  [dx, dy]
                ]);
              }
              return paths;
            }
            case 5:
            default: {
              // Small wavy underline
              const pts = [];
              const steps = 22;
              for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = (t - 0.5) * size;
                const y = Math.sin(t * Math.PI * 3.5) * (size * 0.18);
                pts.push([x, y]);
              }
              return [pts];
            }
          }
        }

        function drawDoodles() {
          const rnd = mulberry32(baseSeed);
          const w = window.innerWidth;
          const h = window.innerHeight;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);

          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);

          // 9 to 12 doodles
          const targetCount = Math.floor(9 + rnd() * 4);
          const placed = [];
          let attempts = 0;

          while (placed.length < targetCount && attempts < 200) {
            attempts++;
            const inLeft = rnd() < 0.5;
            const xMin = inLeft ? 0.04 * w : 0.87 * w;
            const xMax = inLeft ? 0.13 * w : 0.96 * w;
            const candX = xMin + rnd() * (xMax - xMin);
            const candY = 0.12 * h + rnd() * (0.92 * h - 0.12 * h);

            const tooClose = placed.some((p) => Math.hypot(p.x - candX, p.y - candY) < 70);
            if (!tooClose) {
              placed.push({ x: candX, y: candY });
            }
          }

          // Draw each doodle
          for (const pos of placed) {
            const size = 14 + rnd() * 16; // 14-30px
            const shapeType = Math.floor(rnd() * 6);
            const rot = (-25 + rnd() * 50) * (Math.PI / 180);
            const color = colors[Math.floor(rnd() * colors.length)];
            const alpha = 0.1 + rnd() * 0.07; // 0.10 - 0.17
            const lw = 1.3 + rnd() * 0.4; // 1.3 - 1.7
            const polylines = buildShape(shapeType, size);

            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = lw;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const cosR = Math.cos(rot);
            const sinR = Math.sin(rot);

            // Double stroke for pencil/ink hand-drawn feel
            for (let pass = 0; pass < 2; pass++) {
              const passOffsetX = pass === 0 ? 0 : (rnd() - 0.5) * 0.8;
              const passOffsetY = pass === 0 ? 0 : (rnd() - 0.5) * 0.8;

              for (const poly of polylines) {
                if (poly.length < 2) continue;
                ctx.beginPath();
                for (let i = 0; i < poly.length; i++) {
                  const jx = (rnd() - 0.5) * 1.2; // ±0.6px
                  const jy = (rnd() - 0.5) * 1.2;
                  const lx = poly[i][0] + passOffsetX + jx;
                  const ly = poly[i][1] + passOffsetY + jy;
                  const rx = pos.x + lx * cosR - ly * sinR;
                  const ry = pos.y + lx * sinR + ly * cosR;
                  if (i === 0) {
                    ctx.moveTo(rx, ry);
                  } else {
                    ctx.lineTo(rx, ry);
                  }
                }
                ctx.stroke();
              }
            }
          }
        }

        drawDoodles();

        let resizeTimeout = null;
        window.addEventListener(
          'resize',
          () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
              try {
                drawDoodles();
              } catch (_) {}
            }, 200);
          },
          { passive: true }
        );
      }
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 2: BOOT SCREEN GENERATIVE PENCIL ORBIT (Algorithmic Art)
     ========================================================================= */
  try {
    const bootScreen = document.querySelector('#boot-screen');
    if (
      bootScreen &&
      !bootScreen.classList.contains('done') &&
      !bootScreen.hasAttribute('hidden') &&
      bootScreen.style.display !== 'none'
    ) {
      const canvas = document.createElement('canvas');
      canvas.className = 'boot-art';
      canvas.setAttribute('aria-hidden', 'true');
      bootScreen.insertBefore(canvas, bootScreen.firstChild);

      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const mark = bootScreen.querySelector('.boot-mark');
        let cx = w / 2;
        let cy = h / 2;
        let markW = Math.min(w * 0.82, 390);

        if (mark) {
          const rect = mark.getBoundingClientRect();
          if (rect.width > 0) {
            cx = rect.left + rect.width / 2;
            cy = rect.top + rect.height / 2;
            markW = rect.width;
          }
        }

        const R = 0.60 * markW;
        const orbitSeed = hashString(getTodayDateStr() + '-boot-orbit-salt');
        const rnd = mulberry32(orbitSeed);
        const s1 = rnd() * 100;
        const s2 = rnd() * 100;
        const colors = ['#d96f97', '#5aa7d8', '#2a1f3d'];

        const strokes = [];
        for (let i = 0; i < 56; i++) {
          const a0 = (i / 56) * Math.PI * 2 + (rnd() - 0.5) * 0.15;
          const r0 = R * (0.96 + rnd() * (1.10 - 0.96));
          const stepCount = Math.floor(70 + rnd() * 81); // 70..150 steps
          const color = colors[Math.floor(rnd() * colors.length)];
          const alpha = 0.30 + rnd() * (0.55 - 0.30);
          const lineWidth = 1.3 + rnd() * (2.1 - 1.3);

          let currX = cx + Math.cos(a0) * r0;
          let currY = cy + Math.sin(a0) * r0;
          const pts = [{ x: currX + (rnd() - 0.5) * 0.7, y: currY + (rnd() - 0.5) * 0.7 }];

          for (let s = 0; s < stepCount; s++) {
            const dist = Math.hypot(currX - cx, currY - cy);
            const a = Math.atan2(currY - cy, currX - cx);
            let heading =
              a +
              Math.PI / 2 +
              0.55 * Math.sin(currX * 0.018 + s1) * Math.cos(currY * 0.016 + s2);
            heading += ((dist - R) / R) * 0.9;

            currX += Math.cos(heading) * 2.2;
            currY += Math.sin(heading) * 2.2;
            const jx = (rnd() - 0.5) * 0.7; // ±0.35px jitter
            const jy = (rnd() - 0.5) * 0.7;
            pts.push({ x: currX + jx, y: currY + jy });
          }

          strokes.push({
            pts,
            color,
            alpha,
            lineWidth,
            drawnIndex: 0,
            startTime: (i / 56) * 450
          });
        }

        function drawSegment(stroke, fromIdx, toIdx) {
          if (toIdx <= fromIdx) return;
          ctx.strokeStyle = stroke.color;
          ctx.globalAlpha = stroke.alpha;
          ctx.lineWidth = stroke.lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(stroke.pts[fromIdx].x, stroke.pts[fromIdx].y);
          for (let j = fromIdx + 1; j <= toIdx; j++) {
            ctx.lineTo(stroke.pts[j].x, stroke.pts[j].y);
          }
          ctx.stroke();
        }

        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
          for (const stroke of strokes) {
            drawSegment(stroke, 0, stroke.pts.length - 1);
          }
        } else {
          let animStart = null;
          const totalDuration = 1300;

          function renderOrbit(now) {
            try {
              if (
                bootScreen.classList.contains('done') ||
                bootScreen.hidden ||
                bootScreen.hasAttribute('hidden') ||
                bootScreen.style.display === 'none'
              ) {
                return;
              }

              if (animStart === null) animStart = now;
              const elapsed = now - animStart;
              let allDone = true;

              for (const stroke of strokes) {
                if (elapsed < stroke.startTime) {
                  allDone = false;
                  continue;
                }
                const strokeDuration = totalDuration - stroke.startTime;
                const strokeProgress =
                  strokeDuration > 0
                    ? Math.min(1, (elapsed - stroke.startTime) / strokeDuration)
                    : 1;

                const targetIndex = Math.floor(strokeProgress * (stroke.pts.length - 1));
                if (targetIndex > stroke.drawnIndex) {
                  drawSegment(stroke, stroke.drawnIndex, targetIndex);
                  stroke.drawnIndex = targetIndex;
                }
                if (stroke.drawnIndex < stroke.pts.length - 1) {
                  allDone = false;
                }
              }

              if (!allDone && elapsed < totalDuration) {
                requestAnimationFrame(renderOrbit);
              } else {
                for (const stroke of strokes) {
                  if (stroke.drawnIndex < stroke.pts.length - 1) {
                    drawSegment(stroke, stroke.drawnIndex, stroke.pts.length - 1);
                    stroke.drawnIndex = stroke.pts.length - 1;
                  }
                }
              }
            } catch (_) {}
          }

          requestAnimationFrame(renderOrbit);
        }
      }
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 3: EMPTY STATE ART
     ========================================================================== */
  try {
    const emptyTodos = document.querySelector('#empty-todos');
    if (emptyTodos) {
      let canvas = emptyTodos.querySelector('canvas.empty-art');
      let emptyArtAnimated = false;

      const emptySeed = hashString(getTodayDateStr() + '-empty-art-salt');
      const rnd = mulberry32(emptySeed);

      const loops = [
        {
          center: { x: 46, y: 40 },
          color: '#d96f97',
          phase: rnd() * Math.PI * 2
        },
        {
          center: { x: 74, y: 40 },
          color: '#5aa7d8',
          phase: rnd() * Math.PI * 2
        }
      ];

      const loopPaths = loops.map((loop) => {
        const pts = [];
        const stepRad = 0.06;
        const totalSteps = Math.ceil((Math.PI * 2) / stepRad);
        for (let i = 0; i <= totalSteps; i++) {
          const t = i === totalSteps ? Math.PI * 2 : i * stepRad;
          const r = 22 + 3 * Math.sin(3 * t + loop.phase) + (rnd() - 0.5) * 1.6;
          pts.push({
            x: loop.center.x + r * Math.cos(t),
            y: loop.center.y + r * Math.sin(t)
          });
        }
        return { color: loop.color, pts };
      });

      const sparkles = [];
      for (let s = 0; s < 3; s++) {
        const sx = 28 + rnd() * 64;
        const sy = 8 + rnd() * 16;
        const size = 4 + rnd() * 3;
        sparkles.push({ x: sx, y: sy, size });
      }

      function ensureCanvas() {
        if (!canvas || !canvas.isConnected) {
          canvas = emptyTodos.querySelector('canvas.empty-art');
          if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'empty-art';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.width = 240;
            canvas.height = 160;
            canvas.style.width = '120px';
            canvas.style.height = '80px';
            emptyTodos.insertBefore(canvas, emptyTodos.firstChild);
          }
        }
        return canvas;
      }

      function renderEmptyFrame(ctx, progress) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, 240, 160);
        ctx.scale(2, 2);

        for (const loop of loopPaths) {
          const totalPts = loop.pts.length;
          const maxIdx = Math.max(1, Math.min(totalPts - 1, Math.floor(progress * (totalPts - 1))));

          ctx.strokeStyle = loop.color;
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(loop.pts[0].x, loop.pts[0].y);
          for (let j = 1; j <= maxIdx; j++) {
            ctx.lineTo(loop.pts[j].x, loop.pts[j].y);
          }
          ctx.stroke();

          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(loop.pts[0].x + 0.42, loop.pts[0].y + 0.42);
          for (let j = 1; j <= maxIdx; j++) {
            ctx.lineTo(loop.pts[j].x + 0.42, loop.pts[j].y + 0.42);
          }
          ctx.stroke();
        }

        if (progress > 0.7) {
          const alphaFactor = Math.min(1, (progress - 0.7) / 0.3);
          ctx.strokeStyle = '#2a1f3d';
          ctx.globalAlpha = 0.35 * alphaFactor;
          ctx.lineWidth = 1.1;
          ctx.lineCap = 'round';

          for (const sp of sparkles) {
            for (const ang of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
              const dx = Math.cos(ang) * (sp.size / 2);
              const dy = Math.sin(ang) * (sp.size / 2);
              ctx.beginPath();
              ctx.moveTo(sp.x - dx, sp.y - dy);
              ctx.lineTo(sp.x + dx, sp.y + dy);
              ctx.stroke();
            }
          }
        }

        ctx.restore();
      }

      function triggerEmptyAnimation() {
        const c = ensureCanvas();
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;

        const prefersReducedMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
          renderEmptyFrame(ctx, 1);
          emptyArtAnimated = true;
          return;
        }

        emptyArtAnimated = true;
        const duration = 900;
        let startT = null;

        function stepEmpty(now) {
          try {
            if (startT === null) startT = now;
            const elapsed = now - startT;
            const progress = Math.min(1, elapsed / duration);
            renderEmptyFrame(ctx, progress);
            if (progress < 1) {
              requestAnimationFrame(stepEmpty);
            }
          } catch (_) {}
        }

        requestAnimationFrame(stepEmpty);
      }

      function checkEmptyVisibility() {
        ensureCanvas();
        const isVisible =
          !emptyTodos.hasAttribute('hidden') &&
          !emptyTodos.hidden &&
          emptyTodos.style.display !== 'none';

        if (isVisible) {
          if (!emptyArtAnimated) {
            triggerEmptyAnimation();
          } else {
            const c = ensureCanvas();
            const ctx = c ? c.getContext('2d') : null;
            if (ctx) renderEmptyFrame(ctx, 1);
          }
        }
      }

      checkEmptyVisibility();

      const emptyObserver = new MutationObserver(() => {
        try {
          checkEmptyVisibility();
        } catch (_) {}
      });
      emptyObserver.observe(emptyTodos, {
        attributes: true,
        attributeFilter: ['hidden', 'class', 'style'],
        childList: true
      });
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 4: LIST REORDER GLIDE (FLIP) + NO RE-ENTRY FLASH
     ========================================================================== */
  try {
    const todoList = document.querySelector('#todo-list');
    if (todoList && typeof MutationObserver !== 'undefined') {
      const knownIds = new Set();
      let firstRenderDone = false;
      let snapshot = new Map();
      let snapshotTime = 0;

      function takeSnapshot() {
        try {
          const list = document.querySelector('#todo-list');
          if (!list) return;
          const listRect = list.getBoundingClientRect();
          const items = list.querySelectorAll('.todo-item');
          const nextSnapshot = new Map();
          for (let i = 0; i < items.length; i++) {
            const el = items[i];
            const id = el.dataset ? el.dataset.id : el.getAttribute('data-id');
            if (id) {
              nextSnapshot.set(id, el.getBoundingClientRect().top - listRect.top);
            }
          }
          snapshot = nextSnapshot;
          snapshotTime = performance.now();
        } catch (_) {}
      }

      // Snapshot on pointerdown (capture phase, passive) anywhere in #todo-list
      todoList.addEventListener('pointerdown', takeSnapshot, { capture: true, passive: true });

      // Snapshot on click of #refresh-todos
      const refreshBtn = document.querySelector('#refresh-todos');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', takeSnapshot, { passive: true });
      }
      document.addEventListener(
        'click',
        (e) => {
          try {
            if (e.target && e.target.closest && e.target.closest('#refresh-todos')) {
              takeSnapshot();
            }
          } catch (_) {}
        },
        { passive: true }
      );

      const listObserver = new MutationObserver((mutations) => {
        try {
          const addedItems = [];
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType === 1) {
                if (node.classList.contains('todo-item')) {
                  addedItems.push(node);
                } else if (node.querySelectorAll) {
                  const children = node.querySelectorAll('.todo-item');
                  for (let i = 0; i < children.length; i++) {
                    addedItems.push(children[i]);
                  }
                }
              }
            }
          }

          if (addedItems.length === 0) return;

          const newItems = [];
          const settledItems = [];

          for (const el of addedItems) {
            const id = el.dataset ? el.dataset.id : el.getAttribute('data-id');
            if (id && knownIds.has(id)) {
              el.classList.add('settled');
              settledItems.push(el);
            } else {
              newItems.push(el);
            }
          }

          if (!firstRenderDone) {
            if (newItems.length === 1) {
              newItems[0].style.setProperty('--i', '0');
            } else if (newItems.length > 1) {
              newItems.sort((a, b) =>
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
              );
              newItems.forEach((el, index) => {
                el.style.setProperty('--i', String(Math.min(index, 12)));
              });
            }
          } else {
            for (const el of newItems) {
              el.style.setProperty('--i', '0');
            }
          }

          for (const el of addedItems) {
            const id = el.dataset ? el.dataset.id : el.getAttribute('data-id');
            if (id) {
              knownIds.add(id);
            }
          }

          queueMicrotask(() => {
            try {
              const prefersReducedMotion =
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

              const isSnapshotFresh = performance.now() - snapshotTime < 3000;
              const flipItems = [];
              const listRect = todoList.getBoundingClientRect();

              // READ PHASE: Read all rects before any style writes to avoid layout thrash
              if (!prefersReducedMotion && isSnapshotFresh && snapshot.size > 0) {
                for (const el of settledItems) {
                  const id = el.dataset ? el.dataset.id : el.getAttribute('data-id');
                  if (id && snapshot.has(id)) {
                    const oldRelTop = snapshot.get(id);
                    const newRelTop = el.getBoundingClientRect().top - listRect.top;
                    const dy = oldRelTop - newRelTop;
                    if (Math.abs(dy) > 1) {
                      flipItems.push({ el, dy });
                    }
                  }
                }
              }

              // Build fresh untransformed snapshot for all current items before transforms are set
              // Skip items that currently have an inline transform (mid-animation)
              const currentItems = todoList.querySelectorAll('.todo-item');
              const baselineSnapshot = new Map();
              for (let i = 0; i < currentItems.length; i++) {
                const it = currentItems[i];
                if (it.style && it.style.transform) continue;
                const itId = it.dataset ? it.dataset.id : it.getAttribute('data-id');
                if (itId) {
                  baselineSnapshot.set(itId, it.getBoundingClientRect().top - listRect.top);
                }
              }

              // WRITE PHASE: Apply transforms
              if (flipItems.length > 0) {
                for (const item of flipItems) {
                  item.el.style.transition = 'none';
                  item.el.style.transform = `translateY(${item.dy}px)`;
                }

                requestAnimationFrame(() => {
                  try {
                    requestAnimationFrame(() => {
                      try {
                        for (const item of flipItems) {
                          const el = item.el;
                          el.style.transition = 'transform 560ms cubic-bezier(.32,.72,0,1)';
                          el.style.transform = '';

                          let cleaned = false;
                          const cleanup = () => {
                            try {
                              if (cleaned) return;
                              cleaned = true;
                              el.style.transition = '';
                              el.removeEventListener('transitionend', onEnd);
                            } catch (_) {}
                          };
                          const onEnd = (e) => {
                            try {
                              if (e.target === el && e.propertyName === 'transform') {
                                cleanup();
                              }
                            } catch (_) {}
                          };
                          el.addEventListener('transitionend', onEnd);
                          setTimeout(cleanup, 700);
                        }
                      } catch (_) {}
                    });
                  } catch (_) {}
                });
              }

              firstRenderDone = true;
            } catch (_) {}
          });

          // Snapshot at the end of observer callback
          snapshot = baselineSnapshot;
          snapshotTime = performance.now();
        } catch (_) {}
      });

      listObserver.observe(todoList, { childList: true });
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 5: CHECK INK POP
     ========================================================================== */
  try {
    const todoList = document.querySelector('#todo-list');
    if (todoList) {
      todoList.addEventListener(
        'click',
        (event) => {
          try {
            const checkBtn = event.target && event.target.closest ? event.target.closest('.todo-check') : null;
            if (!checkBtn) return;
            const item = checkBtn.closest ? checkBtn.closest('.todo-item') : null;
            if (!item) return;

            item.classList.remove('ink-pop');
            void item.offsetWidth;
            item.classList.add('ink-pop');

            setTimeout(() => {
              try {
                item.classList.remove('ink-pop');
              } catch (_) {}
            }, 520);

            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              try {
                navigator.vibrate(8);
              } catch (_) {}
            }
          } catch (_) {}
        },
        { passive: true }
      );
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 6: STATS COUNT-UP + BAR GROW
     ========================================================================== */
  try {
    const activeTileAnims = new WeakMap();

    function animateStats() {
      if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      // 1. Stat tiles count up
      const tiles = document.querySelectorAll('#stats-body .stat-tile strong');
      tiles.forEach((strong) => {
        try {
          let target;
          let prefix = '';

          // Cache final value in strong.dataset.target on first read and always animate toward dataset.target
          if (strong.dataset && strong.dataset.target != null && strong.dataset.target !== '') {
            target = parseInt(strong.dataset.target, 10);
            prefix = strong.dataset.prefix || '';
          } else {
            const text = strong.textContent.trim();
            const match = text.match(/^(%?)(\d+)$/);
            if (!match) return;

            prefix = match[1] || '';
            target = parseInt(match[2], 10);
            if (isNaN(target)) return;

            if (strong.dataset) {
              strong.dataset.target = String(target);
              strong.dataset.prefix = prefix;
            }
          }

          if (isNaN(target)) return;

          if (activeTileAnims.has(strong)) {
            cancelAnimationFrame(activeTileAnims.get(strong));
            activeTileAnims.delete(strong);
          }

          const duration = 700;
          const startTime = performance.now();

          function step(now) {
            try {
              const elapsed = now - startTime;
              const progress = Math.min(1, elapsed / duration);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = Math.round(target * eased);
              strong.textContent = `${prefix}${current}`;

              if (progress < 1) {
                const id = requestAnimationFrame(step);
                activeTileAnims.set(strong, id);
              } else {
                strong.textContent = `${prefix}${target}`;
                activeTileAnims.delete(strong);
              }
            } catch (_) {}
          }

          const initialId = requestAnimationFrame(step);
          activeTileAnims.set(strong, initialId);
        } catch (_) {}
      });

      // 2. Stat bars grow
      const bars = document.querySelectorAll('#stats-body .stat-bar i, #stats-body .stat-split i');
      bars.forEach((el) => {
        try {
          const origWidth = el.style.width;
          if (!origWidth || origWidth === '0%') return;
          el.style.width = '0%';
          requestAnimationFrame(() => {
            try {
              requestAnimationFrame(() => {
                try {
                  el.style.width = origWidth;
                } catch (_) {}
              });
            } catch (_) {}
          });
        } catch (_) {}
      });
    }

    const statsPanel = document.querySelector('#stats-panel');
    const statsBody = document.querySelector('#stats-body');

    if (statsPanel && typeof MutationObserver !== 'undefined') {
      let wasActive = statsPanel.classList.contains('active');
      const panelObserver = new MutationObserver(() => {
        try {
          const isActive = statsPanel.classList.contains('active');
          if (isActive && !wasActive) {
            animateStats();
          }
          wasActive = isActive;
        } catch (_) {}
      });
      panelObserver.observe(statsPanel, { attributes: true, attributeFilter: ['class'] });
    }

    if (statsBody && typeof MutationObserver !== 'undefined') {
      const bodyObserver = new MutationObserver(() => {
        try {
          const panel = document.querySelector('#stats-panel');
          if (panel && panel.classList.contains('active')) {
            animateStats();
          }
        } catch (_) {}
      });
      bodyObserver.observe(statsBody, { childList: true });
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 7: SHEET DRAG TO DISMISS
     ========================================================================== */
  try {
    const sheet = document.querySelector('#settings-sheet');
    if (sheet) {
      const panel = sheet.querySelector('.sheet-panel');
      const handles = sheet.querySelectorAll('.sheet-grip, .sheet-head');

      // Observe sheet class: whenever sheet gets class 'open', remove leftover drag styles
      if (typeof MutationObserver !== 'undefined') {
        const sheetClassObserver = new MutationObserver(() => {
          try {
            if (sheet.classList.contains('open')) {
              sheet.style.removeProperty('--drag-y');
              sheet.style.removeProperty('--drag-progress');
            }
          } catch (_) {}
        });
        sheetClassObserver.observe(sheet, { attributes: true, attributeFilter: ['class'] });
      }

      function rubber(x, d, c = 0.55) {
        return (x * d * c) / (d + c * x);
      }

      handles.forEach((handle) => {
        let isDragging = false;
        let startY = 0;
        let panelHeight = 0;
        let history = [];
        let currentPointerId = null;

        const onPointerMove = (e) => {
          try {
            if (!isDragging || e.pointerId !== currentPointerId) return;
            const now = performance.now();
            history.push({ y: e.clientY, t: now });
            if (history.length > 6) history.shift();

            let dy = e.clientY - startY;
            if (dy < 0) {
              dy = -rubber(-dy, panelHeight);
            }

            sheet.style.setProperty('--drag-y', `${dy}px`);
            sheet.style.setProperty('--drag-progress', String(Math.max(0, Math.min(1, dy / panelHeight))));
          } catch (_) {}
        };

        const onPointerEnd = (e) => {
          try {
            if (!isDragging || e.pointerId !== currentPointerId) return;
            isDragging = false;
            sheet.classList.remove('dragging');

            try {
              handle.releasePointerCapture(e.pointerId);
            } catch (_) {}

            const now = performance.now();
            // push the release point into history before computing velocity
            history.push({ y: e.clientY, t: now });
            if (history.length > 6) history.shift();

            const recent = history.filter((pt) => now - pt.t <= 100);
            let v = 0;
            if (recent.length >= 2) {
              const first = recent[0];
              const last = recent[recent.length - 1];
              const dt = (last.t - first.t) / 1000;
              if (dt > 0.0001) {
                v = (last.y - first.y) / dt;
              }
            }

            const totalDy = e.clientY - startY;
            if (Math.abs(totalDy) < 4) {
              sheet.style.removeProperty('--drag-y');
              sheet.style.removeProperty('--drag-progress');
              return;
            }

            const projected = totalDy + (v / 1000) * (0.998 / (1 - 0.998));
            if (projected > panelHeight * 0.5 || v > 1000) {
              // Click backdrop and remove --drag-y/--drag-progress in a setTimeout of 480ms
              try {
                const backdrop = sheet.querySelector('.sheet-backdrop');
                if (backdrop) backdrop.click();
              } catch (_) {}
              setTimeout(() => {
                try {
                  sheet.style.removeProperty('--drag-y');
                  sheet.style.removeProperty('--drag-progress');
                } catch (_) {}
              }, 480);
            } else {
              sheet.style.removeProperty('--drag-y');
              sheet.style.removeProperty('--drag-progress');
            }
          } catch (_) {}
        };

        handle.addEventListener('pointerdown', (e) => {
          try {
            if (e.button !== 0) return;
            if (e.target && e.target.closest && e.target.closest('button')) return;
            if (!sheet.classList.contains('open')) return;

            const p = panel || sheet.querySelector('.sheet-panel');
            if (!p) return;
            panelHeight = p.getBoundingClientRect().height;
            if (panelHeight <= 0) return;

            currentPointerId = e.pointerId;
            isDragging = true;
            startY = e.clientY;
            history = [{ y: e.clientY, t: performance.now() }];
            sheet.classList.add('dragging');

            try {
              handle.setPointerCapture(e.pointerId);
            } catch (_) {}
          } catch (_) {}
        });

        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerEnd);
        handle.addEventListener('pointercancel', onPointerEnd);
      });
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 8: ESCAPE KEY CLOSES SETTINGS SHEET
     ========================================================================== */
  try {
    document.addEventListener('keydown', (e) => {
      try {
        if (e.key === 'Escape' || e.key === 'Esc') {
          const sheet = document.querySelector('#settings-sheet');
          if (sheet && sheet.classList.contains('open')) {
            const backdrop = sheet.querySelector('.sheet-backdrop');
            if (backdrop) {
              backdrop.click();
            }
          }
        }
      } catch (_) {}
    });
  } catch (_) {}

  /* ==========================================================================
     Feature 9: CSS :has() FALLBACK FOR BOTTOM TABS
     ========================================================================== */
  try {
    const statsPanel = document.querySelector('#stats-panel');
    const bottomTabs = document.querySelector('nav.bottom-tabs');
    if (statsPanel && bottomTabs) {
      const syncStatsTab = () => {
        try {
          const isActive = statsPanel.classList.contains('active');
          bottomTabs.classList.toggle('stats-active', isActive);
        } catch (_) {}
      };
      syncStatsTab();
      if (typeof MutationObserver !== 'undefined') {
        const statsTabObserver = new MutationObserver(syncStatsTab);
        statsTabObserver.observe(statsPanel, { attributes: true, attributeFilter: ['class'] });
      }
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 10: HEADER DATE (Turkish)
     ========================================================================== */
  try {
    function updateHeaderDate() {
      const headerDate = document.querySelector('span#header-date');
      if (headerDate) {
        const now = new Date();
        const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(now);
        const weekdayStr = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(now);
        const weekday = weekdayStr ? weekdayStr.charAt(0).toLocaleUpperCase('tr-TR') + weekdayStr.slice(1) : '';
        headerDate.textContent = `${dayMonth}, ${weekday}`;
      }
    }
    updateHeaderDate();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateHeaderDate, { once: true });
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 11: PERSON COLOR (--me-color)
     ========================================================================== */
  try {
    function updatePersonColor() {
      const headerName = document.querySelector('strong#header-name');
      const name = headerName ? headerName.textContent.trim() : '';
      const color = name === 'Eylül' ? '#5aa7d8' : '#d96f97';
      if (document.body && document.body.style) {
        document.body.style.setProperty('--me-color', color);
      }
      return headerName;
    }

    const headerName = updatePersonColor();
    if (headerName && typeof MutationObserver !== 'undefined') {
      const nameObserver = new MutationObserver(() => {
        try {
          updatePersonColor();
        } catch (_) {}
      });
      nameObserver.observe(headerName, { characterData: true, childList: true, subtree: true });
    } else if (typeof MutationObserver !== 'undefined') {
      const bodyObserver = new MutationObserver(() => {
        try {
          const hn = document.querySelector('strong#header-name');
          if (hn) {
            updatePersonColor();
            bodyObserver.disconnect();
            const nameObserver = new MutationObserver(() => {
              try {
                updatePersonColor();
              } catch (_) {}
            });
            nameObserver.observe(hn, { characterData: true, childList: true, subtree: true });
          }
        } catch (_) {}
      });
      if (document.body) {
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      }
    }
  } catch (_) {}

  /* ==========================================================================
     Feature 12: HEADER SCROLL EDGE
     ========================================================================== */
  try {
    const appShell = document.querySelector('#app-shell') || document.querySelector('.app-shell');
    const scrollContainers = document.querySelectorAll('.panel-scroll');
    const panels = document.querySelectorAll('.panel');

    function updateScrolled() {
      if (!appShell) return;
      const activePanel = document.querySelector('.panel.active');
      if (!activePanel) {
        appShell.classList.remove('scrolled');
        return;
      }
      const scrollEl =
        activePanel.querySelector('.panel-scroll') ||
        (activePanel.classList.contains('panel-scroll') ? activePanel : null);
      if (scrollEl) {
        appShell.classList.toggle('scrolled', scrollEl.scrollTop > 4);
      } else {
        appShell.classList.remove('scrolled');
      }
    }

    scrollContainers.forEach((el) => {
      el.addEventListener(
        'scroll',
        () => {
          try {
            const parentPanel = el.closest('.panel');
            if (parentPanel && parentPanel.classList.contains('active')) {
              if (appShell) {
                appShell.classList.toggle('scrolled', el.scrollTop > 4);
              }
            }
          } catch (_) {}
        },
        { passive: true }
      );
    });

    if (panels.length > 0 && typeof MutationObserver !== 'undefined') {
      const panelObserver = new MutationObserver(() => {
        try {
          updateScrolled();
        } catch (_) {}
      });
      panels.forEach((p) => {
        panelObserver.observe(p, { attributes: true, attributeFilter: ['class'] });
      });
    }

    updateScrolled();
  } catch (_) {}
})();
