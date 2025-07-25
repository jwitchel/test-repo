<?php
// Custom configuration for test mail server

// IMAP server configuration
$config['default_host'] = 'host.docker.internal';
$config['default_port'] = 1143;

// SMTP server configuration
$config['smtp_host'] = 'host.docker.internal:1025';

// Enable username domain
$config['username_domain'] = 'testmail.local';

// Force domain for logins
$config['login_autocomplete'] = 2;

// Disable SSL verification for test environment
$config['imap_conn_options'] = array(
    'ssl' => array(
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ),
);

$config['smtp_conn_options'] = array(
    'ssl' => array(
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ),
);

// Debug settings for troubleshooting
$config['imap_debug'] = true;
$config['smtp_debug'] = true;
$config['sql_debug'] = true;

// Log directory
$config['log_dir'] = '/var/www/html/logs/';

// Enable logging
$config['debug_level'] = 1;