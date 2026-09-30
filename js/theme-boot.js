// theme: default dark, honor saved choice — external file so CSP can stay
// script-src 'self' (no inline exception needed).
(function () {
  try {
    var t = localStorage.getItem("ad-theme");
    if (t) document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
