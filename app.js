import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG ?? {};

const EMAIL_NAMES = {
  "dyptenker@gmail.com": "Emir",
  "eylsfyvaryemez@gmail.com": "Eylül",
};

const PERSON_COLORS = {
  "Emir": "#d96f97",
  "Eylül": "#5aa7d8",
};

const els = {
  boot: document.querySelector("#boot-screen"),
  authView: document.querySelector("#auth-view"),
  appShell: document.querySelector("#app-shell"),
  passwordForm: document.querySelector("#password-form"),
  magicForm: document.querySelector("#magic-form"),
  switchToMagic: document.querySelector("#switch-to-magic"),
  switchToPassword: document.querySelector("#switch-to-password"),
  pwEmail: document.querySelector("#pw-email"),
  pwPass: document.querySelector("#pw-pass"),
  magicEmail: document.querySelector("#magic-email"),
  headerKicker: document.querySelector("#header-kicker"),
  headerName: document.querySelector("#header-name"),
  settingsOpen: document.querySelector("#settings-open"),
  settingsSheet: document.querySelector("#settings-sheet"),
  settingsName: document.querySelector("#settings-name"),
  settingsPersonMark: document.querySelector("#settings-person-mark"),
  signOut: document.querySelector("#sign-out"),
  notifyToggle: document.querySelector("#notify-toggle"),
  passwordChangeForm: document.querySelector("#password-change-form"),
  newPassword: document.querySelector("#new-password"),
  todoForm: document.querySelector("#todo-form"),
  todoInput: document.querySelector("#todo-input"),
  todoList: document.querySelector("#todo-list"),
  todoTemplate: document.querySelector("#todo-template"),
  todoCount: document.querySelector("#todo-count"),
  emptyTodos: document.querySelector("#empty-todos"),
  refreshTodos: document.querySelector("#refresh-todos"),
  syncState: document.querySelector("#sync-state"),
  todoProgress: document.querySelector("#todo-progress"),
  todoProgressArc: document.querySelector("#todo-progress-arc"),
  todoProgressLabel: document.querySelector("#todo-progress-label"),
  statsBody: document.querySelector("#stats-body"),
  toast: document.querySelector("#toast"),
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const bootStartedAt = Date.now();

let currentUser = null;
let currentName = "";
let settings = { notify_new_items: true };
let todosChannel;
let pushListenersBound = false;
let allTodos = [];
let toastTimer;

bindEvents();
registerServiceWorker();
boot();

async function boot() {
  const { data: { session } } = await supabase.auth.getSession();

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp(session);
    } else {
      showAuth();
    }
  });

  if (session) {
    await showApp(session);
  } else {
    showAuth();
  }

  finishBoot();
}

