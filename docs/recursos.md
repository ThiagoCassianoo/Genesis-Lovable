# Recursos permitidos e proibidos

Curadoria de ferramentas de apoio (não é código de produção, é
ferramenta de processo). Base: repositório yurimutti/recursos-frontend,
filtrado pelo que serve a stack e ao padrão alto-ticket deste projeto.

## Permitidos

| Categoria | Recursos | Como usar |
|---|---|---|
| Ícones | Lucide, Heroicons, Feather, Tabler Icons | Lucide já está no stack. Heroicons/Tabler como fallback |
| Fontes | Google Fonts, FontPair, Font Squirrel | Inter, Manrope, Plus Jakarta Sans. FontPair para pares |
| Cores | Coolors, UI Colors, Khroma | Paleta Missões Tech. UI Colors exporta para Tailwind |
| Compressão de imagem | TinyPNG, Squoosh | Obrigatório antes de commit. Squoosh para WebP/AVIF |
| Performance | PageSpeed Insights, GTmetrix, WebPagetest, Lighthouse CI | Métricas do `reviewer-agent` |
| Acessibilidade | axe DevTools, Contrast Ratio | Testar antes da entrega |
| Inspiração | Awwwards, Land-book, Dribbble | Ver `docs/referencias.md` — não copiar, extrair princípio |
| Ilustração | Undraw, Humaaans | Para seções vazias (empty states) |
| Ferramentas | SVG to JSX, Transform Tools | Conversão de formato/componente |

## Proibidos (fora do escopo ou anti-padrão)

| Categoria | Por que não |
|---|---|
| Hospedagem alternativa | Vercel já é o padrão definido — não precisa de alternativa |
| Templates HTML/CSS prontos | Projeto é React, não HTML estático |
| Ferramentas de prototipação (Figma/Adobe XD) | Design, não código — não faz parte do fluxo dos agentes |
| Plugins jQuery (Owl Carousel, SlickSlider, Lightbox) | Obsoletos |
| Particles.js | Decorativo, sem função — anti-padrão do projeto |
| Libs de parallax antigas (Rellax, Skrollr) | Substituídas por GSAP ScrollTrigger |
| Animação CSS-only genérica (Animate.css, WOW.js) | Substituídas por Framer Motion/GSAP |
| Desafios de código/aprendizado | Para estudo, não para produção |
