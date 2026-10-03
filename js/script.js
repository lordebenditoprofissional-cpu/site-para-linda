(function () {
  "use strict";

  var STAGE_ORDER = [
    "stage-entrada", "stage-audio", "stage-video", "stage-carta", "stage-final",
    "stage-reacao-video", "stage-reacao-mensagens", "stage-reacao-audios", "stage-reacao-memorias"
  ];
  var stages = {};
  STAGE_ORDER.forEach(function (id) {
    stages[id] = document.getElementById(id);
  });

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Stage navigation
     --------------------------------------------------------- */

  function goToStage(fromId, toId) {
    var from = stages[fromId];
    var to = stages[toId];
    if (!to) return;

    if (fromId === "stage-audio" && window.__audioEls && window.__audioEls.audioEl && !window.__audioEls.audioEl.paused) {
      window.__audioEls.audioEl.pause();
    }
    if (fromId === "stage-video") {
      var v = document.getElementById("videoEl");
      if (v && !v.paused) v.pause();
    }
    if (fromId === "stage-reacao-video") {
      var rv = document.getElementById("reacaoVideoEl");
      if (rv && !rv.paused) rv.pause();
    }
    if (fromId === "stage-reacao-audios") {
      ["reacaoAudio1El", "reacaoAudio2El"].forEach(function (id) {
        var a = document.getElementById(id);
        if (a && !a.paused) a.pause();
      });
    }

    var finishEnter = function () {
      if (from) from.hidden = true;
      to.hidden = false;
      window.scrollTo(0, 0);

      if (reduceMotion) {
        to.classList.remove("is-entering");
        replayFadeItems(to);
        return;
      }

      to.classList.add("is-entering");
      to.addEventListener("animationend", function handler() {
        to.classList.remove("is-entering");
        to.removeEventListener("animationend", handler);
      });
      replayFadeItems(to);
    };

    if (!from || reduceMotion) {
      finishEnter();
      return;
    }

    from.classList.add("is-leaving");
    from.addEventListener("animationend", function handler() {
      from.classList.remove("is-leaving");
      from.removeEventListener("animationend", handler);
      finishEnter();
    });
  }

  function replayFadeItems(container) {
    var items = container.querySelectorAll(".fade-item");
    items.forEach(function (el) {
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    });
  }

  document.getElementById("btnEntrar").addEventListener("click", function () {
    goToStage("stage-entrada", "stage-audio");
  });
  document.getElementById("btnToVideo").addEventListener("click", function () {
    goToStage("stage-audio", "stage-video");
  });
  document.getElementById("btnToCarta").addEventListener("click", function () {
    goToStage("stage-video", "stage-carta");
  });
  document.getElementById("btnToFinal").addEventListener("click", function () {
    goToStage("stage-carta", "stage-final");
  });
  document.getElementById("btnToReacao").addEventListener("click", function () {
    goToStage("stage-final", "stage-reacao-video");
  });
  document.getElementById("btnToMensagens").addEventListener("click", function () {
    goToStage("stage-reacao-video", "stage-reacao-mensagens");
  });
  document.getElementById("btnToAudios").addEventListener("click", function () {
    goToStage("stage-reacao-mensagens", "stage-reacao-audios");
  });
  document.getElementById("btnToMemorias").addEventListener("click", function () {
    goToStage("stage-reacao-audios", "stage-reacao-memorias");
  });

  /* ---------------------------------------------------------
     Reusable custom audio player factory
     --------------------------------------------------------- */

  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec) || sec < 0) return "0:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function initAudioPlayer(ids) {
    var audioEl = document.getElementById(ids.audio);
    var toggle = document.getElementById(ids.toggle);
    var bar = document.getElementById(ids.bar);
    var fill = document.getElementById(ids.fill);
    var knob = document.getElementById(ids.knob);
    var current = document.getElementById(ids.current);
    var duration = document.getElementById(ids.duration);
    if (!audioEl) return null;

    var iconPlay = toggle.querySelector(".icon-play");
    var iconPause = toggle.querySelector(".icon-pause");

    function setPlayIcon(isPlaying) {
      iconPlay.hidden = isPlaying;
      iconPause.hidden = !isPlaying;
      toggle.setAttribute("aria-label", isPlaying ? "Pausar áudio" : "Reproduzir áudio");
    }

    toggle.addEventListener("click", function () {
      if (audioEl.paused) audioEl.play(); else audioEl.pause();
    });

    audioEl.addEventListener("play", function () { setPlayIcon(true); });
    audioEl.addEventListener("pause", function () { setPlayIcon(false); });
    audioEl.addEventListener("ended", function () { setPlayIcon(false); });

    audioEl.addEventListener("loadedmetadata", function () {
      if (isFinite(audioEl.duration)) duration.textContent = formatTime(audioEl.duration);
    });

    audioEl.addEventListener("timeupdate", function () {
      current.textContent = formatTime(audioEl.currentTime);
      if (isFinite(audioEl.duration) && audioEl.duration > 0) {
        var pct = (audioEl.currentTime / audioEl.duration) * 100;
        fill.style.width = pct + "%";
        knob.style.left = pct + "%";
        bar.setAttribute("aria-valuenow", Math.round(pct));
      }
    });

    function seekFromClientX(clientX) {
      var rect = bar.getBoundingClientRect();
      var ratio = (clientX - rect.left) / rect.width;
      ratio = Math.min(1, Math.max(0, ratio));
      if (isFinite(audioEl.duration) && audioEl.duration > 0) {
        audioEl.currentTime = ratio * audioEl.duration;
      }
    }

    var isDragging = false;
    bar.addEventListener("pointerdown", function (e) {
      isDragging = true;
      seekFromClientX(e.clientX);
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", function (e) { if (isDragging) seekFromClientX(e.clientX); });
    bar.addEventListener("pointerup", function () { isDragging = false; });
    bar.addEventListener("pointercancel", function () { isDragging = false; });

    bar.addEventListener("keydown", function (e) {
      if (!isFinite(audioEl.duration)) return;
      var step = audioEl.duration * 0.05;
      if (e.key === "ArrowRight") { audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + step); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { audioEl.currentTime = Math.max(0, audioEl.currentTime - step); e.preventDefault(); }
    });

    return audioEl;
  }

  window.__audioEls = {
    audioEl: initAudioPlayer({
      audio: "audioEl", toggle: "audioToggle", bar: "audioBar",
      fill: "audioFill", knob: "audioKnob", current: "audioCurrent", duration: "audioDuration"
    }),
    reacaoAudio1El: initAudioPlayer({
      audio: "reacaoAudio1El", toggle: "reacaoAudio1Toggle", bar: "reacaoAudio1Bar",
      fill: "reacaoAudio1Fill", knob: "reacaoAudio1Knob", current: "reacaoAudio1Current", duration: "reacaoAudio1Duration"
    }),
    reacaoAudio2El: initAudioPlayer({
      audio: "reacaoAudio2El", toggle: "reacaoAudio2Toggle", bar: "reacaoAudio2Bar",
      fill: "reacaoAudio2Fill", knob: "reacaoAudio2Knob", current: "reacaoAudio2Current", duration: "reacaoAudio2Duration"
    })
  };

  /* videos use native controls; nothing extra required beyond data-src handling in auth.js */

})();