function bindEvents() {
  els.switchToMagic.addEventListener("click", () => {
    els.passwordForm.hidden = true;
    els.magicForm.hidden = false;
    els.magicEmail.value = els.pwEmail.value;
    els.magicEmail.focus();
  });

  els.switchToPassword.addEventListener("click", () => {
    els.magicForm.hidden = true;
    els.passwordForm.hidden = false;
    els.pwEmail.value = els.magicEmail.value;
    els.pwEmail.focus();
  });

  els.passwordForm.addEventListener("submit", signInWithPassword);
  els.magicForm.addEventListener("submit", sendMagicLink);
  els.signOut.addEventListener("click", signOut);
  els.todoForm.addEventListener("submit", createTodo);
  els.refreshTodos.addEventListener("click", () => renderTodos({ announce: true }));
  els.passwordChangeForm.addEventListener("submit", changePassword);

  els.notifyToggle.addEventListener("change", async () => {
    settings.notify_new_items = els.notifyToggle.checked;
    await saveUserSettings();
    if (settings.notify_new_items) {
      await registerPushToken();
      if (typeof Notification !== "undefined") {
        if (Notification.permission === "default") {
          try { await Notification.requestPermission(); } catch {}
          if (Notification.permission !== "default") {
            localStorage.setItem("web_notif_asked_v2", "1");
          }
        }
        if (Notification.permission === "granted") {
          await subscribeWebPush();
        } else if (Notification.permission === "denied") {
          showToast("Bildirim izni kapalı, tarayıcı ayarlarından açabilirsin.");
        }
      }
    } else {
      await disableDeviceTokens();
      await unsubscribeWebPush();
    }
    showToast(settings.notify_new_items ? "Bildirimler açıldı." : "Bildirimler kapatıldı.");
  });

  els.settingsOpen.addEventListener("click", openSettings);
  document.querySelectorAll("[data-close-settings]").forEach((button) => {
    button.addEventListener("click", closeSettings);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSettings();
    }
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
}

async function signInWithPassword(event) {
  event.preventDefault();
  const button = els.passwordForm.querySelector(".button-primary");
  setButtonBusy(button, "Giriliyor...");

  await maybePromptNotificationPermission();

  const { error } = await supabase.auth.signInWithPassword({
    email: els.pwEmail.value.trim(),
    password: els.pwPass.value,
  });

  restoreButton(button);
  if (error) {
    showToast("Giriş yapamadık, bilgileri bir kontrol et.");
    return;
  }

  els.passwordForm.reset();
}

async function sendMagicLink(event) {
  event.preventDefault();
  const button = els.magicForm.querySelector(".button-primary");
  setButtonBusy(button, "Gönderiliyor...");

  await maybePromptNotificationPermission();

  const { error } = await supabase.auth.signInWithOtp({
    email: els.magicEmail.value.trim(),
    options: { emailRedirectTo: window.location.href },
  });

  restoreButton(button);
  if (error) {
    showToast("Bağlantı gönderilemedi, tekrar dener misin?");
    return;
  }

  els.magicForm.reset();
  showToast("Giriş bağlantısını e-postana yolladık!");
}

async function showApp(session) {
  currentUser = session.user;
  currentName = displayNameForEmail(currentUser.email);
  els.authView.hidden = true;
  els.appShell.hidden = false;
  els.headerKicker.textContent = "merhaba";
  updatePersonChrome();

  await loadUserSettings();
  await renderTodos();
  subscribeRealtime();

  if (settings.notify_new_items) {
    registerPushToken();
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      subscribeWebPush();
    } else {
      armFirstGesturePrompt();
    }
  }
}

function showAuth() {
  currentUser = null;
  currentName = "";
  unsubscribeRealtime();
  els.appShell.hidden = true;
  els.authView.hidden = false;
  els.passwordForm.hidden = false;
  els.magicForm.hidden = true;
  closeSettings();
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  showAuth();
}

async function loadUserSettings() {
  settings = { notify_new_items: true };
  els.notifyToggle.checked = true;

  const { data, error } = await supabase
    .from("user_settings")
    .select("notify_new_items, display_name")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!error && data) {
    settings.notify_new_items = data.notify_new_items !== false;
    currentName = data.display_name || currentName;
  }

  els.notifyToggle.checked = settings.notify_new_items;
  updatePersonChrome();

  await saveUserSettings({ quiet: true });
}

