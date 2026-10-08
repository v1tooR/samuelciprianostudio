# Samuel Cipriano Studio

Site estático em português, com homepage e três estudos de identidade de marca. Os arquivos HTML e `assets/` podem ser publicados diretamente; não há build de produção obrigatório.

## SEO e compartilhamento

As quatro páginas possuem títulos e descrições específicos, conteúdo em HTML estático, um H1, navegação por links, textos alternativos e dimensões explícitas nas imagens. A homepage usa JavaScript nativo para as interações; não precisa de React para exibir o conteúdo. O player do YouTube só é solicitado ao pressionar play.

`seo.config.json` reúne o domínio oficial, os metadados e as capas por página. O domínio deve ser confirmado antes de gerar URLs públicas. Configure uma vez:

```sh
npm install
npm run seo:configure -- --site=https://dominio-oficial.com.br
```

O comando grava o domínio na configuração, adiciona canonical, Open Graph, Twitter Cards e JSON-LD diretamente ao `<head>` das quatro páginas, e gera `sitemap.xml` e `robots.txt`. Nas próximas alterações, execute `npm run seo:configure` para atualizar os arquivos. O comando pode ser repetido sem duplicar metadados.

Os dados estruturados representam o estúdio, o site, as páginas, os três serviços e os estudos de marca. Entremeio permanece identificado como projeto conceitual. Não foram adicionados avaliações, resultados ou endereços sem evidência.

As capas JPEG em `assets/social/` têm 1200 × 630 pixels. A composição da homepage usa o logotipo, as cores e as ilustrações botânicas originais. Cada projeto tem uma capa própria. A fonte editável fica em `scripts/templates/social-card.html`.

Para recriar as capas e o favicon:

```sh
npx playwright install chromium
npm run social:build
```

Se o Chromium já estiver instalado em outro local, defina `CHROMIUM_PATH` com o caminho do executável.

## Validação e preview

```sh
npm test
npm run test:browser
npm run preview
```

O preview abre em `http://127.0.0.1:4173`. Os testes verificam o HTML entregue sem JavaScript, as imagens, os links internos, a geração de metadados com um domínio de teste, a navegação móvel e o fallback sem bibliotecas de animação. As capturas locais ficam em `.seo-preview/` e não são versionadas.

## Depois da publicação

1. Confirme que o domínio HTTPS escolhido resolve para este site e que homepage, projetos, capas, `robots.txt` e `sitemap.xml` retornam HTTP 200.
2. Redirecione as variantes de domínio para a origem escolhida no servidor ou no provedor de hospedagem. As URLs `/index.html` e `/projetos/.../index.html` devem redirecionar para as respectivas URLs com barra final quando a hospedagem permitir.
3. Verifique a propriedade no Google Search Console, envie `/sitemap.xml` e solicite indexação das quatro páginas.
4. Valide a URL publicada nos depuradores de compartilhamento; serviços podem manter a prévia anterior em cache.
5. Acompanhe consultas, impressões, cliques e contatos. Desenvolva novos estudos e conteúdos específicos sobre os problemas dos clientes e os serviços do estúdio com base nas consultas observadas.

O SEO técnico prepara o site para descoberta e compreensão. O crescimento orgânico depende também da publicação, de conteúdo útil, de referências ao estúdio e do acompanhamento dos resultados. O Search Console e a configuração de hospedagem não foram alterados por estes scripts.
