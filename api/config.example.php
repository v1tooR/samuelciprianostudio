<?php
// Copy this file to api/config.php ON THE SERVER (Hostinger > Gerenciador de Arquivos)
// and change both values. config.php is kept out of git so the password never
// ends up on GitHub.
return [
    // password for /api/mensagens.php
    'senha' => 'troque-esta-senha',
    // any long random text; used to anonymise visitors in the rate limit
    'sal' => 'troque-por-um-texto-aleatorio-longo',
];