async function saveUserSettings({ quiet = false } = {}) {
  if (!currentUser) return;

  const { error } = await supabase.from("user_settings").upsert({
    user_id: currentUser.id,
    display_name: currentName,
    notify_new_items: settings.notify_new_items,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error && !quiet) {
    showToast("Ayar kaydedilemedi.");
  }
}

function updatePersonChrome() {
  els.settingsName.textContent = currentName;
  els.headerName.textContent = currentName;
  if (els.settingsPersonMark) {
    els.settingsPersonMark.src = currentName === "Eylül" ? "./in_app_e_blue.png" : "./in_app_e_pink.png";
  }
}

async function changePassword(event) {
  event.preventDefault();
  const password = els.newPassword.value.trim();
  if (password.length < 6) {
    showToast("Şifre en az 6 karakter olmalı.");
    return;
  }

  const button = els.passwordChangeForm.querySelector("button");
  setButtonBusy(button, "Kaydediliyor...");
  const { error } = await supabase.auth.updateUser({ password });
  restoreButton(button);

  if (error) {
    showToast("Şifre güncellenemedi, tekrar dener misin?");
    return;
  }

  els.passwordChangeForm.reset();
  showToast("Şifren güncellendi!");
}

async function createTodo(event) {
  event.preventDefault();
  const body = els.todoInput.value.trim();
  if (!body || !currentUser) return;

  const tempTodo = {
    id: `temp-${Date.now()}`,
    body,
    is_done: false,
    created_at: new Date().toISOString(),
    created_by: currentUser.id,
    added_by: currentName,
    pending: true,
  };

  els.todoInput.value = "";
  appendTodo(tempTodo, { prepend: true });
  updateTodoMeta();
  setSyncState("ekleniyor");

  const { data, error } = await supabase
    .from("todos")
    .insert({
      body,
      created_by: currentUser.id,
      added_by: currentName,
    })
    .select("id, body, is_done, created_at, created_by, added_by")
    .single();

  if (error) {
    removeTodoNode(tempTodo.id);
    updateTodoMeta();
    setSyncState("hata");
    showToast("Eklenemedi.");
    return;
  }

  replaceTodoNode(tempTodo.id, data);
  updateTodoMeta();
  setSyncState("kaydedildi");
  notifyOtherUser(data.id);
}

async function renderTodos({ announce = false } = {}) {
  if (!currentUser) return;
  els.refreshTodos.classList.add("spinning");
  setSyncState("yenileniyor");

  const { data, error } = await supabase
    .from("todos")
    .select("id, body, is_done, created_at, created_by, added_by")
    .order("is_done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    els.refreshTodos.classList.remove("spinning");
    setSyncState("hata");
    showToast("Liste yüklenemedi, bir terslik oldu.");
    return;
  }

  allTodos = data;
  els.todoList.innerHTML = "";
  data.forEach((todo) => appendTodo(todo));
  renderStats();
  updateTodoMeta();
  setSyncState("güncel");
  els.refreshTodos.classList.remove("spinning");
  if (announce) showToast("Liste yenilendi.");
}

function appendTodo(todo, { prepend = false } = {}) {
  const fragment = els.todoTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".todo-item");
  const check = fragment.querySelector(".todo-check");
  const text = fragment.querySelector(".todo-text");
  const person = fragment.querySelector(".todo-person");
  const date = fragment.querySelector(".todo-date");
  const deleteButton = fragment.querySelector(".delete-item");
  const name = todo.added_by || nameForUserId(todo.created_by);

  item.dataset.id = todo.id;
  item.classList.toggle("done", todo.is_done);
  item.classList.toggle("pending", Boolean(todo.pending));
  item.style.setProperty("--person-color", PERSON_COLORS[name] || PERSON_COLORS.Emir);
  text.textContent = todo.body;
  person.textContent = name;
  date.textContent = formatTodoDate(todo.created_at);

  check.addEventListener("click", () => toggleTodo(todo, item));
  deleteButton.addEventListener("click", () => deleteTodo(todo.id, item));

  if (prepend) {
    els.todoList.prepend(fragment);
  } else {
    els.todoList.appendChild(fragment);
  }
}

async function toggleTodo(todo, item) {
  if (todo.id.startsWith("temp-")) return;

  const next = !item.classList.contains("done");
  item.classList.toggle("done", next);

  const { error } = await supabase
    .from("todos")
    .update({ is_done: next })
    .eq("id", todo.id);

  if (error) {
    item.classList.toggle("done", !next);
    showToast("Kaydedemedik, tekrar dener misin?");
    return;
  }

  setTimeout(renderTodos, 560);
}

