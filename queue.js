/*
 * Baris gilir muat naik foto (IndexedDB).
 * Dikongsi oleh app.js (halaman) dan service-worker.js (latar belakang).
 * Foto disimpan dalam peranti sehingga berjaya dihantar ke Google Drive.
 */
(function (root) {
  "use strict";

  var DB_NAME = "mappasti2026";
  var STORE = "pending";
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { dbPromise = null; reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var result;
        Promise.resolve(fn(store)).then(function (r) { result = r; });
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  function reqP(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function getUploadUrl() {
    var url = "";
    try {
      // CONFIG datang daripada config.js
      if (typeof CONFIG !== "undefined" && CONFIG && CONFIG.GOOGLE_SCRIPT_URL) url = String(CONFIG.GOOGLE_SCRIPT_URL).trim();
    } catch (e) { /* tiada config */ }
    if (!/^https?:\/\//i.test(url) || url.indexOf("PASTE_") !== -1) return "";
    return url;
  }

  function blobToBase64(blob) {
    return blob.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var chunk = 0x8000, parts = [];
      for (var i = 0; i < bytes.length; i += chunk) {
        parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
      }
      return btoa(parts.join(""));
    });
  }

  var PhotoQueue = {
    add: function (rec) {
      return tx("readwrite", function (s) { s.put(rec); });
    },
    all: function () {
      return tx("readonly", function (s) { return reqP(s.getAll()); });
    },
    remove: function (id) {
      return tx("readwrite", function (s) { s.delete(id); });
    },
    count: function () {
      return tx("readonly", function (s) { return reqP(s.count()); });
    },
    getUploadUrl: getUploadUrl,

    /* Hantar satu foto. Pulangkan {ok:true} atau buang ralat. */
    uploadOne: function (rec, url) {
      return blobToBase64(rec.blob).then(function (b64) {
        var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 90000);
        return fetch(url, {
          method: "POST",
          // text/plain = "simple request" (tiada CORS preflight) — sesuai untuk Google Apps Script
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            filename: rec.name,
            mimeType: "image/jpeg",
            size: rec.blob.size,
            data: b64
          }),
          redirect: "follow",
          signal: ctrl ? ctrl.signal : undefined
        }).then(function (res) {
          clearTimeout(timer);
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        }, function (err) { clearTimeout(timer); throw err; });
      }).then(function (text) {
        var data;
        try { data = JSON.parse(text); } catch (e) { throw new Error("Jawapan pelayan tidak sah"); }
        if (!data || data.ok !== true) {
          var e2 = new Error((data && data.error) || "Muat naik ditolak");
          e2.rejected = true; // pelayan menolak fail (bukan masalah internet)
          throw e2;
        }
        return data;
      });
    },

    /*
     * Hantar semua foto yang menunggu, satu demi satu.
     * onEvent(type, rec, info) — type: "start" | "ok" | "fail" | "noconfig"
     */
    _busy: false,
    processAll: function (onEvent) {
      var self = this;
      onEvent = onEvent || function () {};
      if (self._busy) return Promise.resolve("busy");
      var url = getUploadUrl();
      self._busy = true;
      return self.all().then(function (list) {
        list.sort(function (a, b) { return a.created - b.created; });
        if (!url) {
          list.forEach(function (r) { onEvent("noconfig", r); });
          return "noconfig";
        }
        var chain = Promise.resolve();
        var stop = false;
        list.forEach(function (rec) {
          chain = chain.then(function () {
            if (stop) return;
            onEvent("start", rec);
            return self.uploadOne(rec, url).then(function (info) {
              return self.remove(rec.id).then(function () { onEvent("ok", rec, info); });
            }, function (err) {
              onEvent("fail", rec, err);
              if (!err || !err.rejected) stop = true; // masalah rangkaian: berhenti, cuba lagi nanti
            });
          });
        });
        return chain.then(function () { return "done"; });
      }).then(function (r) { self._busy = false; return r; }, function (e) { self._busy = false; throw e; });
    }
  };

  root.PhotoQueue = PhotoQueue;
})(typeof self !== "undefined" ? self : this);
