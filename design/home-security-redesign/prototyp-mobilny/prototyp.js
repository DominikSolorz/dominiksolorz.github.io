// Prototyp wizualny – przełączanie ekranów wyłącznie demonstracyjne.
// Brak logowania, PIN-u, kamer, sieci i reklamy.
(function () {
  // Przełącznik ekranów tylko po dodaniu ?demo=1 do adresu.
  if (/[?&]demo=1/.test(location.search)) document.querySelector('.demo-switch').hidden = false;
  var screens = document.querySelectorAll('.screen');
  var tabs = document.getElementById('tabs');
  var switchBtns = document.querySelectorAll('.demo-switch button');
  var tabBtns = tabs.querySelectorAll('button');

  function show(id, fromPop) {
    var target = document.getElementById(id);
    if (!target) return;
    screens.forEach(function (s) { s.hidden = s !== target; });
    tabs.hidden = !target.classList.contains('has-nav');
    var mark = function (b) {
      var on = b.dataset.go === id;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    };
    switchBtns.forEach(mark);
    tabBtns.forEach(mark);
    var sc = target.querySelector('.scroll');
    if (sc) sc.scrollTop = 0;
    if (!fromPop && location.hash.slice(1) !== id) history.pushState(null, '', location.search + '#' + id);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (!el) return;
    e.preventDefault();
    show(el.dataset.go);
  });

  // Demo reklamy: 4 plansze (30 s łącznie), po 30 s przejście do wprowadzenia.
  var imgs = document.querySelectorAll('#ad > img, #ad > .slide-brand'), dots = document.querySelectorAll('#adDots i'),
      bar = document.getElementById('adBar'), adTimer = null, adT0 = 0;
  function adStop() { clearInterval(adTimer); adTimer = null; }
  function adStart() {
    adStop(); adT0 = Date.now();
    adTimer = setInterval(function () {
      var s = (Date.now() - adT0) / 1000;
      if (s >= 30) { adStop(); show('intro'); return; }
      var k = Math.min(imgs.length - 1, Math.floor(s / (30 / imgs.length)));
      imgs.forEach(function (im, i) { im.classList.toggle('on', i === k); });
      dots.forEach(function (d, i) { d.classList.toggle('on', i === k); });
      bar.style.width = (s / 30 * 100) + '%';
    }, 250);
  }
  var baseShow = show;
  show = function (id, fromPop) {
    baseShow(id, fromPop);
    if (id === 'start') { imgs.forEach(function (im, i) { im.classList.toggle('on', i === 0); }); bar.style.width = '0'; adStart(); }
    else adStop();
  };

  window.addEventListener('popstate', function () {
    var id = location.hash.slice(1);
    if (document.getElementById(id)) show(id, true);
  });

  var start = location.hash.slice(1);
  show(document.getElementById(start) ? start : 'start');
})();