async function deleteTodo(id, item) {
  if (id.startsWith("temp-")) return;
  item.classList.add("removing");

  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) {
    item.classList.remove("removing");
    showToast("Silinemedi.");
    return;
  }

  allTodos = allTodos.filter((todo) => todo.id !== id);
  renderStats();
  setTimeout(() => {
    item.remove();
    updateTodoMeta();
  }, 170);
}

function replaceTodoNode(tempId, todo) {
  removeTodoNode(tempId);
  appendTodo(todo, { prepend: true });
}

function removeTodoNode(id) {
  els.todoList.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
}

function updateTodoMeta() {
  const count = els.todoList.querySelectorAll(".todo-item").length;
  els.todoCount.textContent = `${count} şey`;
  els.emptyTodos.hidden = count > 0;
  const done = els.todoList.querySelectorAll(".todo-item.done").length;
  const percent = count ? Math.round((done / count) * 100) : 0;
  els.todoProgressArc.setAttribute("stroke-dasharray", `${percent} 100`);
  els.todoProgressLabel.textContent = `%${percent}`;
  els.todoProgress.setAttribute("aria-label", `%${percent} tamamlanan`);
}

function renderStats() {
  const people = Object.keys(PERSON_COLORS);
  const nameOf = (todo) => todo.added_by || nameForUserId(todo.created_by);
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
  const total = allTodos.length;
  const done = allTodos.filter((todo) => todo.is_done).length;

  const byPerson = people.map((name) => {
    const mine = allTodos.filter((todo) => nameOf(todo) === name);
    const mineDone = mine.filter((todo) => todo.is_done).length;
    return { name, added: mine.length, done: mineDone };
  });

  const months = new Map();
  allTodos.forEach((todo) => {
    const date = new Date(todo.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!months.has(key)) {
      months.set(key, { key, date, added: 0, done: 0, people: Object.fromEntries(people.map((p) => [p, { added: 0, done: 0 }])) });
    }
    const month = months.get(key);
    const person = month.people[nameOf(todo)];
    month.added += 1;
    if (todo.is_done) month.done += 1;
    if (person) {
      person.added += 1;
      if (todo.is_done) person.done += 1;
    }
  });
  const monthList = [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
  const busiest = monthList.reduce((best, m) => (!best || m.added > best.added ? m : best), null);
  const now = new Date();
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = months.get(thisKey)?.added || 0;
  const lastMonth = months.get(lastKey)?.added || 0;
  const monthName = (date) => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(date);
  const shortMonthName = (date) => new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(date);
  const split = (values) => values.map(({ name, value }) =>
    `<i style="width:${value}%;background:${PERSON_COLORS[name]}"></i>`).join("");

  if (!total) {
    els.statsBody.innerHTML = `<p class="empty-state">Henüz buralar boş. Bir şeyler yaptıkça burası dolacak!</p>`;
    return;
  }

  // Hero Donut geometry (168px viewBox: cx=84 cy=84 r=66 outer, r=50 inner)
  const outerCircumference = 414.69; // 2 * PI * 66
  const donePct = pct(done, total);
  const outerOffset = outerCircumference * (1 - done / total);

  const innerCircumference = 314.16; // 2 * PI * 50
  const emirObj = byPerson.find((p) => p.name === "Emir") || { added: 0, done: 0 };
  const eylulObj = byPerson.find((p) => p.name === "Eylül") || { added: 0, done: 0 };
  const emirShare = total ? (emirObj.added / total) : 0.5;
  const emirArc = emirShare * innerCircumference;
  const eylulArc = innerCircumference - emirArc;

  const thisMonthObj = months.get(thisKey);
  const emirThis = thisMonthObj?.people?.["Emir"]?.added || 0;
  const eylulThis = thisMonthObj?.people?.["Eylül"]?.added || 0;
  let aheadText = "Bu ay başa baş gidiyorsunuz!";
  if (emirThis === 0 && eylulThis === 0) {
    aheadText = "Bu ay henüz bir şey eklemediniz.";
  } else if (emirThis > eylulThis) {
    aheadText = "Bu ay Emir önde gidiyor!";
  } else if (eylulThis > emirThis) {
    aheadText = "Bu ay Eylül önde gidiyor!";
  }

  let summaryMain = "";
  if (total === 0) {
    summaryMain = "Birlikte henüz bir şey eklemediniz.";
  } else if (done === 0) {
    summaryMain = total === 1
      ? "Birlikte 1 şey eklediniz, henüz yapmadınız."
      : `Birlikte ${total} şey eklediniz, henüz hiçbirini yapmadınız.`;
  } else if (done === total) {
    summaryMain = total === 1
      ? "Birlikte 1 şey eklediniz, onu da yaptınız!"
      : `Birlikte ${total} şey eklediniz, hepsini yaptınız!`;
  } else {
    summaryMain = `Birlikte ${total} şey eklediniz, ${done} tanesini yaptınız.`;
  }

  // Race calculations (relative to max added between the two)
  const maxRace = Math.max(emirObj.added, eylulObj.added, 1);
  const emirMarkerPct = Math.min(100, Math.round((emirObj.done / maxRace) * 100));
  const eylulMarkerPct = Math.min(100, Math.round((eylulObj.done / maxRace) * 100));

  const last6Months = monthList.slice(0, 6).reverse();
  const maxAdded = Math.max(
    ...last6Months.flatMap((m) => [m.people["Emir"]?.added || 0, m.people["Eylül"]?.added || 0]),
    1
  );

  els.statsBody.innerHTML = `
    <!-- 1. Hero Card -->
    <div class="stats-hero">
      <div class="stats-hero-tape"></div>
      <div class="stats-hero-donut">
        <svg viewBox="0 0 168 168" width="168" height="168" class="hero-svg">
          <!-- Outer track -->
          <circle cx="84" cy="84" r="66" fill="none" stroke="var(--ink-faint)" stroke-width="9" stroke-dasharray="2 6" stroke-linecap="round"/>
          <!-- Outer completion arc -->
          <circle cx="84" cy="84" r="66" fill="none" stroke="var(--green)" stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${outerCircumference}" stroke-dashoffset="${outerOffset}"
            class="hero-outer-arc" style="--outer-offset: ${outerOffset};"
            transform="rotate(-90 84 84)"/>

          <!-- Inner track -->
          <circle cx="84" cy="84" r="50" fill="none" stroke="var(--paper-deep)" stroke-width="7" opacity="0.5"/>
          <!-- Inner share ring -->
          <circle cx="84" cy="84" r="50" fill="none" stroke="var(--pink)" stroke-width="7"
            stroke-dasharray="${emirArc} ${innerCircumference}" stroke-dashoffset="0"
            class="hero-inner-arc" style="--start-offset: ${innerCircumference}; --end-offset: 0;"
            transform="rotate(-90 84 84)"/>
          <circle cx="84" cy="84" r="50" fill="none" stroke="var(--blue)" stroke-width="7"
            stroke-dasharray="${eylulArc} ${innerCircumference}" stroke-dashoffset="-${emirArc}"
            class="hero-inner-arc" style="--start-offset: ${innerCircumference - emirArc}; --end-offset: -${emirArc};"
            transform="rotate(-90 84 84)"/>

          <!-- Center percentage -->
          <g class="hero-donut-center">
            <text x="84" y="82" class="hero-donut-pct">%${donePct}</text>
            <text x="84" y="102" class="hero-donut-sub">bitti</text>
          </g>
        </svg>
      </div>

      <div class="stats-hero-text">
        <p class="hero-summary-main">${summaryMain}</p>
        <p class="hero-summary-ahead">${aheadText}</p>
        <div class="hero-legend">
          <span class="legend-item"><i style="background:var(--green)"></i>yapıldı</span>
          <span class="legend-item"><i style="background:var(--pink)"></i>Emir</span>
          <span class="legend-item"><i style="background:var(--blue)"></i>Eylül</span>
        </div>
      </div>
    </div>

    <!-- 2. Stat Grid (Index Cards with tiny hand-drawn icons) -->
    <div class="stat-grid">
      <div class="stat-tile">
        <svg class="tile-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <strong>${total}</strong>
        <span>eklenen</span>
      </div>
      <div class="stat-tile">
        <svg class="tile-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <strong>${done}</strong>
        <span>yapılan</span>
      </div>
      <div class="stat-tile">
        <svg class="tile-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
        </svg>
        <strong>${total - done}</strong>
        <span>kalan</span>
      </div>
      <div class="stat-tile">
        <svg class="tile-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <strong>%${donePct}</strong>
        <span>tamamlanan</span>
      </div>
    </div>

    <!-- 3. Playful Race Card -->
    <div class="stats-card stats-race-card">
      <div class="race-washi-tape"></div>
      <div class="card-title">
        <span>yarış</span>
      </div>
      <div class="race-tracks">
        <div class="race-track-row">
          <div class="race-track-top">
            <span class="race-name" style="color: var(--pink-deep);">Emir</span>
            <div class="race-line-wrap">
              <div class="race-dotted-line"></div>
              <div class="stat-bar race-bar">
                <i style="width:${emirMarkerPct}%; background: var(--pink);"></i>
              </div>
              <div class="race-marker" style="left: ${emirMarkerPct}%; background: var(--pink); border-color: var(--pink-deep);" title="Emir: ${emirObj.done} yaptı">
                E
              </div>
            </div>
          </div>
          <div class="race-sub">
            <span>${emirObj.added} ekledi</span> · <span>${emirObj.done} yaptı</span>
          </div>
        </div>

        <div class="race-track-row">
          <div class="race-track-top">
            <span class="race-name" style="color: var(--blue-deep);">Eylül</span>
            <div class="race-line-wrap">
              <div class="race-dotted-line"></div>
              <div class="stat-bar race-bar">
                <i style="width:${eylulMarkerPct}%; background: var(--blue);"></i>
              </div>
              <div class="race-marker" style="left: ${eylulMarkerPct}%; background: var(--blue); border-color: var(--blue-deep);" title="Eylül: ${eylulObj.done} yaptı">
                E
              </div>
            </div>
          </div>
          <div class="race-sub">
            <span>${eylulObj.added} ekledi</span> · <span>${eylulObj.done} yaptı</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Monthly Breakdown Chart -->
    <div class="stats-card monthly-chart-card">
      <div class="card-title">
        <span>aylara göre</span>
      </div>
      <div class="chart-container">
        ${last6Months.map((m, idx) => {
          const isNewest = idx === last6Months.length - 1;
          const emirAdded = m.people["Emir"]?.added || 0;
          const emirDone = m.people["Emir"]?.done || 0;
          const eylulAdded = m.people["Eylül"]?.added || 0;
          const eylulDone = m.people["Eylül"]?.done || 0;
          const emirPct = Math.round((emirAdded / maxAdded) * 100);
          const eylulPct = Math.round((eylulAdded / maxAdded) * 100);
          return `
            <div class="chart-month-group ${isNewest ? 'is-newest' : ''}" tabindex="0">
              <div class="month-tooltip">
                <span class="tooltip-heading">${monthName(m.date)}</span>
                <span class="tooltip-counts">${m.added} eklendi · ${m.done} yapıldı</span>
                <span class="tooltip-people">Emir: ${emirDone}/${emirAdded} · Eylül: ${eylulDone}/${eylulAdded}</span>
              </div>
              <div class="chart-bars">
                <div class="chart-col col-emir">
                  <div class="chart-bar-col" style="height:${emirPct}%; --delay: ${idx * 60}ms;">
                    <div class="col-fill col-hatched" style="height:${pct(emirAdded - emirDone, emirAdded || 1)}%"></div>
                    <div class="col-fill col-solid" style="height:${pct(emirDone, emirAdded || 1)}%"></div>
                  </div>
                </div>
                <div class="chart-col col-eylul">
                  <div class="chart-bar-col" style="height:${eylulPct}%; --delay: ${idx * 60 + 30}ms;">
                    <div class="col-fill col-hatched" style="height:${pct(eylulAdded - eylulDone, eylulAdded || 1)}%"></div>
                    <div class="col-fill col-solid" style="height:${pct(eylulDone, eylulAdded || 1)}%"></div>
                  </div>
                </div>
              </div>
              <div class="chart-month-label">
                ${isNewest ? '<span class="newest-swipe"></span>' : ''}
                <span class="label-text">${shortMonthName(m.date)}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="chart-baseline"></div>
      <div class="chart-legend">
        <span class="legend-item"><i style="background:var(--pink)"></i>Emir yaptı</span>
        <span class="legend-item"><i class="hatched-icon pink"></i>kalan</span>
        <span class="legend-item" style="margin-left:8px"><i style="background:var(--blue)"></i>Eylül yaptı</span>
        <span class="legend-item"><i class="hatched-icon blue"></i>kalan</span>
      </div>
    </div>

    <!-- 5. Ruled Paper Note -->
    ${busiest && busiest.added > 0 ? `
      <div class="ruled-paper-note">
        <div class="note-pin"></div>
        <p>En çok şeyi <strong>${monthName(busiest.date)}</strong> ayında eklediniz (<strong>${busiest.added}</strong> şey).</p>
        <p>Bu ay <strong>${thisMonth}</strong> yeni şey eklendi${lastMonth ? `, geçen ay <strong>${lastMonth}</strong> eklenmişti.` : "."}</p>
      </div>
    ` : ""}

    <!-- 6. Compact Monthly Breakdown -->
    <div class="stats-card">
      <div class="card-title"><span>ay ay baktığımızda</span></div>
      ${monthList.map((m) => `
        <div class="stat-row compact-month-stat">
          <div class="stat-row-head">
            <span>${monthName(m.date)}</span>
            <strong>${m.added} şey</strong>
          </div>
          <div class="compact-month-meta">${m.done} yapıldı (%${pct(m.done, m.added)})</div>
          <div class="stat-split">${split(people.map((name) => ({ name, value: pct(m.people[name]?.added || 0, m.added) })))}</div>
          <div class="month-people-row">
            ${people.map((name) => {
              const p = m.people[name];
              if (!p || !p.added) return "";
              return `<span class="month-person-badge" style="--person-color:${PERSON_COLORS[name]}">${name}: ${p.done}/${p.added}</span>`;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function setSyncState(label) {
  els.syncState.textContent = label;
}

function subscribeRealtime() {
  unsubscribeRealtime();
  todosChannel = supabase
    .channel("shared-todos")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "todos" }, (payload) => {
      const row = payload?.new;
      if (row && currentUser && row.created_by && row.created_by !== currentUser.id) {
        showWebNotification(row);
      }
      renderTodos();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "todos" }, () => renderTodos())
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "todos" }, () => renderTodos())
    .subscribe();
}

function showWebNotification(todo) {
  if (!settings.notify_new_items) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const title = todo.added_by ? `${todo.added_by} yeni bir şey ekledi` : "Yeni bir şey eklendi";
  const body = todo.body || "";
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: "./pwa-icon-192.png",
          badge: "./pwa-icon-192.png",
          tag: `todo-${todo.id}`,
        }).catch(() => undefined);
      });
    } else {
      new Notification(title, { body, icon: "./pwa-icon-192.png" });
    }
  } catch {}
}

async function maybePromptNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (window.Capacitor?.isNativePlatform?.()) return;
  if (Notification.permission !== "default") return;
  if (localStorage.getItem("web_notif_asked_v2") === "1") return;
  try {
    await Notification.requestPermission();
  } catch {}
  if (Notification.permission !== "default") {
    localStorage.setItem("web_notif_asked_v2", "1");
  }
  if (Notification.permission === "granted") {
    subscribeWebPush();
  }
}

let firstGestureArmed = false;
function armFirstGesturePrompt() {
  if (firstGestureArmed) return;
  if (typeof Notification === "undefined") return;
  if (window.Capacitor?.isNativePlatform?.()) return;
  if (Notification.permission !== "default") return;
  if (localStorage.getItem("web_notif_asked_v2") === "1") return;
  firstGestureArmed = true;
  const handler = async () => {
    document.removeEventListener("click", handler, true);
    document.removeEventListener("touchend", handler, true);
    await maybePromptNotificationPermission();
  };
  document.addEventListener("click", handler, true);
  document.addEventListener("touchend", handler, true);
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function subscribeWebPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!currentUser) return;
    const vapidPublic = window.APP_CONFIG?.VAPID_PUBLIC_KEY;
    if (!vapidPublic) return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
    }

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!json.endpoint || !p256dh || !auth) return;

    await supabase.from("web_push_subscriptions").upsert({
      user_id: currentUser.id,
      endpoint: json.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
  } catch (err) {
    console.warn("web push subscribe failed", err);
  }
}

async function unsubscribeWebPush() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    if (currentUser) {
      await supabase
        .from("web_push_subscriptions")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("endpoint", sub.endpoint);
    }
  } catch {}
}

function unsubscribeRealtime() {
  if (todosChannel) supabase.removeChannel(todosChannel);
  todosChannel = undefined;
}

async function registerPushToken() {
  const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
  if (!currentUser || !PushNotifications) return;

  bindPushListeners(PushNotifications);

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    showToast("Bildirim izni verilmedi.");
    return;
  }

  if (platformName() === "android" && PushNotifications.createChannel) {
    await PushNotifications.createChannel({
      id: "new_items",
      name: "Yeni eklenenler",
      description: "2E ortak liste bildirimleri",
      importance: 4,
      visibility: 1,
      sound: "default",
      vibration: true,
    }).catch(() => undefined);
  }

  await PushNotifications.register();
}

function bindPushListeners(PushNotifications) {
  if (pushListenersBound) return;
  pushListenersBound = true;

  PushNotifications.addListener("registration", async ({ value }) => {
    if (!currentUser || !value) return;
    await supabase.from("device_tokens").upsert({
      user_id: currentUser.id,
      token: value,
      platform: platformName(),
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token" });
  });

  PushNotifications.addListener("registrationError", () => {
    showToast("Bildirim ayarlanamadı.");
  });
}

async function disableDeviceTokens() {
  if (!currentUser) return;
  await supabase
    .from("device_tokens")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", currentUser.id);
}

async function notifyOtherUser(todoId) {
  if (!settings.notify_new_items) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.functions.invoke("send-new-item-notification", {
    body: { todo_id: todoId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => undefined);
}

function openSettings() {
  els.settingsSheet.classList.add("open");
  els.settingsSheet.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  els.settingsSheet.classList.remove("open");
  els.settingsSheet.setAttribute("aria-hidden", "true");
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelector("#todo-panel").classList.toggle("active", tabName === "todo");
  document.querySelector("#stats-panel").classList.toggle("active", tabName === "stats");
}

function finishBoot() {
  const remaining = Math.max(0, 1850 - (Date.now() - bootStartedAt));
  setTimeout(() => {
    els.boot.classList.add("done");
    setTimeout(() => { els.boot.hidden = true; }, 560);
  }, remaining);
}

function setButtonBusy(button, label) {
  button.dataset.originalText = button.textContent;
  button.textContent = label;
  button.disabled = true;
}

function restoreButton(button) {
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function displayNameForEmail(email = "") {
  return EMAIL_NAMES[email.toLowerCase()] || "2E";
}

function nameForUserId(uid) {
  if (!currentUser) return "2E";
  if (uid === currentUser.id) return currentName;
  return currentName === "Emir" ? "Eylül" : "Emir";
}

function formatTodoDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function platformName() {
  return window.Capacitor?.getPlatform?.() || "web";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
