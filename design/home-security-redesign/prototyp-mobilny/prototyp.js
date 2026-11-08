// Prototyp wizualny – przełączanie ekranów wyłącznie demonstracyjne.
// Brak logowania, PIN-u, kamer, sieci i reklamy.
(function () {
  var screens = document.querySelectorAll('.screen');
  var tabs = document.getElementById('tabs');
  var switchBtns = document.querySelectorAll('.demo-switch button');
  var tabBtns = tabs.querySelectorAll('button');

  function show(id) {
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
    history.replaceState(null, '', '#' + id);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (!el) return;
    e.preventDefault();
    show(el.dataset.go);
  });

  var start = location.hash.slice(1);
  show(document.getElementById(start) ? start : 'start');
})();
