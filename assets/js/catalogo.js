(function () {
  'use strict';

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var lastFocused = null;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
  }

  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    var items = qsa(FOCUSABLE, container).filter(function (item) {
      return item.offsetParent !== null || item === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openLayer(layer) {
    if (!layer) return;
    lastFocused = document.activeElement;
    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('overflow-hidden');
    var focusTarget = qs('[data-autofocus]', layer) || qs(FOCUSABLE, layer);
    if (focusTarget) window.setTimeout(function () { focusTarget.focus(); }, 30);
  }

  function closeLayer(layer) {
    if (!layer) return;
    layer.classList.remove('is-open');
    layer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('overflow-hidden');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function initHeader() {
    var button = qs('[data-mobile-nav-open]');
    var menu = qs('[data-mobile-nav]');
    var close = qs('[data-mobile-nav-close]');
    if (!button || !menu) return;

    button.addEventListener('click', function () { openLayer(menu); });
    if (close) close.addEventListener('click', function () { closeLayer(menu); });
    menu.addEventListener('click', function (event) {
      if (event.target === menu || event.target.closest('a')) closeLayer(menu);
    });
    menu.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeLayer(menu);
      trapFocus(menu, event);
    });
  }

  function initWhatsAppStop() {
    qsa('[data-cta^="whatsapp"], [data-whatsapp-stop]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.stopPropagation();
      });
    });
  }

  function initHubSearch() {
    var input = qs('[data-catalog-search]');
    var cards = qsa('[data-search-item]');
    var empty = qs('[data-search-empty]');
    if (!input || !cards.length) return;

    function apply() {
      var term = normalize(input.value);
      var ambiente = normalize(new URLSearchParams(window.location.search).get('ambiente'));
      var visible = 0;
      cards.forEach(function (card) {
        var haystack = normalize(card.getAttribute('data-search-item'));
        var ambientes = normalize(card.getAttribute('data-ambientes'));
        var matchTerm = !term || haystack.indexOf(term) !== -1;
        var matchAmbiente = !ambiente || ambientes.indexOf(ambiente) !== -1;
        var show = matchTerm && matchAmbiente;
        setHidden(card, !show);
        if (show) visible += 1;
      });
      setHidden(empty, visible > 0);
    }

    input.addEventListener('input', apply);
    qsa('[data-ambiente-link]').forEach(function (button) {
      button.addEventListener('click', function () {
        var params = new URLSearchParams(window.location.search);
        params.set('ambiente', button.getAttribute('data-ambiente-link'));
        history.replaceState(null, '', window.location.pathname + '?' + params.toString());
        apply();
      });
    });
    apply();
  }

  function initFilters() {
    var grid = qs('[data-produto-grid]');
    if (!grid) return;

    var cards = qsa('[data-produto-card]', grid);
    var count = qs('[data-result-count]');
    var empty = qs('[data-empty-state]');
    var clearButtons = qsa('[data-filter-clear]');
    var filterInputs = qsa('[data-filter-key]');
    var drawer = qs('[data-filter-drawer]');
    var openDrawer = qs('[data-filter-open]');
    var closeDrawer = qs('[data-filter-close]');

    var keyToParam = {
      ambientes: 'ambiente',
      aplicacoes: 'aplicacao',
      controle: 'luz',
      privacidade: 'privacidade',
      acionamento: 'acionamento',
      material: 'material',
      cores: 'cor',
      texturas: 'textura'
    };

    function readUrlState() {
      var params = new URLSearchParams(window.location.search);
      filterInputs.forEach(function (input) {
        var key = input.getAttribute('data-filter-key');
        var param = keyToParam[key] || key;
        var values = (params.get(param) || '').split(',').filter(Boolean).map(decodeURIComponent);
        input.checked = values.indexOf(input.value) !== -1;
      });
    }

    function selectedByKey() {
      return filterInputs.reduce(function (acc, input) {
        if (!input.checked) return acc;
        var key = input.getAttribute('data-filter-key');
        acc[key] = acc[key] || [];
        acc[key].push(input.value);
        return acc;
      }, {});
    }

    function writeUrl(state) {
      var params = new URLSearchParams(window.location.search);
      Object.keys(keyToParam).forEach(function (key) {
        params.delete(keyToParam[key]);
      });
      Object.keys(state).forEach(function (key) {
        var param = keyToParam[key] || key;
        if (state[key].length) params.set(param, state[key].map(encodeURIComponent).join(','));
      });
      var query = params.toString();
      history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
    }

    function cardMatches(card, state) {
      return Object.keys(state).every(function (key) {
        var selected = state[key];
        if (!selected || !selected.length) return true;
        var raw = card.getAttribute('data-' + key) || '';
        var values = raw.split('||').filter(Boolean);
        return selected.some(function (value) { return values.indexOf(value) !== -1; });
      });
    }

    function apply(write) {
      var state = selectedByKey();
      if (write !== false) writeUrl(state);
      var visible = 0;
      cards.forEach(function (card) {
        var show = cardMatches(card, state);
        setHidden(card, !show);
        if (show) visible += 1;
      });
      if (count) count.textContent = visible + (visible === 1 ? ' resultado' : ' resultados');
      setHidden(empty, visible > 0);
    }

    filterInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var key = input.getAttribute('data-filter-key');
        filterInputs.forEach(function (other) {
          if (other === input) return;
          if (other.getAttribute('data-filter-key') === key && other.value === input.value) {
            other.checked = input.checked;
          }
        });
        apply(true);
      });
    });
    clearButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        filterInputs.forEach(function (input) { input.checked = false; });
        apply(true);
      });
    });

    if (openDrawer && drawer) openDrawer.addEventListener('click', function () { openLayer(drawer); });
    if (closeDrawer && drawer) closeDrawer.addEventListener('click', function () { closeLayer(drawer); });
    if (drawer) {
      drawer.addEventListener('click', function (event) {
        if (event.target === drawer) closeLayer(drawer);
      });
      drawer.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeLayer(drawer);
        trapFocus(drawer, event);
      });
    }

    readUrlState();
    apply(false);
  }

  function initGallery() {
    var main = qs('[data-main-gallery-image]');
    var openButton = qs('[data-gallery-open]');
    var thumbs = qsa('[data-gallery-thumb]');
    var gallery = window.CATALOGO_GALLERY || [];
    var productName = document.body.getAttribute('data-product-name') || 'Produto Ávila';
    if (!main || !gallery.length) return;

    var current = 0;
    var zoom = 1;
    var touchStartX = 0;
    var pinchStartDistance = 0;
    var pinchStartZoom = 1;
    var lightbox = qs('[data-lightbox]');
    var lightboxImage = qs('[data-lightbox-image]');
    var counter = qs('[data-lightbox-counter]');

    function setImage(index) {
      current = (index + gallery.length) % gallery.length;
      var item = gallery[current];
      main.src = item.src;
      main.alt = item.alt || productName;
      thumbs.forEach(function (thumb, thumbIndex) {
        thumb.setAttribute('aria-current', thumbIndex === current ? 'true' : 'false');
      });
      if (lightboxImage) {
        lightboxImage.src = item.src;
        lightboxImage.alt = item.alt || productName;
      }
      if (counter) {
        counter.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(gallery.length).padStart(2, '0');
      }
      setZoom(1);
    }

    function setZoom(value) {
      zoom = Math.max(1, Math.min(3, value));
      if (lightboxImage) lightboxImage.style.setProperty('--zoom', zoom);
    }

    function openLightbox(index) {
      if (!lightbox) return;
      setImage(typeof index === 'number' ? index : current);
      openLayer(lightbox);
    }

    function closeLightbox() {
      closeLayer(lightbox);
      setZoom(1);
    }

    thumbs.forEach(function (thumb, index) {
      thumb.addEventListener('click', function () { setImage(index); });
    });
    if (openButton) openButton.addEventListener('click', function () { openLightbox(current); });

    if (lightbox) {
      qsa('[data-lightbox-close]', lightbox).forEach(function (button) {
        button.addEventListener('click', closeLightbox);
      });
      qsa('[data-lightbox-prev]', lightbox).forEach(function (button) {
        button.addEventListener('click', function () { setImage(current - 1); });
      });
      qsa('[data-lightbox-next]', lightbox).forEach(function (button) {
        button.addEventListener('click', function () { setImage(current + 1); });
      });
      qsa('[data-lightbox-zoom-in]', lightbox).forEach(function (button) {
        button.addEventListener('click', function () { setZoom(zoom + 0.25); });
      });
      qsa('[data-lightbox-zoom-out]', lightbox).forEach(function (button) {
        button.addEventListener('click', function () { setZoom(zoom - 0.25); });
      });
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox) closeLightbox();
      });
      lightbox.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeLightbox();
        if (event.key === 'ArrowLeft') setImage(current - 1);
        if (event.key === 'ArrowRight') setImage(current + 1);
        trapFocus(lightbox, event);
      });
      lightbox.addEventListener('wheel', function (event) {
        if (!event.ctrlKey && Math.abs(event.deltaY) < 1) return;
        event.preventDefault();
        setZoom(zoom + (event.deltaY < 0 ? 0.16 : -0.16));
      }, { passive: false });
      lightbox.addEventListener('touchstart', function (event) {
        if (event.touches.length === 1) touchStartX = event.touches[0].clientX;
        if (event.touches.length === 2) {
          pinchStartDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY
          );
          pinchStartZoom = zoom;
        }
      }, { passive: true });
      lightbox.addEventListener('touchmove', function (event) {
        if (event.touches.length !== 2 || !pinchStartDistance) return;
        var distance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
        setZoom(pinchStartZoom * (distance / pinchStartDistance));
      }, { passive: true });
      lightbox.addEventListener('touchend', function (event) {
        if (event.changedTouches.length === 1 && touchStartX) {
          var delta = event.changedTouches[0].clientX - touchStartX;
          if (Math.abs(delta) > 48) setImage(delta < 0 ? current + 1 : current - 1);
        }
        pinchStartDistance = 0;
        touchStartX = 0;
      }, { passive: true });
    }

    setImage(0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    initWhatsAppStop();
    initHubSearch();
    initFilters();
    initGallery();
  });
})();
