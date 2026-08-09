<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, string $message): never {
    http_response_code($status);
    echo json_encode(['message' => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, 'Method not allowed.');
}

$siteHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$originHost = strtolower((string) parse_url((string) ($_SERVER['HTTP_ORIGIN'] ?? ''), PHP_URL_HOST));
if ($originHost !== '' && preg_replace('/:\d+$/', '', $siteHost) !== $originHost) {
    respond(403, 'Request origin was not accepted.');
}

if (!empty($_POST['website'])) respond(200, 'Thanks — your message has been received.');
$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));
if ($name === '' || strlen($name) > 80 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || strlen($message) < 10 || strlen($message) > 4000) {
    respond(422, 'Please check each field and try again.');
}

// A lock-protected, per-IP hourly limit suitable for a single cPanel server.
$key = hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
$rateFile = sys_get_temp_dir() . '/anya-contact-' . $key;
$handle = fopen($rateFile, 'c+');
if ($handle === false) respond(503, 'Mail is temporarily unavailable. Please try again later.');
flock($handle, LOCK_EX);
$stored = json_decode(stream_get_contents($handle) ?: '{}', true);
$now = time();
$window = isset($stored['start']) && $now - (int) $stored['start'] < 3600;
$count = $window ? (int) ($stored['count'] ?? 0) + 1 : 1;
$start = $window ? (int) $stored['start'] : $now;
ftruncate($handle, 0); rewind($handle); fwrite($handle, json_encode(['start' => $start, 'count' => $count])); fflush($handle); flock($handle, LOCK_UN); fclose($handle);
if ($count > 5) respond(429, 'Too many messages. Please try again later.');

$configPath = dirname((string) ($_SERVER['DOCUMENT_ROOT'] ?? __DIR__)) . '/contact-config.php';
if (!is_readable($configPath)) {
    error_log('Anya contact: config not found outside document root.');
    respond(503, 'Mail is temporarily unavailable. Please try again later.');
}
$config = require $configPath;

function smtpRead($socket, array $expected): string {
    $response = '';
    do {
        $line = fgets($socket, 515);
        if ($line === false) throw new RuntimeException('SMTP connection closed.');
        $response .= $line;
    } while (isset($line[3]) && $line[3] === '-');
    if (!in_array((int) substr($response, -strlen($line), 3), $expected, true)) throw new RuntimeException('SMTP rejected a command: ' . trim($response));
    return $response;
}
function smtpWrite($socket, string $command, array $expected): void {
    fwrite($socket, $command . "\r\n");
    smtpRead($socket, $expected);
}
function cleanHeader(string $value): string { return str_replace(["\r", "\n"], '', $value); }

try {
    foreach (['smtp_host','smtp_port','smtp_security','smtp_username','smtp_password','from_email','from_name','to_email'] as $required) {
        if (!isset($config[$required]) || $config[$required] === '') throw new RuntimeException('Incomplete mail configuration.');
    }
    $transport = $config['smtp_security'] === 'ssl' ? 'ssl://' : '';
    $socket = stream_socket_client($transport . $config['smtp_host'] . ':' . (int) $config['smtp_port'], $errorNumber, $errorMessage, 15, STREAM_CLIENT_CONNECT);
    if ($socket === false) throw new RuntimeException("SMTP connection failed: $errorNumber $errorMessage");
    stream_set_timeout($socket, 15); smtpRead($socket, [220]);
    smtpWrite($socket, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), [250]);
    if ($config['smtp_security'] === 'tls') {
        smtpWrite($socket, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('Unable to start TLS.');
        smtpWrite($socket, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), [250]);
    }
    smtpWrite($socket, 'AUTH LOGIN', [334]);
    smtpWrite($socket, base64_encode((string) $config['smtp_username']), [334]);
    smtpWrite($socket, base64_encode((string) $config['smtp_password']), [235]);
    smtpWrite($socket, 'MAIL FROM:<' . cleanHeader((string) $config['from_email']) . '>', [250]);
    smtpWrite($socket, 'RCPT TO:<' . cleanHeader((string) $config['to_email']) . '>', [250, 251]);
    smtpWrite($socket, 'DATA', [354]);
    $subject = 'Family archive message from ' . cleanHeader($name);
    $body = "From: $name <$email>\r\n\r\n" . str_replace("\n.", "\n..", str_replace(["\r\n", "\r"], "\n", $message));
    $headers = ['From: ' . cleanHeader((string) $config['from_name']) . ' <' . cleanHeader((string) $config['from_email']) . '>', 'Reply-To: ' . cleanHeader($email), 'To: ' . cleanHeader((string) $config['to_email']), 'Subject: ' . $subject, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8'];
    fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $body) . "\r\n.\r\n");
    smtpRead($socket, [250]); smtpWrite($socket, 'QUIT', [221]); fclose($socket);
} catch (Throwable $error) {
    error_log('Anya contact SMTP error: ' . $error->getMessage());
    respond(502, 'Mail is temporarily unavailable. Please try again later.');
}
respond(200, 'Thank you. Your message has been sent.');
