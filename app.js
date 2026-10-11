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
          showToast("Tarayıcı bildirim izni kapalı. Site ayarlarından aç.");
        }
      }
    } else {
      await disableDeviceTokens();
      await unsubscribeWebPush();
    }
    showToast(settings.notify_new_items ? "Bildirimler açık." : "Bildirimler kapalı.");
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
    showToast("Giriş olmadı. Bilgileri kontrol et.");
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
    showToast("Bağlantı gönderilemedi.");
    return;
  }

  els.magicForm.reset();
  showToast("Giriş bağlantısı e-postana gönderildi.");
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
    showToast("Şifre değişmedi.");
    return;
  }

  els.passwordChangeForm.reset();
  showToast("Şifre değişti.");
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
    showToast("Liste alınamadı.");
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
    showToast("Değişiklik kaydedilemedi.");
    return;
  }

  setTimeout(renderTodos, 180);
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
  els.todoCount.textContent = `${count} öğe`;
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
  const split = (values) => values.map(({ name, value }) =>
    `<i style="width:${value}%;background:${PERSON_COLORS[name]}"></i>`).join("");

  if (!total) {
    els.statsBody.innerHTML = `<p class="empty-state">Henüz istatistik yok.</p>`;
    return;
  }

  els.statsBody.innerHTML = `
    <div class="stat-grid">
      <div class="stat-tile"><strong>${total}</strong><span>eklenen</span></div>
      <div class="stat-tile"><strong>${done}</strong><span>yapılan</span></div>
      <div class="stat-tile"><strong>${total - done}</strong><span>kalan</span></div>
      <div class="stat-tile"><strong>%${pct(done, total)}</strong><span>tamamlanan</span></div>
    </div>

    <div class="feed-meta"><span>kişi bazında</span><span>genel</span></div>
    <div class="stat-card">
      ${byPerson.map((p) => `
        <div class="person-stat" style="--person-color:${PERSON_COLORS[p.name]}">
          <div class="person-stat-head"><strong>${p.name}</strong><span>%${pct(p.done, p.added)} yapıldı</span></div>
          <div class="stat-bar"><i style="width:${pct(p.done, p.added)}%"></i></div>
          <p>${p.added} ekledi <b>·</b> ${p.done} yapıldı <b>·</b> ${p.added - p.done} kaldı</p>
          <p>pay: eklenen %${pct(p.added, total)} <b>·</b> yapılan %${pct(p.done, done)}</p>
        </div>`).join("")}
      <div class="split-label"><span>eklenen payı</span></div>
      <div class="stat-split">${split(byPerson.map((p) => ({ name: p.name, value: pct(p.added, total) })))}</div>
      <div class="split-label"><span>yapılan payı</span></div>
      <div class="stat-split">${split(byPerson.map((p) => ({ name: p.name, value: pct(p.done, done) })))}</div>
    </div>

    <div class="feed-meta"><span>analiz</span><span>${monthList.length} ay</span></div>
    <div class="stat-card stat-facts">
      <p><span>bu ay eklenen</span><strong>${thisMonth}</strong></p>
      <p><span>geçen ay eklenen</span><strong>${lastMonth}</strong></p>
      <p><span>aylık ortalama</span><strong>${(total / monthList.length).toFixed(1)}</strong></p>
      <p><span>en yoğun ay</span><strong>${monthName(busiest.date)} (${busiest.added})</strong></p>
    </div>

    <div class="feed-meta"><span>aylık</span><span>eklenen / yapılan</span></div>
    <div class="month-list">
      ${monthList.map((m) => `
        <div class="stat-card month-stat">
          <div class="person-stat-head"><strong>${monthName(m.date)}</strong><span>%${pct(m.done, m.added)} yapıldı</span></div>
          <div class="stat-bar"><i style="width:${pct(m.done, m.added)}%"></i></div>
          <p>${m.added} eklendi <b>·</b> ${m.done} yapıldı</p>
          ${people.map((name) => `<p class="month-person" style="--person-color:${PERSON_COLORS[name]}"><span>${name}</span>${m.people[name].added} ekledi · ${m.people[name].done} yapıldı</p>`).join("")}
        </div>`).join("")}
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
    showToast("Bildirim kaydı olmadı.");
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
