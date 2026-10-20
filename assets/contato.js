// Contact form in the footer. Pressing "Enviar" opens WhatsApp with the message
// already written, to Samuel's number, and keeps a copy on the server
// (api/contato.php), which he reads at /api/mensagens.php.
(function () {
  var WHATSAPP = '5512991550799';
  var ENDPOINT = '/api/contato.php';

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('[data-contact-form]')) return;
    e.preventDefault();
    var status = form.querySelector('[data-form-status]');
    var say = function (t) { if (status) status.textContent = t; };
    var val = function (n) { var f = form.elements[n]; return f ? f.value.trim() : ''; };
    var nome = val('nome'), email = val('email'), tel = val('telefone'), msg = val('mensagem');

    if (!nome || !email || !msg) {
      say('Preencha nome, e-mail e mensagem.');
      (form.elements[!nome ? 'nome' : !email ? 'email' : 'mensagem'] || form).focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      say('Confira o seu e-mail.');
      form.elements.email.focus();
      return;
    }

    var text = 'Olá, Samuel! Vim pelo site.\n\nNome: ' + nome + '\nE-mail: ' + email + (tel ? '\nTelefone: ' + tel : '') + '\n\n' + msg;
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);

    // WhatsApp opens right away, still inside the click, so no browser blocks it;
    // the copy is saved alongside and survives the page being left (keepalive).
    var tab = window.open(url, '_blank');
    if (tab) tab.opener = null;

    var data = new FormData(form);
    data.set('nome', nome); data.set('email', email); data.set('telefone', tel); data.set('mensagem', msg);
    var saved = window.fetch
      ? fetch(ENDPOINT, { method: 'POST', body: data, keepalive: true, headers: { 'X-Requested-With': 'fetch' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .catch(function () { return { ok: false }; })
      : Promise.resolve({ ok: false });

    say(tab ? 'Abrimos o WhatsApp com a sua mensagem. É só enviar por lá.' : 'Abrindo o WhatsApp…');
    saved.then(function (res) {
      if (res && res.ok) form.reset();
      else if (res && res.erro && /muitas/i.test(res.erro)) say(res.erro);
      // a blocked pop-up: go to WhatsApp in this tab once the copy is saved
      if (!tab) window.location.href = url;
    });
  });
})();
