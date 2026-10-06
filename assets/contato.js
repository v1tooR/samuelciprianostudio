// Contact form in the footer. The site has no server, so the message is handed to the
// visitor's own e-mail app, already addressed and filled in.
(function () {
  var TO = 'contatosamuelcipriano@gmail.com';

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('[data-contact-form]')) return;
    e.preventDefault();
    var status = form.querySelector('[data-form-status]');
    var val = function (n) { var f = form.elements[n]; return f ? f.value.trim() : ''; };
    var nome = val('nome'), email = val('email'), tel = val('telefone'), msg = val('mensagem');

    if (!nome || !email || !msg) {
      if (status) status.textContent = 'Preencha nome, e-mail e mensagem.';
      (form.elements[!nome ? 'nome' : !email ? 'email' : 'mensagem'] || form).focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (status) status.textContent = 'Confira o seu e-mail.';
      form.elements.email.focus();
      return;
    }

    var body = msg + '\n\n' + nome + '\n' + email + (tel ? '\n' + tel : '');
    window.location.href = 'mailto:' + TO +
      '?subject=' + encodeURIComponent('Novo projeto, ' + nome) +
      '&body=' + encodeURIComponent(body);
    if (status) status.textContent = 'Abrimos o seu e-mail com a mensagem pronta. É só enviar.';
  });
})();
