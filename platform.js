// ============================================================
// Версия для планшета (браузер/PWA): вместо Electron-моста window.lcAPI — реализация на
// IndexedDB + fetch. Программа (app.js) та же, что на ноутбуке; отличается только этот слой.
//  • проект хранится в IndexedDB (ключ "project"), теневая копия — "shadow";
//  • «Открыть файл» — системный выбор файла, «Сохранить как» — скачивание файла;
//  • отправка рабочего листа — системное «Поделиться» (или скачивание);
//  • синхронизация с Яндекс.Диском — тот же алгоритм, что в sync.js на ноутбуке, но через fetch
//    и вход с возвратом на эту же страницу (токен приходит в адресе после #).
// ============================================================
(function () {
  if (window.lcAPI) return;
  window.lcShareMode = true;

  const PROJECT_PATH = "Планшет/Мои уроки.json";
  window.lcDefaultProjectPath = PROJECT_PATH;
  const YD_API = "https://cloud-api.yandex.net/v1/disk";
  // Файл на Диске — JS-обёртка вокруг JSON (lessons.js): Яндекс не даёт браузеру прочитать содержимое
  // файла запросом (CORS), но разрешает подключить его как скрипт — так проект и скачивается.
  const YD_REMOTE = "app:/lessons.js";
  const WRAP_PREFIX = "window.__lcPull(";
  const WRAP_SUFFIX = ");\n";
  const wrap = (jsonText) => WRAP_PREFIX + jsonText + WRAP_SUFFIX;
  function unwrap(text) {
    if (!text.startsWith(WRAP_PREFIX)) return text;
    const end = text.lastIndexOf(");");
    return text.slice(WRAP_PREFIX.length, end === -1 ? undefined : end);
  }
  const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, "");
  window.lcRedirectUri = REDIRECT;

  // ---------- IndexedDB ----------
  let dbPromise = null;
  const db = () =>
    dbPromise ||
    (dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open("lesson-constructor", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const kvGet = async (k) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction("kv").objectStore("kv").get(k);
      t.onsuccess = () => res(t.result);
      t.onerror = () => rej(t.error);
    });
  };
  const kvSet = async (k, v) => {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction("kv", "readwrite");
      tx.objectStore("kv").put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  };

  // ---------- состояние синхронизации (аналог settings.json на ноутбуке) ----------
  let syncSt = {};
  const saveSync = async (patch) => {
    syncSt = { ...syncSt, ...patch };
    await kvSet("sync", syncSt);
  };
  let authError = null;
  const ready = (async () => {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {}
    syncSt = (await kvGet("sync")) || {};
    // Возврат со страницы входа Яндекса: токен приходит в адресе после #.
    if (location.hash && /access_token=|error=/.test(location.hash)) {
      const p = new URLSearchParams(location.hash.slice(1));
      if (p.get("access_token")) await saveSync({ token: p.get("access_token") });
      else authError = p.get("error_description") || p.get("error");
      history.replaceState(null, "", location.pathname + location.search);
    }
    if (authError) setTimeout(() => alert("Яндекс не выдал доступ: " + authError), 300);
  })();

  // ---------- вспомогательное ----------
  const utf8 = (text) => new TextEncoder().encode(text);
  const md5Of = (text) => lcMd5Hex(utf8(text));
  const sha256Of = async (text) => {
    const buf = await crypto.subtle.digest("SHA-256", utf8(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const stripBom = (t) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // Системный выбор файла. input.click() вызывается сразу (в рамках нажатия пользователя).
  function pickTextFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.style.display = "none";
      document.body.appendChild(input);
      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(v);
      };
      input.addEventListener("change", () => {
        const f = input.files && input.files[0];
        if (!f) return finish(null);
        const reader = new FileReader();
        reader.onload = () => finish(stripBom(String(reader.result)));
        reader.onerror = () => finish(null);
        reader.readAsText(f, "utf-8");
      });
      input.addEventListener("cancel", () => finish(null));
      input.click();
    });
  }
  const errMsg = (e) => String((e && e.message) || e);

  // ---------- проект ----------
  const project = {
    getLastProjectPath: async () => {
      await ready;
      return (await kvGet("project")) ? PROJECT_PATH : null;
    },
    readPath: async () => {
      await ready;
      const text = await kvGet("project");
      return text ? { ok: true, text, path: PROJECT_PATH } : { ok: false, error: "На этом устройстве проект ещё не сохранён" };
    },
    openDialog: async () => {
      const text = await pickTextFile(".json,application/json");
      if (text == null) return { ok: false };
      try {
        JSON.parse(text);
      } catch (e) {
        return { ok: false, error: "Это не файл проекта (не удалось прочитать JSON)" };
      }
      await ready;
      const prev = await kvGet("project");
      if (prev) await kvSet("project-prev", prev); // страховка: предыдущий проект остаётся в хранилище
      await kvSet("project", text);
      return { ok: true, text, path: PROJECT_PATH };
    },
    save: async (_path, text) => {
      try {
        await ready;
        const prev = await kvGet("project");
        // та же защита, что на ноутбуке: не затираем большой проект «пустым» состоянием
        if (prev && prev.length > 50000 && text.length < prev.length * 0.05) {
          return { ok: false, error: "Отказ сохранять: новые данные почти пустые, а в хранилище уже есть проект." };
        }
        await kvSet("project", text);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
    saveAsDialog: async (text, suggestedName) => {
      try {
        await ready;
        await kvSet("project", text);
        downloadBlob(new Blob([text], { type: "application/json" }), suggestedName || "Мои уроки.json");
        return { ok: true, path: PROJECT_PATH };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
    backup: async () => {
      try {
        await ready;
        const text = await kvGet("project");
        if (!text) return { ok: false, error: "Проект ещё не сохранён" };
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        downloadBlob(new Blob([text], { type: "application/json" }), `Мои уроки — копия ${stamp}.json`);
        return { ok: true, path: "папка «Загрузки» (Downloads)" };
      } catch (e) {
        return { ok: false, error: errMsg(e) };
      }
    },
    // теневая копия — не чаще раза в минуту (проект и так лежит в том же хранилище)
    writeShadowBackup: async (text) => {
      await ready;
      const now = Date.now();
      if (project._lastShadow && now - project._lastShadow < 60000) return { ok: true };
      project._lastShadow = now;
      await kvSet("shadow", text);
      return { ok: true };
    },
    readShadowBackup: async () => {
      await ready;
      const text = await kvGet("shadow");
      return text ? { ok: true, text } : { ok: false };
    },
  };

  // ---------- обмен с учениками: на планшете — «Поделиться» ----------
  const exchange = {
    pickExchangeFolder: async () => ({ ok: false }),
    sendExchangeFile: async (_folder, baseName, docHtml) => {
      const fileName = baseName + ".doc";
      const file = new File(["﻿" + docHtml], fileName, { type: "application/msword" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: baseName });
          return { ok: true, fileName };
        }
      } catch (e) {
        if (e && e.name === "AbortError") return { ok: false, error: "Отправка отменена" };
      }
      downloadBlob(file, fileName);
      alert("Системное «Поделиться» для этого файла недоступно — файл сохранён в «Загрузки» (Downloads). Отправьте его ученику оттуда.");
      return { ok: true, fileName };
    },
    listExchangeAnswers: async () => ({ ok: true, files: [] }),
    markExchangeReviewed: async () => ({ ok: true }),
    openExchangeFile: async () => ({ ok: false }),
  };

  // ---------- Яндекс.Диск ----------
  const getToken = () => syncSt.token || null;
  async function ydJson(method, pathAndQuery) {
    const token = getToken();
    if (!token) throw new Error("AUTH");
    const res = await fetch(YD_API + pathAndQuery, { method, headers: { Authorization: "OAuth " + token } });
    if (res.status === 401) throw new Error("AUTH");
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }
  const ydPathQ = () => `path=${encodeURIComponent(YD_REMOTE)}`;
  async function validateToken() {
    const r = await ydJson("GET", "/resources?path=" + encodeURIComponent("app:/") + "&limit=1");
    if (r.status < 400 || r.status === 404) return;
    throw new Error("Яндекс.Диск ответил " + r.status + ": " + (r.body.description || r.body.message || r.body.error || "отказ в доступе"));
  }
  async function ydMeta() {
    const r = await ydJson("GET", `/resources?${ydPathQ()}&fields=md5,modified,size`);
    if (r.status === 404) return null;
    if (r.status >= 400) throw new Error(r.body.message || "Яндекс.Диск вернул ошибку " + r.status);
    return r.body;
  }
  // Скачивание: подключаем файл с Диска как <script> (без CORS); обёртка передаёт проект в window.__lcPull.
  function loadScriptPayload(href) {
    return new Promise((resolve, reject) => {
      let got = null;
      const s = document.createElement("script");
      const cleanup = () => {
        clearTimeout(timer);
        delete window.__lcPull;
        s.remove();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Яндекс.Диск слишком долго отдаёт файл (больше 3 минут)"));
      }, 180000);
      window.__lcPull = (obj) => {
        got = obj;
      };
      s.onload = () => {
        const obj = got;
        cleanup();
        if (obj == null) reject(new Error("Файл на Диске имеет неожиданный формат"));
        else resolve(JSON.stringify(obj));
      };
      s.onerror = () => {
        cleanup();
        reject(new Error("Не удалось скачать файл проекта с Яндекс.Диска (сервер скачивания не отдал его браузеру)"));
      };
      s.src = href;
      document.head.appendChild(s);
    });
  }
  async function ydDownloadText() {
    const r = await ydJson("GET", `/resources/download?${ydPathQ()}`);
    if (r.status >= 400) throw new Error(r.body.message || "Не удалось скачать файл (" + r.status + ")");
    const href = r.body.href;
    const tried = [];
    // Способ 1: обычный запрос с заголовком Authorization — сервер скачивания разрешает такие запросы из браузера.
    try {
      const res = await fetch(href, { headers: { Authorization: "OAuth " + getToken() } });
      if (res.ok) return unwrap(stripBom(await res.text()));
      tried.push("запрос с авторизацией: код " + res.status);
    } catch (e) {
      tried.push("запрос с авторизацией: " + errMsg(e));
    }
    // Способ 2: подключить файл как <script> (CORS для скриптов не нужен).
    try {
      return await loadScriptPayload(href);
    } catch (e) {
      tried.push("как скрипт: " + errMsg(e));
    }
    let host = "";
    try {
      host = new URL(href).host;
    } catch (e) {}
    throw new Error("Не удалось скачать файл проекта с Яндекс.Диска (" + host + "). Что пробовали — " + tried.join("; "));
  }
  async function ydUploadText(text) {
    const r = await ydJson("GET", `/resources/upload?${ydPathQ()}&overwrite=true`);
    if (r.status >= 400) throw new Error(r.body.message || "Не удалось начать загрузку (" + r.status + ")");
    let res;
    try {
      res = await fetch(r.body.href, { method: "PUT", body: new Blob([wrap(text)]) });
    } catch (e) {
      throw new Error("Браузер не смог загрузить файл на Яндекс.Диск (" + errMsg(e) + "). Возможно, сервер загрузки не разрешает запросы из браузера.");
    }
    if (!res.ok && res.status !== 201 && res.status !== 202) throw new Error("Не удалось загрузить файл (" + res.status + ")");
  }
  async function saveConflictCopy(text, label) {
    try {
      await kvSet("conflict-" + label, text);
    } catch (e) {}
  }
  const syncErr = (e) => {
    const isAuth = errMsg(e) === "AUTH";
    return { ok: false, auth: isAuth, error: isAuth ? "Нужно заново подключить Яндекс.Диск" : errMsg(e) };
  };
  // loopback "Failed to fetch" без пояснения бесполезен — подсказываем про сеть
  const netHint = (e) => (e instanceof TypeError ? new Error("Нет связи с Яндекс.Диском (проверьте интернет): " + errMsg(e)) : e);

  // Имя файла на Диске поменялось (lessons.json → lessons.js): старые отпечатки больше не годятся.
  async function ensureRemoteName() {
    if (syncSt.remoteName !== YD_REMOTE) await saveSync({ remoteName: YD_REMOTE, lastRemoteMd5: null, lastLocalHash: null });
  }

  async function pushText(localText, force) {
    await ensureRemoteName();
    let parsed;
    try {
      parsed = JSON.parse(localText);
    } catch (e) {
      return { ok: false, error: "Проект не удалось прочитать — загрузка отменена" };
    }
    const localHash = await sha256Of(localText);
    if (!force && syncSt.lastLocalHash === localHash) return { ok: true, status: "nochange" };
    const meta = await ydMeta();
    if (meta && !force && meta.md5 !== syncSt.lastRemoteMd5) return { ok: true, status: "conflict" };
    const isEmpty = (a) => !Array.isArray(a) || a.length === 0;
    const looksEmpty = isEmpty(parsed.examples) && isEmpty(parsed.lessons) && isEmpty(parsed.theory) && isEmpty(parsed.tags && parsed.tags.type);
    if (meta && looksEmpty && (meta.size || 0) > 200) {
      return { ok: false, error: "Загрузка отменена: проект пустой, а на Диске уже есть данные" };
    }
    await ydUploadText(localText);
    const localMd5 = md5Of(wrap(localText));
    let md5 = localMd5;
    for (let i = 0; i < 5; i++) {
      const m = await ydMeta().catch(() => null);
      if (m && m.md5) {
        md5 = m.md5;
        if (m.md5 === localMd5) break;
      }
      await sleep(700);
    }
    await saveSync({ lastRemoteMd5: md5, lastLocalHash: localHash, lastSyncAt: Date.now() });
    return { ok: true, status: "pushed", lastSyncAt: syncSt.lastSyncAt };
  }

  const sync = {
    syncInfo: async () => {
      await ready;
      return { clientId: syncSt.clientId || "", connected: !!syncSt.token, lastSyncAt: syncSt.lastSyncAt || null };
    },
    syncSetClientId: async (id) => {
      await ready;
      await saveSync({ clientId: String(id || "").trim() });
      return { ok: true };
    },
    syncDisconnect: async () => {
      await ready;
      await saveSync({ token: null, lastRemoteMd5: null, lastLocalHash: null });
      return { ok: true };
    },
    syncSetToken: async (token) => {
      await ready;
      try {
        await saveSync({ token: String(token || "").trim() });
        await validateToken();
        return { ok: true };
      } catch (e) {
        await saveSync({ token: null });
        return syncErr(netHint(e));
      }
    },
    // Вход: уходим на страницу Яндекса и возвращаемся сюда же с токеном в адресе (после #).
    syncConnect: async () => {
      await ready;
      if (!syncSt.clientId) return { ok: false, error: "Сначала укажите ID приложения" };
      location.href = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(syncSt.clientId)}&redirect_uri=${encodeURIComponent(REDIRECT)}`;
      return new Promise(() => {});
    },
    syncPull: async () => {
      await ready;
      try {
        await ensureRemoteName();
        const meta = await ydMeta();
        if (!meta) return { ok: true, status: "missing" };
        if (meta.md5 && meta.md5 === syncSt.lastRemoteMd5) return { ok: true, status: "nochange" };
        const text = await ydDownloadText();
        return { ok: true, status: "remote-newer", text, md5: meta.md5 || md5Of(wrap(text)), modified: meta.modified };
      } catch (e) {
        return syncErr(netHint(e));
      }
    },
    syncIsLocalChanged: async (localText, remoteMd5) => {
      await ready;
      if (syncSt.lastLocalHash && (await sha256Of(localText)) === syncSt.lastLocalHash) return false;
      if (remoteMd5 && md5Of(wrap(localText)) === remoteMd5) return false;
      return true;
    },
    syncMarkSynced: async (remoteMd5, localText) => {
      await ready;
      await saveSync({ lastRemoteMd5: remoteMd5, lastLocalHash: await sha256Of(localText), lastSyncAt: Date.now() });
      return { ok: true, lastSyncAt: syncSt.lastSyncAt };
    },
    syncPush: async (localText, force) => {
      await ready;
      try {
        return await pushText(localText, !!force);
      } catch (e) {
        return syncErr(netHint(e));
      }
    },
    syncResolve: async (choice, localText) => {
      await ready;
      try {
        if (choice === "remote") {
          await saveConflictCopy(localText, "local-before-remote");
          const meta = await ydMeta();
          const text = await ydDownloadText();
          return { ok: true, text, md5: (meta && meta.md5) || md5Of(wrap(text)) };
        }
        const meta = await ydMeta();
        if (meta) {
          const remoteText = await ydDownloadText().catch(() => null);
          if (remoteText) await saveConflictCopy(remoteText, "remote-before-local");
        }
        return await pushText(localText, true);
      } catch (e) {
        return syncErr(netHint(e));
      }
    },
  };

  window.lcAPI = { ...project, ...exchange, ...sync };
})();
