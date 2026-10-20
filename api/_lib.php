<?php
// Shared helpers for the contact form: configuration, the private storage folder,
// a small per-visitor rate limit and reading the saved messages.
// Written for PHP 7.4 and up (Hostinger shared hosting).

declare(strict_types=1);
date_default_timezone_set('America/Sao_Paulo');

function config(): array
{
    static $config = null;
    if ($config === null) {
        $file = __DIR__ . '/config.php';
        $config = is_file($file) ? (array) require $file : [];
    }
    return $config;
}

// Messages live outside public_html when the host allows it (Hostinger does), so no URL
// can ever reach them. Otherwise they fall back to api/dados, closed by .htaccess.
function data_dir(): string
{
    $outside = dirname(__DIR__, 2) . '/contato-dados';
    $inside = __DIR__ . '/dados';
    foreach ([$outside, $inside] as $dir) {
        if (is_dir($dir) || @mkdir($dir, 0750, true)) {
            if (is_writable($dir)) {
                if ($dir === $inside && !is_file($dir . '/.htaccess')) {
                    file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n");
                }
                return $dir;
            }
        }
    }
    throw new RuntimeException('Sem pasta gravável para as mensagens.');
}

function messages_file(): string
{
    return data_dir() . '/mensagens.jsonl';
}

// Visitors are identified only by a salted hash of their IP, never the IP itself.
function visitor_key(string $scope): string
{
    $salt = (string) (config()['sal'] ?? __DIR__);
    return hash('sha256', $scope . '|' . ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $salt);
}

// True while the visitor stays under $max attempts in $window seconds; records this attempt.
function rate_ok(string $scope, int $max, int $window): bool
{
    $file = data_dir() . '/limites.json';
    $fp = fopen($file, 'c+');
    if (!$fp) {
        return true;
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $all = $raw ? (json_decode($raw, true) ?: []) : [];
    $now = time();
    foreach ($all as $k => $times) {
        $all[$k] = array_values(array_filter((array) $times, function ($t) use ($now) {
            return $t > $now - 86400;
        }));
        if (!$all[$k]) {
            unset($all[$k]);
        }
    }
    $key = visitor_key($scope);
    $recent = array_filter($all[$key] ?? [], function ($t) use ($now, $window) {
        return $t > $now - $window;
    });
    $ok = count($recent) < $max;
    if ($ok) {
        $all[$key][] = $now;
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($all));
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok;
}

function read_messages(): array
{
    $file = messages_file();
    if (!is_file($file)) {
        return [];
    }
    $out = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $row = json_decode($line, true);
        if (is_array($row)) {
            $out[] = $row;
        }
    }
    return array_reverse($out);
}
