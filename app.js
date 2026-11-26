/* =====================================================================
 * Photobooth MAP PASTI Raudah Az-Zahrah 2026
 * HTML + CSS + JavaScript biasa (tiada framework, tiada build).
 *
 * Prinsip utama: pratonton dan foto yang disimpan dilukis oleh FUNGSI YANG
 * SAMA (drawComposite). Kedudukan, zum, nisbah, potongan dan bingkai
 * dikira dalam unit bingkai, jadi hasilnya serupa pada apa-apa saiz.
 * ===================================================================== */
(function () {
  "use strict";

  /* ---------- Tetapan ---------- */
  var EVENT_CODE = "MAPPASTI2026";
  var JPEG_QUALITY = 0.92;
  var STORE_KEY_COLOUR = "mappasti2026.colour";
  var STORE_KEY_FRAME = "mappasti2026.frame";
  var FRAME_NAMES = { potret: "Potret", landskap: "Landskap" };
  var COLOUR_NAMES = { ungu: "Ungu", biru: "Biru" };
  var FILE_FRAME = { potret: "portrait", landskap: "landscape" };
  var THEME_COLOR = { ungu: "#2a0a52", biru: "#06224f" };
  var ZOOM_DEFAULT = 50;      // 50 = "Penuhkan tingkap" (lalai)
  var MAX_SRC_SIDE = 4096;    // foto galeri yang sangat besar dikecilkan sedikit

  /* ---------- Keadaan ---------- */
  var state = {
    colour: "ungu",
    frame: "potret",
    facing: "user",          // "user" = kamera depan, "environment" = belakang
    stream: null,
    source: null,            // video / kanvas / imej yang sedang dipaparkan
    mirror: false,
    mode: "camera",          // "camera" | "gallery" | "busy"
    zoom: ZOOM_DEFAULT,
    panX: 0, panY: 0,        // anjakan dalam pecahan saiz tingkap
    frames: {},              // cache {img, win}
    result: null,            // {blob, name, file, url}
    raf: 0
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screens: { home: $("screen-home"), camera: $("screen-camera"), result: $("screen-result") },
    video: $("video"), live: $("live"), stage: $("stage"),
    countdown: $("countdown"), flash: $("flash"),
    camMsg: $("cam-msg"), camMsgText: $("cam-msg-text"), camRetry: $("cam-retry"),
    zoom: $("zoom"), zoomReset: $("zoom-reset"),
    shutter: $("btn-shutter"), gallery: $("btn-gallery"), switchCam: $("btn-switch"),
    galleryActions: $("gallery-actions"), usePhoto: $("btn-use-photo"), backCamera: $("btn-back-camera"),
    fileInput: $("file-input"), camTitle: $("cam-title"),
    resultImg: $("result-img"), uploadStatus: $("upload-status"),
    save: $("btn-save"), retake: $("btn-retake"), iosHint: $("ios-save-hint"),
    iosFallback: $("ios-fallback"), iosFallbackImg: $("ios-fallback-img"),
    toast: $("toast"), pendingBox: $("pending-box"), pendingText: $("pending-text")
  };

  var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var IS_STANDALONE = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    navigator.standalone === true;

  /* =================================================================
   * TEMA & PILIHAN
   * ================================================================= */
  function setColour(c, save) {
    if (!COLOUR_NAMES[c]) c = "ungu";
    state.colour = c;
    document.documentElement.setAttribute("data-theme", c);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[c]);
    document.querySelectorAll(".seg-btn").forEach(function (b) {
      b.setAttribute("aria-checked", b.dataset.colour === c ? "true" : "false");
    });
    document.querySelectorAll("[data-thumb]").forEach(function (img) {
      img.src = "frames/thumbs/" + c + "-" + img.dataset.thumb + ".png";
    });
    if (save) { try { localStorage.setItem(STORE_KEY_COLOUR, c); } catch (e) { /* mod peribadi */ } }
  }

  function frameKey() { return state.colour + "-" + state.frame; }

  /* Muatkan bingkai dan kira tingkap foto (kawasan lutsinar) secara automatik. */
  function loadFrame(key) {
    if (state.frames[key]) return Promise.resolve(state.frames[key]);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var info = { img: img, w: img.naturalWidth, h: img.naturalHeight, win: findWindow(img) };
        state.frames[key] = info;
        resolve(info);
      };
      img.onerror = function () { reject(new Error("Bingkai gagal dimuatkan")); };
      img.src = "frames/" + key + ".png";
    });
  }

  function findWindow(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    var d = cx.getImageData(0, 0, w, h).data;
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) {
      var row = y * w * 4;
      for (var x = 0; x < w; x++) {
        if (d[row + x * 4 + 3] < 128) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { x: 0, y: 0, w: w, h: h };
    // lebihkan 3px ke bawah garisan bingkai supaya tiada celah
    var b = 3;
    x0 = Math.max(0, x0 - b); y0 = Math.max(0, y0 - b);
    x1 = Math.min(w - 1, x1 + b); y1 = Math.min(h - 1, y1 + b);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /* =================================================================
   * LUKISAN — satu fungsi untuk pratonton DAN foto akhir
   * ================================================================= */
  var blurCanvas = document.createElement("canvas");

  function sourceSize(src) {
    if (!src) return null;
    var w = src.videoWidth || src.naturalWidth || src.width;
    var h = src.videoHeight || src.naturalHeight || src.height;
    return w && h ? { w: w, h: h } : null;
  }

  /* skala foto (unit bingkai / piksel sumber) daripada nilai slider */
  function photoScale(win, sz, zoom) {
    var cover = Math.max(win.w / sz.w, win.h / sz.h);
    var contain = Math.min(win.w / sz.w, win.h / sz.h);
    if (zoom <= ZOOM_DEFAULT) {
      var t = zoom / ZOOM_DEFAULT; // 0 = seluruh foto, 1 = penuh
      return contain * Math.pow(cover / contain, t);
    }
    return cover * Math.pow(2, (zoom - ZOOM_DEFAULT) / (100 - ZOOM_DEFAULT));
  }

  /* hadkan anjakan supaya foto tidak terkeluar dari tingkap secara pelik */
  function clampPan(win, sz) {
    var s = photoScale(win, sz, state.zoom);
    var dw = sz.w * s, dh = sz.h * s;
    var limX = Math.abs(dw - win.w) / 2 / win.w;
    var limY = Math.abs(dh - win.h) / 2 / win.h;
    state.panX = Math.max(-limX, Math.min(limX, state.panX));
    state.panY = Math.max(-limY, Math.min(limY, state.panY));
  }

  /*
   * ctx      : konteks kanvas sasaran
   * outW/outH: saiz kanvas sasaran (nisbah sama dengan bingkai)
   * frame    : {img, w, h, win}
   * src      : video / kanvas / imej
   */
  function drawComposite(ctx, outW, outH, frame, src, opts) {
    var k = outW / frame.w;
    var win = frame.win;
    var R = { x: win.x * k, y: win.y * k, w: win.w * k, h: win.h * k };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, outW, outH);
    ctx.fillStyle = "#111";
    ctx.fillRect(R.x, R.y, R.w, R.h);

    var sz = sourceSize(src);
    if (sz) {
      var s = photoScale(win, sz, opts.zoom) * k;
      var dw = sz.w * s, dh = sz.h * s;
      var cx = R.x + R.w / 2 + opts.panX * R.w;
      var cy = R.y + R.h / 2 + opts.panY * R.h;

      ctx.save();
      ctx.beginPath();
      ctx.rect(R.x, R.y, R.w, R.h);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Ruang kosong di tepi? Isi dengan salinan foto yang dikaburkan & dibesarkan.
      if (dw < R.w - 0.5 || dh < R.h - 0.5) {
        var bs = 40; // saiz kecil = kabur
        var bw = sz.w >= sz.h ? bs : Math.max(1, Math.round(bs * sz.w / sz.h));
        var bh = sz.w >= sz.h ? Math.max(1, Math.round(bs * sz.h / sz.w)) : bs;
        blurCanvas.width = bw; blurCanvas.height = bh;
        var bctx = blurCanvas.getContext("2d");
        bctx.imageSmoothingEnabled = true;
        bctx.imageSmoothingQuality = "high";
        bctx.drawImage(src, 0, 0, bw, bh);
        var cs = Math.max(R.w / bw, R.h / bh) * 1.08;
        var bdw = bw * cs, bdh = bh * cs;
        ctx.save();
        ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
        if (opts.mirror) ctx.scale(-1, 1);
        ctx.drawImage(blurCanvas, -bdw / 2, -bdh / 2, bdw, bdh);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(R.x, R.y, R.w, R.h);
      }

      // Foto utama
      ctx.translate(cx, cy);
      if (opts.mirror) ctx.scale(-1, 1);
      ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }

    // Bingkai di atas sekali (tidak dipotong, tidak diubah)
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame.img, 0, 0, outW, outH);
    ctx.restore();
  }

  /* =================================================================
   * PRATONTON LANGSUNG
   * ================================================================= */
  function currentFrame() { return state.frames[frameKey()]; }

  function sizeLiveCanvas() {
    var f = currentFrame();
    if (!f) return;
    var r = el.stage.getBoundingClientRect();
    var pad = 20;
    var aw = Math.max(50, r.width - pad), ah = Math.max(50, r.height - pad);
    var ratio = f.w / f.h;
    var w = aw, h = aw / ratio;
    if (h > ah) { h = ah; w = ah * ratio; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.live.style.width = Math.round(w) + "px";
    el.live.style.height = Math.round(h) + "px";
    var pw = Math.round(w * dpr), ph = Math.round(pw * f.h / f.w);
    if (el.live.width !== pw || el.live.height !== ph) { el.live.width = pw; el.live.height = ph; }
  }

  function renderLive() {
    var f = currentFrame();
    if (f) {
      var src = state.source;
      var sz = sourceSize(src);
      if (sz) clampPan(f.win, sz);
      drawComposite(el.live.getContext("2d"), el.live.width, el.live.height, f, sz ? src : null, {
        zoom: state.zoom, panX: state.panX, panY: state.panY, mirror: state.mirror
      });
    }
    state.raf = requestAnimationFrame(renderLive);
  }

  function startLoop() { if (!state.raf) state.raf = requestAnimationFrame(renderLive); }
  function stopLoop() { if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; }

  /* =================================================================
   * KAMERA
   * ================================================================= */
  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); });
    state.stream = null;
    el.video.srcObject = null;
  }

  function showCamMsg(text, showRetry) {
    el.camMsgText.textContent = text;
    el.camRetry.hidden = !showRetry;
    el.camMsg.hidden = false;
  }

  function startCamera() {
    stopCamera();
    el.camMsg.hidden = true;
    state.mode = "camera";
    updateCamUi();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCamMsg("Kamera tidak dapat dibuka dalam pelayar ini. Pastikan app dibuka melalui pautan https, atau guna butang Galeri untuk memilih foto.", false);
      return Promise.resolve();
    }
    // Minta gambar asli kamera 4:3. TIDAK dipaksa menjadi potret/tinggi.
    var constraints = {
      audio: false,
      video: {
        facingMode: { ideal: state.facing },
        width: { ideal: 1920 },
        height: { ideal: 1440 },
        aspectRatio: { ideal: 4 / 3 }
      }
    };
    return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      if (state.mode !== "camera") { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      state.stream = stream;
      var track = stream.getVideoTracks()[0];
      var st = track && track.getSettings ? track.getSettings() : {};
      var facing = st.facingMode || state.facing;
      state.mirror = facing === "user"; // kamera depan seperti cermin (pratonton & foto sama)
      el.video.srcObject = stream;
      state.source = el.video;
      var p = el.video.play();
      if (p && p.catch) p.catch(function () { /* autoplay disekat — akan main bila disentuh */ });
      checkCameraCount();
    }).catch(function (err) {
      var name = err && err.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        showCamMsg("Kebenaran kamera ditolak. Sila benarkan akses kamera dalam tetapan pelayar, kemudian tekan “Cuba lagi”. Anda juga boleh guna butang Galeri.", true);
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        showCamMsg("Kamera tidak dijumpai pada peranti ini. Guna butang Galeri untuk memilih foto.", true);
      } else if (name === "NotReadableError") {
        showCamMsg("Kamera sedang digunakan oleh app lain. Tutup app tersebut dan tekan “Cuba lagi”.", true);
      } else {
        showCamMsg("Kamera tidak dapat dibuka. Tekan “Cuba lagi” atau guna butang Galeri.", true);
      }
    });
  }

  function checkCameraCount() {
    if (!navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function (list) {
      var n = list.filter(function (d) { return d.kind === "videoinput"; }).length;
      el.switchCam.disabled = n < 2;
    }).catch(function () {});
  }

  function switchCamera() {
    state.facing = state.facing === "user" ? "environment" : "user";
    resetView();
    startCamera();
  }

  /* =================================================================
   * ZUM & SERET
   * ================================================================= */
  function resetView() {
    state.zoom = ZOOM_DEFAULT; state.panX = 0; state.panY = 0;
    el.zoom.value = ZOOM_DEFAULT;
  }

  function setupGestures() {
    el.zoom.addEventListener("input", function () { state.zoom = Number(el.zoom.value); });
    el.zoomReset.addEventListener("click", resetView);

    var pointers = {};
    var pinchStart = null;
    el.live.addEventListener("pointerdown", function (e) {
      if (state.mode === "busy") return;
      el.live.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.zoom };
      }
    });
    el.live.addEventListener("pointermove", function (e) {
      var p = pointers[e.pointerId];
      if (!p || state.mode === "busy") return;
      var ids = Object.keys(pointers);
      if (ids.length >= 2 && pinchStart) {
        p.x = e.clientX; p.y = e.clientY;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        var z = pinchStart.zoom + Math.log(d / pinchStart.d) / Math.log(2) * 50;
        state.zoom = Math.max(0, Math.min(100, z));
        el.zoom.value = Math.round(state.zoom);
        return;
      }
      var f = currentFrame();
      if (!f) return;
      var rect = el.live.getBoundingClientRect();
      var unit = f.w / rect.width; // piksel skrin -> unit bingkai
      var dx = (e.clientX - p.x) * unit / f.win.w;
      var dy = (e.clientY - p.y) * unit / f.win.h;
      state.panX += dx; state.panY += dy;
      p.x = e.clientX; p.y = e.clientY;
    });
    function up(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchStart = null;
    }
    el.live.addEventListener("pointerup", up);
    el.live.addEventListener("pointercancel", up);
    el.live.addEventListener("wheel", function (e) {
      e.preventDefault();
      state.zoom = Math.max(0, Math.min(100, state.zoom - e.deltaY * 0.05));
      el.zoom.value = Math.round(state.zoom);
    }, { passive: false });
  }

  /* =================================================================
   * AMBIL GAMBAR
   * ================================================================= */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function countdown() {
    var n = 3;
    function step() {
      if (n === 0) { el.countdown.textContent = ""; el.countdown.classList.remove("tick"); return Promise.resolve(); }
      el.countdown.innerHTML = "<span>" + n + "</span>";
      el.countdown.classList.remove("tick");
      void el.countdown.offsetWidth; // mula semula animasi
      el.countdown.classList.add("tick");
      n--;
      return sleep(1000).then(step);
    }
    return step();
  }

  function flash() {
    el.flash.classList.remove("go");
    void el.flash.offsetWidth;
    el.flash.classList.add("go");
  }

  /* Bekukan bingkai video semasa ke kanvas (resolusi penuh kamera). */
  function grabVideoFrame() {
    var v = el.video;
    if (!v.videoWidth) return null;
    var c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    return c;
  }

  function onShutter() {
    if (state.mode !== "camera") return;
    if (!sourceSize(el.video)) { toast("Kamera belum sedia"); return; }
    state.mode = "busy";
    updateCamUi();
    countdown().then(function () {
      var still = grabVideoFrame();
      flash();
      if (!still) throw new Error("Tiada gambar");
      state.source = still;   // pratonton beku = foto sebenar
      stopCamera();
      return sleep(350).then(function () { return finishPhoto(); });
    }).catch(function () {
      toast("Gagal mengambil gambar. Cuba lagi.");
      startCamera();
    });
  }

  /* Hasilkan foto akhir pada resolusi penuh bingkai. */
  function finishPhoto() {
    var f = currentFrame();
    var src = state.source;
    var sz = sourceSize(src);
    clampPan(f.win, sz);
    var out = document.createElement("canvas");
    out.width = f.w; out.height = f.h;
    drawComposite(out.getContext("2d"), f.w, f.h, f, src, {
      zoom: state.zoom, panX: state.panX, panY: state.panY, mirror: state.mirror
    });
    var when = new Date();
    return new Promise(function (resolve, reject) {
      out.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("toBlob")); }, "image/jpeg", JPEG_QUALITY);
    }).then(function (blob) {
      return showResult(blob, makeFileName(when));
    });
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function makeFileName(d) {
    var date = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    var time = pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    return EVENT_CODE + "_" + state.colour + "_" + FILE_FRAME[state.frame] + "_" + date + "_" + time + ".jpg";
  }

  /* =================================================================
   * GALERI
   * ================================================================= */
  function onGalleryFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)) {
      toast("Sila pilih fail gambar"); return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      // Pelayar moden sudah betulkan orientasi EXIF semasa melukis <img>
      var w = img.naturalWidth, h = img.naturalHeight;
      var s = Math.min(1, MAX_SRC_SIDE / Math.max(w, h));
      var c = document.createElement("canvas");
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      var cx = c.getContext("2d");
      cx.imageSmoothingQuality = "high";
      cx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      stopCamera();
      el.camMsg.hidden = true;
      state.source = c;
      state.mirror = false;
      state.mode = "gallery";
      resetView();
      updateCamUi();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast("Gambar ini tidak dapat dibuka. Cuba gambar lain (JPEG/PNG).");
    };
    img.src = url;
  }

  function updateCamUi() {
    var gallery = state.mode === "gallery";
    var busy = state.mode === "busy";
    el.galleryActions.hidden = !gallery;
    el.shutter.hidden = gallery;
    el.shutter.disabled = busy;
    el.gallery.disabled = busy;
    el.switchCam.style.visibility = gallery ? "hidden" : "visible";
    el.zoom.disabled = busy;
    el.zoomReset.disabled = busy;
    if (!gallery && !busy && !state.stream) el.switchCam.disabled = el.switchCam.disabled;
  }

  /* =================================================================
   * HASIL, SIMPAN & MUAT NAIK
   * ================================================================= */
  function showResult(blob, name) {
    if (state.result && state.result.url) URL.revokeObjectURL(state.result.url);
    var url = URL.createObjectURL(blob);
    var file = null;
    try { file = new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }); } catch (e) { /* lama */ }
    state.result = { blob: blob, name: name, file: file, url: url };
    el.resultImg.src = url;
    el.save.textContent = IS_IOS ? "📥 Simpan ke Foto" : "⬇️ Muat Turun";
    el.iosHint.hidden = !IS_IOS;
    showScreen("result");

    // Simpan dahulu dalam peranti (IndexedDB), kemudian muat naik.
    setStatus("saving");
    return PhotoQueue.add({
      id: name, name: name, blob: blob, created: Date.now(),
      colour: state.colour, frame: state.frame
    }).then(function () {
      registerSync();
      return processQueue();
    }).catch(function () {
      setStatus("err", "Foto tidak dapat disimpan sementara. Sila tekan Muat Turun.");
    });
  }

  function setStatus(kind, text) {
    var s = el.uploadStatus;
    s.className = "status";
    if (kind === "saving") {
      s.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Menyimpan...</span>';
    } else if (kind === "ok") {
      s.classList.add("ok"); s.textContent = "✅ Berjaya disimpan";
    } else if (kind === "wait") {
      s.classList.add("wait"); s.textContent = "📶 Menunggu sambungan internet";
    } else if (kind === "noconfig") {
      s.classList.add("wait"); s.textContent = "⚠️ Google Drive belum ditetapkan — foto disimpan dalam peranti";
    } else {
      s.classList.add("err"); s.textContent = text || "Gagal dimuat naik — akan dicuba semula";
    }
  }

  function processQueue() {
    if (!navigator.onLine) {
      if (state.result) markCurrentWaiting();
      updatePending();
      return Promise.resolve();
    }
    return PhotoQueue.processAll(function (type, rec, info) {
      var mine = state.result && rec.id === state.result.name;
      if (!mine) return;
      if (type === "start") setStatus("saving");
      else if (type === "ok") setStatus("ok");
      else if (type === "noconfig") setStatus("noconfig");
      else if (type === "fail") {
        if (info && info.rejected) setStatus("err", "Ditolak oleh Google Drive: " + info.message);
        else setStatus("wait");
      }
    }).then(function (r) {
      // Jika pemprosesan lain sedang berjalan, pastikan status foto ini tetap betul.
      if (r === "busy" && state.result) setTimeout(refreshCurrentStatus, 1500);
      updatePending();
    }).catch(function () { updatePending(); });
  }

  function markCurrentWaiting() {
    PhotoQueue.all().then(function (list) {
      var still = list.some(function (r) { return r.id === state.result.name; });
      setStatus(still ? (PhotoQueue.getUploadUrl() ? "wait" : "noconfig") : "ok");
    });
  }

  function refreshCurrentStatus() {
    if (!state.result) return;
    PhotoQueue.all().then(function (list) {
      var still = list.some(function (r) { return r.id === state.result.name; });
      if (!still) setStatus("ok");
      else if (!PhotoQueue.getUploadUrl()) setStatus("noconfig");
      else if (PhotoQueue._busy) setTimeout(refreshCurrentStatus, 1500);
      else setStatus("wait");
    });
  }

  function updatePending() {
    PhotoQueue.count().then(function (n) {
      el.pendingBox.hidden = n === 0;
      el.pendingText.textContent = "📤 " + n + " foto menunggu dimuat naik ke Google Drive";
    }).catch(function () {});
  }

  function registerSync() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then(function (reg) {
      if (reg.sync && reg.sync.register) return reg.sync.register("upload-photos");
    }).catch(function () {});
  }

  /* Simpan ke peranti */
  function onSave() {
    var r = state.result;
    if (!r) return;
    if (IS_IOS) {
      // iPhone: guna menu Kongsi supaya boleh pilih "Save Image"
      if (r.file && navigator.canShare && navigator.canShare({ files: [r.file] })) {
        navigator.share({ files: [r.file] }).catch(function (err) {
          if (err && err.name === "AbortError") return; // pengguna batalkan
          showIosFallback();
        });
      } else {
        showIosFallback();
      }
      return;
    }
    var a = document.createElement("a");
    a.href = r.url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Foto dimuat turun: " + r.name);
  }

  function showIosFallback() {
    el.iosFallbackImg.src = state.result.url;
    el.iosFallback.hidden = false;
  }

  /* =================================================================
   * NAVIGASI SKRIN
   * ================================================================= */
  function showScreen(name) {
    Object.keys(el.screens).forEach(function (k) {
      el.screens[k].classList.toggle("active", k === name);
    });
    window.scrollTo(0, 0);
    if (name === "camera") { startLoop(); requestAnimationFrame(sizeLiveCanvas); }
    else stopLoop();
    if (name !== "camera") stopCamera();
    if (name === "home") updatePending();
  }

  function openCamera(frame) {
    state.frame = frame;
    try { localStorage.setItem(STORE_KEY_FRAME, frame); } catch (e) {}
    el.camTitle.textContent = COLOUR_NAMES[state.colour] + " · " + FRAME_NAMES[frame];
    resetView();
    state.source = null;
    loadFrame(frameKey()).then(function () {
      showScreen("camera");
      sizeLiveCanvas();
      startCamera();
    }).catch(function () { toast("Bingkai gagal dimuatkan. Muat semula halaman."); });
  }

  function retake() {
    el.camTitle.textContent = COLOUR_NAMES[state.colour] + " · " + FRAME_NAMES[state.frame];
    resetView();
    state.source = null;
    showScreen("camera");
    sizeLiveCanvas();
    startCamera();
  }

  /* =================================================================
   * PASANG APP (PWA)
   * ================================================================= */
  var deferredPrompt = null;
  function setupInstall() {
    var btn = $("btn-install"), help = $("install-help"), ios = $("ios-guide"), done = $("installed-note");
    if (IS_STANDALONE) { done.hidden = false; return; }
    if (IS_IOS) { ios.hidden = false; return; }
    btn.hidden = false; // Android & Windows
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      help.hidden = true;
    });
    btn.addEventListener("click", function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (c) {
          if (c && c.outcome === "accepted") { btn.hidden = true; done.hidden = false; }
          deferredPrompt = null;
        });
      } else {
        help.hidden = false;
      }
    });
    window.addEventListener("appinstalled", function () { btn.hidden = true; help.hidden = true; done.hidden = false; });
  }

  /* =================================================================
   * LAIN-LAIN
   * ================================================================= */
  var toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove("show"); }, 3200);
  }

  function preloadFrames() {
    ["ungu-potret", "ungu-landskap", "biru-potret", "biru-landskap"].forEach(function (k, i) {
      setTimeout(function () { loadFrame(k).catch(function () {}); }, 400 + i * 250);
    });
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY_COLOUR); } catch (e) {}
    setColour(saved || "ungu", false);
    try { state.frame = localStorage.getItem(STORE_KEY_FRAME) || "potret"; } catch (e) {}

    document.querySelectorAll(".seg-btn").forEach(function (b) {
      b.addEventListener("click", function () { setColour(b.dataset.colour, true); });
    });
    document.querySelectorAll(".frame-card").forEach(function (b) {
      b.addEventListener("click", function () { openCamera(b.dataset.frame); });
    });

    $("cam-back").addEventListener("click", function () { showScreen("home"); });
    el.camRetry.addEventListener("click", startCamera);
    el.shutter.addEventListener("click", onShutter);
    el.switchCam.addEventListener("click", switchCamera);
    el.gallery.addEventListener("click", function () { el.fileInput.value = ""; el.fileInput.click(); });
    el.fileInput.addEventListener("change", function () { onGalleryFile(el.fileInput.files && el.fileInput.files[0]); });
    el.usePhoto.addEventListener("click", function () {
      if (state.mode !== "gallery") return;
      state.mode = "busy"; updateCamUi();
      flash();
      sleep(300).then(finishPhoto).catch(function () {
        toast("Gagal memproses foto"); state.mode = "gallery"; updateCamUi();
      });
    });
    el.backCamera.addEventListener("click", function () { resetView(); state.source = null; startCamera(); });

    el.save.addEventListener("click", onSave);
    el.retake.addEventListener("click", retake);
    $("res-home").addEventListener("click", function () { showScreen("home"); });
    $("ios-fallback-close").addEventListener("click", function () { el.iosFallback.hidden = true; });
    $("pending-retry").addEventListener("click", function () {
      if (!navigator.onLine) { toast("Tiada sambungan internet"); return; }
      if (!PhotoQueue.getUploadUrl()) { toast("Google Drive belum ditetapkan dalam config.js"); return; }
      toast("Memuat naik...");
      processQueue();
    });

    setupGestures();
    setupInstall();
    window.addEventListener("resize", sizeLiveCanvas);
    window.addEventListener("orientationchange", function () { setTimeout(sizeLiveCanvas, 300); });

    // Cuba semula muat naik bila internet kembali
    window.addEventListener("online", function () { toast("Internet kembali — memuat naik foto..."); processQueue(); });
    window.addEventListener("offline", function () {
      if (state.result && el.screens.result.classList.contains("active")) markCurrentWaiting();
    });
    setInterval(function () {
      if (navigator.onLine && !PhotoQueue._busy) {
        PhotoQueue.count().then(function (n) { if (n > 0) processQueue(); });
      }
    }, 30000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && navigator.onLine) processQueue();
      // Matikan kamera bila app ditutup sementara; hidupkan semula bila kembali
      if (document.visibilityState === "hidden" && state.mode === "camera") stopCamera();
      if (document.visibilityState === "visible" && state.mode === "camera" &&
          el.screens.camera.classList.contains("active") && !state.stream) startCamera();
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
      navigator.serviceWorker.addEventListener("message", function (e) {
        if (e.data && e.data.type === "uploaded") { updatePending(); refreshCurrentStatus(); }
      });
    }

    updatePending();
    processQueue();
    preloadFrames();
  }

  // Untuk ujian automatik sahaja (tiada kesan kepada pengguna)
  window.__photobooth = { state: state, drawComposite: drawComposite, loadFrame: loadFrame, frameKey: frameKey };

  init();
})();
