<?php
// Receives the footer form, keeps the message on the server and answers with the
// WhatsApp link the visitor continues on. Called by assets/contato.js; without
// JavaScript the browser posts here directly and is redirected to WhatsApp.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

const WHATSAPP = '5512991550799';

header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');

$fromScript = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch';

function reply(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message, bool $fromScript): void
{
    if ($fromScript) {
        reply($status, ['ok' => false, 'erro' => $message]);
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Contato</title>'
        . '<p style="font-family:sans-serif;padding:24px">' . htmlspecialchars($message) . ' <a href="/#rodape">Voltar</a></p>';
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'Use o formulário do site.', $fromScript);
}

// Only this site may post here.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    fail(403, 'Origem não permitida.', $fromScript);
}

// Plain text, no control characters except line breaks, trimmed to a sane length.
function field(string $name, int $max): string
{
    $value = (string) ($_POST[$name] ?? '');
    $value = preg_replace('/[^\P{C}\n]/u', '', str_replace("\r\n", "\n", $value)) ?? '';
    $value = trim($value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

$nome = field('nome', 120);
$email = field('email', 160);
$telefone = field('telefone', 40);
$mensagem = field('mensagem', 4000);

$text = "Olá, Samuel! Vim pelo site.\n\nNome: $nome\nE-mail: $email" . ($telefone !== '' ? "\nTelefone: $telefone" : '') . "\n\n$mensagem";
$whatsapp = 'https://wa.me/' . WHATSAPP . '?text=' . rawurlencode($text);

// Hidden field only bots fill in: pretend it worked and keep nothing.
if (field('site', 200) !== '') {
    $fromScript ? reply(200, ['ok' => true, 'whatsapp' => $whatsapp]) : header('Location: /', true, 303);
    exit;
}

if ($nome === '' || $email === '' || $mensagem === '') {
    fail(422, 'Preencha nome, e-mail e mensagem.', $fromScript);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail(422, 'Confira o seu e-mail.', $fromScript);
}

try {
    if (!rate_ok('contato', 5, 600)) {
        fail(429, 'Muitas mensagens em pouco tempo. Tente de novo em alguns minutos.', $fromScript);
    }
    $row = [
        'id' => bin2hex(random_bytes(6)),
        'recebida_em' => date('c'),
        'nome' => $nome,
        'email' => $email,
        'telefone' => $telefone,
        'mensagem' => $mensagem,
        'pagina' => (string) parse_url((string) ($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_PATH),
    ];
    $saved = file_put_contents(messages_file(), json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
    if ($saved === false) {
        throw new RuntimeException('write failed');
    }
} catch (Throwable $e) {
    error_log('contato.php: ' . $e->getMessage());
    fail(500, 'Não conseguimos registrar a mensagem agora.', $fromScript);
}

if ($fromScript) {
    reply(200, ['ok' => true, 'whatsapp' => $whatsapp]);
}
header('Location: ' . $whatsapp, true, 303);
