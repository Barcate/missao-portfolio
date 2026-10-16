// Todo o conteúdo editável do portfólio fica aqui.

export const profile = {
  logo: 'BARBOSA',
  greeting: 'OLÁ, VIAJANTE',
  name: 'MATHEUS BARBOSA',
  tagline: 'Desenvolvedor Criativo & Explorador de Código',
};

export const navLinks = [
  { label: 'Sobre', href: '#' },
  { label: 'Projetos', href: '#' },
  { label: 'Contato', href: '#' },
];

export const about = {
  tag: '// 01 — Sobre Mim',
  title: ['Olá, eu sou', 'Matheus Barbosa'],
  paragraphs: [
    'Desenvolvedor full-stack apaixonado por criar experiências digitais que mesclam design e tecnologia.',
    'Especializado em interfaces 3D, aplicações web e sistemas que escalam.',
  ],
};

export const projects = {
  tag: '// 02 — Projetos',
  title: ['Missões', 'Concluídas'],
  // stack = chip de destaque (tipo/tecnologia) · host = texto do link · desc = frase do passo
  items: [
    {
      name: 'AMBATECH',
      stack: 'Landing page · UI/UX',
      url: 'https://ambatech.vercel.app',
      host: 'ambatech.vercel.app',
      desc: 'Site da AmbaTech: landing pages de alta conversão, portfólios e UI/UX design.',
    },
    {
      name: 'LEO CARDAN',
      stack: 'Landing page de mentoria',
      url: 'https://mentoria-leocardan.vercel.app',
      host: 'mentoria-leocardan.vercel.app',
      desc: 'Página da mentoria individual Status & Percepção: autoridade percebida e presença que abre portas.',
    },
    {
      name: 'RAI KOCHŌ',
      stack: 'Portfólio',
      url: 'https://faiskapressao.com',
      host: 'faiskapressao.com',
      desc: 'Portfólio pessoal de Rai Kochō.', // EXEMPLO: escreva uma frase melhor
    },
    {
      name: 'MINDFUL COURSES',
      stack: 'Site institucional + serviços',
      url: 'https://mindful-courses.vercel.app',
      host: 'mindful-courses.vercel.app',
      desc: 'Psicologia intercultural Brasil → EUA: mentorias, e-books, supervisão clínica e atendimento, com formulário de contato.',
    },
    {
      name: 'TEARTI',
      stack: 'E-commerce',
      url: 'https://tearti-ecommerce-meen.vercel.app',
      host: 'tearti-ecommerce-meen.vercel.app',
      desc: 'Loja virtual da TEARTI.', // EXEMPLO: escreva uma frase melhor
    },
    {
      name: 'PRATA BIOPHOTONICS LAB',
      stack: 'Site científico · Astro',
      url: 'https://www.ifsc.usp.br/~prata/',
      host: 'ifsc.usp.br/~prata',
      desc: 'Site do laboratório de biofotônica do IFSC-USP: pesquisa, publicações, equipe e contato do Prof. Sebastião Pratavieira.',
    },
  ],
};

export const contact = {
  tag: '// 03 — Contato',
  title: ['Vamos', 'Colaborar?'],
  text: 'Sempre aberto a novos projetos e parcerias.',
  links: [
    { label: '✉ seu@email.com', href: 'mailto:seu@email.com', external: false },
    { label: '⌥ github.com/seunome', href: 'https://github.com/seunome', external: true },
  ],
};

/** Texto de convite exibido ao lado de cada portal (mesma ordem de SECTIONS) */
export const portals = [
  {
    tag: about.tag,
    name: 'Nebulosa',
    hint: 'Um portal violeta pulsa ao seu lado. Quer descobrir quem está por trás da missão?',
  },
  {
    tag: projects.tag,
    name: 'Distrito Neon',
    hint: 'Um portal ciano leva a uma cidade de luz onde cada monólito guarda um projeto.',
  },
  {
    tag: contact.tag,
    name: 'Planeta Vermelho',
    hint: 'Um portal laranja abre para um planeta tranquilo — o lugar certo para conversar.',
  },
];

// ─── História de cada mundo: um item por "passo" (rolar para baixo avança, para cima volta) ───
//
// keyword: palavra gigante desenhada DENTRO da cena. No Planeta Vermelho (letras 3D) use só
//          MAIÚSCULAS sem acento (a fonte embutida do three só tem ASCII).
// meta:    chip de destaque (ex.: stack do projeto) · links: botões clicáveis no passo.
// Os textos dos passos extras são EXEMPLOS — troque pelos seus.

export interface BeatLink {
  label: string;
  href: string;
  external: boolean;
}

export interface Beat {
  kicker: string;
  title: string;
  lines: string[];
  keyword: string;
  meta?: string;
  links?: BeatLink[];
  /** URL exibida num iframe dentro do mundo (Distrito Neon) */
  embed?: string;
}

export const stories: Beat[][] = [
  // 0 · Nebulosa — Sobre
  [
    {
      kicker: about.tag,
      title: about.title.join(' '),
      lines: [about.paragraphs[0]],
      keyword: 'SOBRE',
    },
    {
      kicker: '// 01.1 — O que eu faço',
      title: 'Interfaces que vão além da tela',
      lines: [about.paragraphs[1]],
      keyword: 'CRIAR',
    },
    {
      kicker: '// 01.2 — Como eu trabalho',
      title: 'Design e código na mesma conversa',
      lines: ['Gosto de acompanhar uma ideia do primeiro rascunho até o produto no ar.'],
      keyword: 'CÓDIGO',
    },
  ],
  // 1 · Distrito Neon — Projetos (passo 0 = abertura, depois um por projeto)
  [
    {
      kicker: projects.tag,
      title: projects.title.join(' '),
      lines: [`Cada monólito guarda um projeto no ar. Role para visitar os ${projects.items.length}.`],
      keyword: 'PROJETOS',
    },
    ...projects.items.map((item, i) => ({
      kicker: `// 02.${i + 1} — ${item.name}`,
      title: item.name,
      lines: [item.desc],
      keyword: item.name,
      meta: item.stack,
      links: [{ label: `↗ ${item.host}`, href: item.url, external: true }],
      embed: item.url,
    })),
  ],
  // 2 · Planeta Vermelho — Contato
  [
    {
      kicker: contact.tag,
      title: contact.title.join(' '),
      lines: [contact.text],
      keyword: 'VAMOS',
    },
    {
      kicker: '// 03.1 — Do outro lado do sinal',
      title: 'Me conte a sua ideia',
      lines: ['Vamos transformar o que você imagina em algo que funciona.'],
      keyword: 'FALE',
    },
    {
      kicker: '// 03.2 — Escolha seu canal',
      title: 'Estou por aqui',
      lines: [],
      keyword: 'CONTATO',
      links: contact.links,
    },
  ],
];
