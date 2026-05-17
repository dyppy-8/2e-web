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
  journalBody: document.querySelector("#journal-body"),
  journalDate: document.querySelector("#journal-date"),
  journalStart: document.querySelector("#journal-start"),
  saveJournal: document.querySelector("#save-journal"),
  journalList: document.querySelector("#journal-list"),
  journalTemplate: document.querySelector("#journal-template"),
  journalCount: document.querySelector("#journal-count"),
  emptyJournal: document.querySelector("#empty-journal"),
  journalModal: document.querySelector("#journal-modal"),
  journalModalTitle: document.querySelector("#journal-modal-title"),
  journalModalTime: document.querySelector("#journal-modal-time"),
  journalModalBody: document.querySelector("#journal-modal-body"),
  journalModalDelete: document.querySelector("#journal-modal-delete"),
  toast: document.querySelector("#toast"),
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const bootStartedAt = Date.now();

let currentUser = null;
let currentName = "";
let settings = { notify_new_items: true };
let todosChannel;
let pushListenersBound = false;
let activeJournal = freshJournalDraft();
let selectedJournal = null;
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
  els.saveJournal.addEventListener("click", saveJournal);
  els.passwordChangeForm.addEventListener("submit", changePassword);

  els.notifyToggle.addEventListener("change", async () => {
    settings.notify_new_items = els.notifyToggle.checked;
    await saveUserSettings();
    if (settings.notify_new_items) {
      await registerPushToken();
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
        localStorage.setItem("web_notif_asked", "1");
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

  document.querySelectorAll("[data-close-journal]").forEach((button) => {
    button.addEventListener("click", closeJournalModal);
  });

  els.journalModalDelete.addEventListener("click", () => {
    if (!selectedJournal) return;
    deleteJournalEntry(selectedJournal.id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeJournalModal();
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
  await Promise.all([renderTodos(), renderJournalList()]);
  startNewJournal(false);
  subscribeRealtime();

  if (settings.notify_new_items) {
    registerPushToken();
    requestWebNotificationPermission();
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

  els.todoList.innerHTML = "";
  data.forEach((todo) => appendTodo(todo));
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
}

function setSyncState(label) {
  els.syncState.textContent = label;
}

function startNewJournal(focus = true) {
  activeJournal = freshJournalDraft();
  els.journalBody.value = "";
  updateJournalHeader();
  if (focus) els.journalBody.focus();
}

async function saveJournal() {
  if (!currentUser) return;
  const body = els.journalBody.value.trim();
  if (!body) {
    showToast("Günlüğe birkaç kelime yaz.");
    return;
  }

  setButtonBusy(els.saveJournal, "Kaydediliyor...");

  const now = new Date().toISOString();
  const payload = {
    id: activeJournal.id || crypto.randomUUID?.() || `journal-${Date.now()}`,
    body,
    entry_date: activeJournal.entry_date,
    started_at: activeJournal.started_at,
    created_by: currentUser.id,
    created_at: activeJournal.created_at || now,
    updated_at: now,
  };

  const entries = loadLocalJournals();
  const existingIndex = entries.findIndex((entry) => entry.id === payload.id);

  if (existingIndex >= 0) {
    entries[existingIndex] = payload;
  } else {
    entries.unshift(payload);
  }

  saveLocalJournals(entries);
  restoreButton(els.saveJournal);

  renderJournalList();
  startNewJournal(false);
  showToast("Günlük bu telefona kaydedildi.");
}

async function renderJournalList() {
  if (!currentUser) return;
  const data = loadLocalJournals()
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .slice(0, 20);

  els.journalList.innerHTML = "";
  data.forEach((entry) => appendJournalEntry(entry));
  els.journalCount.textContent = `${data.length} kayıt`;
  els.emptyJournal.hidden = data.length > 0;
}

function appendJournalEntry(entry) {
  const fragment = els.journalTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".journal-entry");
  const openButton = fragment.querySelector(".journal-open");
  const deleteButton = fragment.querySelector(".journal-delete");
  const title = fragment.querySelector("strong");
  const preview = fragment.querySelector("span");

  item.dataset.id = entry.id;
  title.textContent = formatJournalDate(entry.started_at);
  preview.textContent = formatTime(entry.started_at);
  openButton.addEventListener("click", () => openJournalModal(entry));
  deleteButton.addEventListener("click", () => deleteJournalEntry(entry.id, item));

  els.journalList.appendChild(fragment);
}

function openJournalModal(entry) {
  selectedJournal = entry;
  els.journalModalTitle.textContent = formatDetailedDate(entry.started_at);
  els.journalModalTime.textContent = formatTime(entry.started_at);
  els.journalModalBody.textContent = entry.body || "";
  els.journalModal.classList.add("open");
  els.journalModal.setAttribute("aria-hidden", "false");
  els.journalModalDelete.focus({ preventScroll: true });
}

function closeJournalModal() {
  if (!els.journalModal.classList.contains("open")) return;
  els.journalModal.classList.remove("open");
  els.journalModal.setAttribute("aria-hidden", "true");
  selectedJournal = null;
}

function deleteJournalEntry(id, item = null) {
  const entries = loadLocalJournals().filter((entry) => entry.id !== id);
  saveLocalJournals(entries);
  item?.classList.add("removing");

  if (selectedJournal?.id === id) {
    closeJournalModal();
  }

  if (activeJournal.id === id) {
    startNewJournal(false);
  }

  setTimeout(() => {
    renderJournalList();
    showToast("Günlük silindi.");
  }, item ? 190 : 120);
}

function updateJournalHeader() {
  els.journalDate.textContent = formatFullDate(activeJournal.started_at);
  els.journalStart.textContent = formatTime(activeJournal.started_at);
}

function freshJournalDraft() {
  const now = new Date();
  return {
    id: null,
    body: "",
    entry_date: toDateKey(now),
    started_at: now.toISOString(),
  };
}

function journalStorageKey() {
  return `eylul-emir-journal:${currentUser?.id || "guest"}`;
}

function loadLocalJournals() {
  try {
    const entries = JSON.parse(localStorage.getItem(journalStorageKey()) || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveLocalJournals(entries) {
  localStorage.setItem(journalStorageKey(), JSON.stringify(entries));
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

async function requestWebNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (window.Capacitor?.isNativePlatform?.()) return;

  const alreadyAsked = localStorage.getItem("web_notif_asked") === "1";

  if (Notification.permission === "default" && !alreadyAsked) {
    try { await Notification.requestPermission(); } catch {}
    localStorage.setItem("web_notif_asked", "1");
  }

  if (Notification.permission === "granted") {
    await subscribeWebPush();
  }
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
  document.querySelector("#journal-panel").classList.toggle("active", tabName === "journal");
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

function formatFullDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(value));
}

function formatDetailedDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatJournalDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
