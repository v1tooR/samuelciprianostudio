<?php
// The studio's inbox: every message sent through the site's form, newest first.
// Protected by the password in api/config.php; also exports a spreadsheet (CSV).

declare(strict_types=1);
require __DIR__ . '/_lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store');

$secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
session_name('scs_mensagens');
session_set_cookie_params(['lifetime' => 0, 'path' => dirname($_SERVER['SCRIPT_NAME']), 'secure' => $secure, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$password = (string) (config()['senha'] ?? '');
$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (isset($_POST['sair'])) {
        $_SESSION = [];
        session_destroy();
        header('Location: mensagens.php', true, 303);
        exit;
    }
    if ($password === '') {
        $error = 'A senha ainda não foi definida no servidor.';
    } elseif (!rate_ok('login', 8, 900)) {
        $error = 'Muitas tentativas. Espere alguns minutos.';
    } elseif (hash_equals($password, (string) ($_POST['senha'] ?? ''))) {
        session_regenerate_id(true);
        $_SESSION['ok'] = true;
        header('Location: mensagens.php', true, 303);
        exit;
    } else {
        sleep(1);
        $error = 'Senha incorreta.';
    }
}

$in = !empty($_SESSION['ok']) && $password !== '';

if ($in && isset($_GET['baixar'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="mensagens-site-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    // a cell starting with = + - @ would run as a formula in a spreadsheet
    $cell = function ($v) {
        $v = (string) $v;
        return preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v;
    };
    fputcsv($out, ['Recebida em', 'Nome', 'E-mail', 'Telefone', 'Mensagem', 'Página'], ';', '"', '');
    foreach (read_messages() as $m) {
        fputcsv($out, array_map($cell, [date('d/m/Y H:i', strtotime($m['recebida_em'] ?? 'now')), $m['nome'] ?? '', $m['email'] ?? '', $m['telefone'] ?? '', $m['mensagem'] ?? '', $m['pagina'] ?? '']), ';', '"', '');
    }
    exit;
}

$e = function ($v) {
    return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
};
$messages = $in ? read_messages() : [];
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Mensagens do site · Samuel Cipriano Studio</title>
<link rel="stylesheet" href="https://use.typekit.net/elq3gla.css">
<style>
  :root { --paper: #F2EBE7; --ink: #034638; --wool: #E5D0B1; --blue: #0047BB; --rule: rgba(3,70,56,.2); }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: 'neue-haas-grotesk-display', 'Helvetica Neue', sans-serif; font-size: 16px; line-height: 1.4; }
  a { color: inherit; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { font-family: 'ivypresto-display', serif; font-weight: 300; font-size: clamp(2rem, 5vw, 3rem); line-height: 1.05; margin: 0 0 8px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid var(--ink); }
  .actions { display: flex; gap: 12px; align-items: center; }
  .btn { appearance: none; border: 0; border-radius: 999px; padding: 11px 22px; font: inherit; font-weight: 600; cursor: pointer; background: var(--ink); color: var(--paper); text-decoration: none; }
  .btn:hover { background: var(--blue); }
  .link { appearance: none; border: 0; background: none; font: inherit; color: inherit; text-decoration: underline; cursor: pointer; padding: 0; }
  .msg { padding: 22px 0; border-bottom: 1px solid var(--rule); }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
  .name { font-family: 'ivypresto-display', serif; font-weight: 300; font-size: 1.6rem; line-height: 1.1; }
  .when, .meta { font-size: 13px; opacity: .8; }
  .meta { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 14px; }
  .body { margin-top: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .empty, .note { padding: 40px 0; }
  form.login { max-width: 360px; margin-top: 32px; display: grid; gap: 14px; }
  input[type=password] { font: inherit; padding: 12px 0; border: 0; border-bottom: 1px solid var(--ink); background: none; color: inherit; outline: none; }
  .err { color: #D22630; margin: 0; }
</style>
</head>
<body>
<div class="wrap">
<?php if (!$in): ?>
  <h1>Mensagens do site</h1>
  <?php if ($password === ''): ?>
    <p class="note">A senha ainda não foi definida. Crie o arquivo <code>api/config.php</code> no servidor a partir de <code>api/config.example.php</code>.</p>
  <?php else: ?>
    <form class="login" method="post">
      <label for="senha">Senha</label>
      <input id="senha" name="senha" type="password" autocomplete="current-password" required autofocus>
      <?php if ($error): ?><p class="err"><?= $e($error) ?></p><?php endif; ?>
      <button class="btn" type="submit">Entrar</button>
    </form>
  <?php endif; ?>
<?php else: ?>
  <div class="bar">
    <div>
      <h1>Mensagens do site</h1>
      <span class="when"><?= count($messages) ?> <?= count($messages) === 1 ? 'mensagem' : 'mensagens' ?></span>
    </div>
    <div class="actions">
      <?php if ($messages): ?><a class="btn" href="?baixar=1">Baixar planilha</a><?php endif; ?>
      <form method="post"><button class="link" name="sair" value="1">Sair</button></form>
    </div>
  </div>
  <?php if (!$messages): ?>
    <p class="empty">Nenhuma mensagem ainda.</p>
  <?php endif; ?>
  <?php foreach ($messages as $m): ?>
    <article class="msg">
      <div class="head">
        <span class="name"><?= $e($m['nome'] ?? '') ?></span>
        <span class="when"><?= $e(date('d/m/Y \à\s H:i', strtotime($m['recebida_em'] ?? 'now'))) ?></span>
      </div>
      <div class="meta">
        <a href="mailto:<?= $e($m['email'] ?? '') ?>"><?= $e($m['email'] ?? '') ?></a>
        <?php if (!empty($m['telefone'])): $digits = preg_replace('/\D/', '', $m['telefone']); ?>
          <a href="https://wa.me/<?= $e(strlen($digits) <= 11 ? '55' . $digits : $digits) ?>" target="_blank" rel="noopener"><?= $e($m['telefone']) ?> (WhatsApp)</a>
        <?php endif; ?>
        <?php if (!empty($m['pagina'])): ?><span>Enviada em <?= $e($m['pagina']) ?></span><?php endif; ?>
      </div>
      <p class="body"><?= $e($m['mensagem'] ?? '') ?></p>
    </article>
  <?php endforeach; ?>
<?php endif; ?>
</div>
</body>
</html>
