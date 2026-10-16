# Missão: Portfólio

Portfólio 3D interativo — Astro + React + TypeScript + Three.js + GSAP (Vite por baixo do Astro).

## Rodando

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # gera ./dist
npm run preview
npm run typecheck
```

## Publicando no GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site
automaticamente quando há um push para a branch `main`. No repositório do
GitHub, habilite **Settings → Pages → Build and deployment → Source → GitHub
Actions**. Depois do primeiro deploy, o endereço aparece na seção **Pages**.

O caminho base é configurado automaticamente para repositórios de projeto; um
repositório chamado `<usuario>.github.io` é publicado na raiz do domínio.

## Modelos 3D

Coloque os dois arquivos em `public/assets/`:

- `astronauta.glb`
- `spacedock.glb` (renomeie o `spacedock_1.glb`)

## Estrutura

```
src/
├─ pages/index.astro          # página (monta <Experience client:only="react" />)
├─ layouts/Layout.astro       # <head>, fontes, CSS global
├─ components/                # UI em React (Loader, StartScreen, Hud, SectionCards)
│  └─ Experience.tsx          # liga a cena 3D ao estado do React
├─ data/portfolio.ts          # textos, links e projetos (edite aqui)
├─ lib/scene/                 # tudo de Three.js/GSAP, sem React
│  ├─ PortfolioScene.ts       # máquina de estados + animações
│  ├─ FireSystem.ts           # partículas do jetpack
│  ├─ blackHole.ts · stars.ts
│  └─ config.ts               # seções, gatilhos de scroll, trechos de animação
└─ styles/global.css
```

Ao mudar o número de seções, ajuste `SECTIONS`/`SCROLL_GATES` em `config.ts`
e a altura de `.scroll-wrapper` no CSS.
