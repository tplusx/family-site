<?php
// Copy this file to /home/YOUR_CPANEL_USER/contact-config.php, outside public_html.
// Never place real credentials in the repository or public_html.
return [
    'smtp_host' => 'mail.example.com',
    'smtp_port' => 587,
    'smtp_security' => 'tls', // tls (port 587), ssl (port 465), or none
    'smtp_username' => 'website@example.com',
    'smtp_password' => 'replace-with-a-strong-password',
    'from_email' => 'website@example.com',
    'from_name' => 'Anya meluhor website',
    'to_email' => 'hello@example.com',
];
