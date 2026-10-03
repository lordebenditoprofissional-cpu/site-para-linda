(function () {
  "use strict";

  var LS_HASH = "site_auth_hash";
  var LS_SALT = "site_auth_salt";
  var LS_UNLOCK_AT = "site_auth_unlocked_at";
  var LS_TIMEOUT = "site_auth_timeout_min";
  var DEFAULT_TIMEOUT_MIN = 15;

  var authGate = document.getElementById("authGate");
  var gateSetup = document.getElementById("gateSetup");
  var gateLock = document.getElementById("gateLock");
  var siteContent = document.getElementById("siteContent");
  var settingsFab = document.getElementById("btnOpenSettings");
  var settingsOverlay = document.getElementById("settingsOverlay");

  var setupPw1 = document.getElementById("setupPw1");
  var setupPw2 = document.getElementById("setupPw2");
  var btnSetupSave = document.getElementById("btnSetupSave");
  var setupStatusMsg = document.getElementById("setupStatusMsg");

  var lockPwInput = document.getElementById("lockPwInput");
  var btnUnlock = document.getElementById("btnUnlock");
  var lockStatusMsg = document.getElementById("lockStatusMsg");

  var curPw = document.getElementById("curPw");
  var newPw1 = document.getElementById("newPw1");
  var newPw2 = document.getElementById("newPw2");
  var btnChangePw = document.getElementById("btnChangePw");
  var changePwStatus = document.getElementById("changePwStatus");
  var autoLockSelect = document.getElementById("autoLockSelect");
  var btnLockNow = document.getElementById("btnLockNow");
  var btnCloseSettings = document.getElementById("btnCloseSettings");

  var inactivityTimer = null;
  var mediaInitialized = false;

  /* ---------------------------------------------------------
     crypto helpers
     --------------------------------------------------------- */

  function bufferToHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function sha256Hex(str) {
    var enc = new TextEncoder().encode(str);
    return crypto.subtle.digest("SHA-256", enc).then(bufferToHex);
  }

  function randomSalt() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return bufferToHex(arr.buffer);
  }

  function computeHash(password, salt) {
    return sha256Hex(salt + ":" + password);
  }

  /* ---------------------------------------------------------
     timeout / lock state
     --------------------------------------------------------- */

  function getTimeoutMin() {
    var v = parseInt(localStorage.getItem(LS_TIMEOUT), 10);
    return isNaN(v) ? DEFAULT_TIMEOUT_MIN : v;
  }

  function isUnlockedValid() {
    var at = parseInt(localStorage.getItem(LS_UNLOCK_AT), 10);
    if (!at) return false;
    var timeoutMin = getTimeoutMin();
    if (timeoutMin === 0) return true;
    var elapsedMin = (Date.now() - at) / 60000;
    return elapsedMin < timeoutMin;
  }

  function markUnlocked() {
    localStorage.setItem(LS_UNLOCK_AT, String(Date.now()));
  }

  function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    var timeoutMin = getTimeoutMin();
    if (timeoutMin === 0) return;
    inactivityTimer = setTimeout(lock, timeoutMin * 60000);
  }

  ["click", "touchstart", "keydown", "mousemove", "scroll"].forEach(function (evt) {
    document.addEventListener(evt, function () {
      if (authGate.getAttribute("data-closed") === "true") {
        resetInactivityTimer();
      }
    }, { passive: true });
  });

  /* ---------------------------------------------------------
     media src lazy-loading (never fetched while locked)
     --------------------------------------------------------- */

  function initMediaSourcesOnce() {
    if (mediaInitialized) return;
    mediaInitialized = true;
    document.querySelectorAll("[data-src]").forEach(function (el) {
      el.src = el.getAttribute("data-src");
    });
  }

  function pauseAllMedia() {
    document.querySelectorAll("audio, video").forEach(function (el) {
      try { el.pause(); } catch (e) {}
    });
  }

  /* ---------------------------------------------------------
     screen transitions
     --------------------------------------------------------- */

  function revealSite() {
    authGate.setAttribute("data-closed", "true");
    siteContent.hidden = false;
    settingsFab.hidden = false;
    initMediaSourcesOnce();
    markUnlocked();
    resetInactivityTimer();
  }

  function lock() {
    pauseAllMedia();
    localStorage.removeItem(LS_UNLOCK_AT);
    siteContent.hidden = true;
    settingsFab.hidden = true;
    settingsOverlay.hidden = true;
    authGate.removeAttribute("data-closed");
    gateSetup.hidden = true;
    gateLock.hidden = false;
    lockPwInput.value = "";
    lockStatusMsg.textContent = "";
    if (inactivityTimer) clearTimeout(inactivityTimer);
  }

  /* ---------------------------------------------------------
     boot
     --------------------------------------------------------- */

  function boot() {
    var hasHash = !!localStorage.getItem(LS_HASH);
    if (!hasHash) {
      gateSetup.hidden = false;
      gateLock.hidden = true;
      return;
    }
    if (isUnlockedValid()) {
      revealSite();
    } else {
      gateSetup.hidden = true;
      gateLock.hidden = false;
    }
  }

  /* ---------------------------------------------------------
     setup flow
     --------------------------------------------------------- */

  btnSetupSave.addEventListener("click", function () {
    var p1 = setupPw1.value;
    var p2 = setupPw2.value;
    if (!p1 || p1.length < 4) {
      setupStatusMsg.textContent = "Usa pelo menos 4 caracteres.";
      setupStatusMsg.className = "gate-status";
      return;
    }
    if (p1 !== p2) {
      setupStatusMsg.textContent = "As palavras-passe não coincidem.";
      setupStatusMsg.className = "gate-status";
      return;
    }
    btnSetupSave.disabled = true;
    var salt = randomSalt();
    computeHash(p1, salt).then(function (hash) {
      localStorage.setItem(LS_HASH, hash);
      localStorage.setItem(LS_SALT, salt);
      btnSetupSave.disabled = false;
      revealSite();
    });
  });

  /* ---------------------------------------------------------
     unlock flow
     --------------------------------------------------------- */

  function tryUnlock() {
    var pw = lockPwInput.value;
    var salt = localStorage.getItem(LS_SALT);
    var storedHash = localStorage.getItem(LS_HASH);
    if (!pw) {
      lockStatusMsg.textContent = "Escreve a palavra-passe.";
      return;
    }
    btnUnlock.disabled = true;
    computeHash(pw, salt).then(function (hash) {
      btnUnlock.disabled = false;
      if (hash === storedHash) {
        revealSite();
      } else {
        lockStatusMsg.textContent = "Palavra-passe incorreta.";
        lockPwInput.value = "";
      }
    });
  }

  btnUnlock.addEventListener("click", tryUnlock);
  lockPwInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryUnlock();
  });

  /* ---------------------------------------------------------
     show / hide password toggles
     --------------------------------------------------------- */

  document.querySelectorAll(".pw-eye").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-target"));
      if (!target) return;
      var showing = target.type === "text";
      target.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁" : "🙈";
    });
  });

  /* ---------------------------------------------------------
     settings
     --------------------------------------------------------- */

  settingsFab.addEventListener("click", function () {
    autoLockSelect.value = String(getTimeoutMin());
    curPw.value = "";
    newPw1.value = "";
    newPw2.value = "";
    changePwStatus.textContent = "";
    settingsOverlay.hidden = false;
  });

  btnCloseSettings.addEventListener("click", function () {
    settingsOverlay.hidden = true;
  });

  autoLockSelect.addEventListener("change", function () {
    localStorage.setItem(LS_TIMEOUT, autoLockSelect.value);
    resetInactivityTimer();
  });

  btnChangePw.addEventListener("click", function () {
    var salt = localStorage.getItem(LS_SALT);
    var storedHash = localStorage.getItem(LS_HASH);
    var cur = curPw.value;
    var p1 = newPw1.value;
    var p2 = newPw2.value;

    if (!cur) {
      changePwStatus.textContent = "Escreve a palavra-passe atual.";
      changePwStatus.className = "gate-status";
      return;
    }
    if (!p1 || p1.length < 4) {
      changePwStatus.textContent = "A nova palavra-passe precisa de pelo menos 4 caracteres.";
      changePwStatus.className = "gate-status";
      return;
    }
    if (p1 !== p2) {
      changePwStatus.textContent = "As novas palavras-passe não coincidem.";
      changePwStatus.className = "gate-status";
      return;
    }

    btnChangePw.disabled = true;
    computeHash(cur, salt).then(function (hash) {
      if (hash !== storedHash) {
        changePwStatus.textContent = "Palavra-passe atual incorreta.";
        changePwStatus.className = "gate-status";
        btnChangePw.disabled = false;
        return;
      }
      var newSalt = randomSalt();
      computeHash(p1, newSalt).then(function (newHash) {
        localStorage.setItem(LS_HASH, newHash);
        localStorage.setItem(LS_SALT, newSalt);
        changePwStatus.textContent = "Palavra-passe alterada. ❤️";
        changePwStatus.className = "gate-status is-ok";
        curPw.value = ""; newPw1.value = ""; newPw2.value = "";
        btnChangePw.disabled = false;
      });
    });
  });

  btnLockNow.addEventListener("click", function () {
    settingsOverlay.hidden = true;
    lock();
  });

  boot();

})();
