(function () {
  "use strict";

  var STAGE_ORDER = ["stage-entrada", "stage-audio", "stage-video", "stage-carta", "stage-final"];
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

    // pause any playing media on the stage we're leaving
    if (fromId === "stage-audio" && audioEl && !audioEl.paused) {
      audioEl.pause();
    }
    if (fromId === "stage-video" && videoEl && !videoEl.paused) {
      videoEl.pause();
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
      // force reflow so the animation restarts
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

  /* ---------------------------------------------------------
     Custom audio player
     --------------------------------------------------------- */

  var audioEl = document.getElementById("audioEl");
  var audioToggle = document.getElementById("audioToggle");
  var iconPlay = audioToggle.querySelector(".icon-play");
  var iconPause = audioToggle.querySelector(".icon-pause");
  var audioBar = document.getElementById("audioBar");
  var audioFill = document.getElementById("audioFill");
  var audioKnob = document.getElementById("audioKnob");
  var audioCurrent = document.getElementById("audioCurrent");
  var audioDuration = document.getElementById("audioDuration");

  function formatTime(sec) {
    if (!isFinite(sec) || isNaN(sec) || sec < 0) return "0:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function setPlayIcon(isPlaying) {
    iconPlay.hidden = isPlaying;
    iconPause.hidden = !isPlaying;
    audioToggle.setAttribute("aria-label", isPlaying ? "Pausar áudio" : "Reproduzir áudio");
  }

  audioToggle.addEventListener("click", function () {
    if (audioEl.paused) {
      audioEl.play();
    } else {
      audioEl.pause();
    }
  });

  audioEl.addEventListener("play", function () { setPlayIcon(true); });
  audioEl.addEventListener("pause", function () { setPlayIcon(false); });
  audioEl.addEventListener("ended", function () { setPlayIcon(false); });

  audioEl.addEventListener("loadedmetadata", function () {
    if (isFinite(audioEl.duration)) {
      audioDuration.textContent = formatTime(audioEl.duration);
    }
  });

  audioEl.addEventListener("timeupdate", function () {
    audioCurrent.textContent = formatTime(audioEl.currentTime);
    if (isFinite(audioEl.duration) && audioEl.duration > 0) {
      var pct = (audioEl.currentTime / audioEl.duration) * 100;
      audioFill.style.width = pct + "%";
      audioKnob.style.left = pct + "%";
      audioBar.setAttribute("aria-valuenow", Math.round(pct));
    }
  });

  function seekFromClientX(clientX) {
    var rect = audioBar.getBoundingClientRect();
    var ratio = (clientX - rect.left) / rect.width;
    ratio = Math.min(1, Math.max(0, ratio));
    if (isFinite(audioEl.duration) && audioEl.duration > 0) {
      audioEl.currentTime = ratio * audioEl.duration;
    }
  }

  var isDragging = false;

  audioBar.addEventListener("pointerdown", function (e) {
    isDragging = true;
    seekFromClientX(e.clientX);
    audioBar.setPointerCapture(e.pointerId);
  });
  audioBar.addEventListener("pointermove", function (e) {
    if (isDragging) seekFromClientX(e.clientX);
  });
  audioBar.addEventListener("pointerup", function () { isDragging = false; });
  audioBar.addEventListener("pointercancel", function () { isDragging = false; });

  audioBar.addEventListener("keydown", function (e) {
    if (!isFinite(audioEl.duration)) return;
    var step = audioEl.duration * 0.05;
    if (e.key === "ArrowRight") {
      audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + step);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      audioEl.currentTime = Math.max(0, audioEl.currentTime - step);
      e.preventDefault();
    }
  });

  /* ---------------------------------------------------------
     Video
     --------------------------------------------------------- */

  var videoEl = document.getElementById("videoEl");
  // no autoplay; native controls handle play/pause/volume/seek

})();
