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
  tag: 'Sobre mim',
  title: ['Olá, eu sou', 'Matheus Barbosa'],
};

export interface Project {
  name: string;
  stack: string;
  url: string;
  host: string;
  /** o que é o projeto (1ª frase do passo) */
  desc: string;
  /** o que ele resolve / como foi pensado (2ª frase do passo) */
  detail: string;
  /** false = o site proíbe iframe */
  embed?: false;
}

export const projects: { tag: string; title: string[]; items: Project[] } = {
  tag: 'Projetos',
  title: ['Missões', 'Concluídas'],
  // stack = chip de destaque (tipo/tecnologia) · host = texto do link · desc + detail = os dois parágrafos do passo
  // embed: false = o site proíbe iframe (X-Frame-Options / frame-ancestors): o quadro mostra só o aviso + link
  items: [
    {
      name: 'AMBATECH',
      stack: 'Landing page · UI/UX',
      url: 'https://ambatech.vercel.app',
      host: 'ambatech.vercel.app',
      desc: 'Site da AmbaTech, estúdio de landing pages, portfólios e UI/UX design.',
      detail: 'Uma página que precisa vender design usando design: visual marcante, mensagem direta e carregamento rápido para ninguém desistir no caminho.',
    },
    {
      name: 'RAI KOCHŌ',
      stack: 'Portfólio',
      url: 'https://faiskapressao.com',
      host: 'faiskapressao.com',
      // REVISAR: o site quase não tem texto fora do JavaScript; confirme se a descrição bate
      desc: 'Portfólio pessoal de Rai Kochō, com domínio próprio.',
      detail: 'Pensado para o trabalho falar primeiro: a navegação sai do caminho e deixa as peças ocuparem a tela.',
    },
    {
      name: 'MINDFUL COURSES',
      stack: 'Site institucional + serviços',
      url: 'https://mindful-courses.vercel.app',
      host: 'mindful-courses.vercel.app',
      desc: 'Psicologia intercultural Brasil → EUA: orientação para psicólogos brasileiros que querem atuar nos Estados Unidos.',
      detail: 'Reúne mentorias, e-books, supervisão clínica e validação de diploma em português, com um caminho claro até agendar uma conversa.',
    },
    {
      name: 'TEARTI',
      stack: 'E-commerce',
      url: 'https://tearti-ecommerce-meen.vercel.app',
      host: 'tearti-ecommerce-meen.vercel.app',
      // REVISAR: o site quase não tem texto fora do JavaScript; confirme o que a TEARTI vende
      desc: 'Loja virtual da TEARTI, com catálogo, carrinho e identidade visual própria.',
      detail: 'A marca entra em cena antes dos produtos: uma abertura animada com o logo prepara o clima da compra.',
    },
    {
      name: 'PRATA BIOPHOTONICS LAB',
      stack: 'Site científico · Astro',
      url: 'https://www.ifsc.usp.br/~prata/',
      host: 'ifsc.usp.br/~prata',
      desc: 'Site oficial do laboratório do Prof. Sebastião Pratavieira no Instituto de Física de São Carlos (IFSC-USP).',
      detail: 'Apresenta a pesquisa em biofotônica e diagnóstico óptico, as publicações e a equipe, num site leve e rápido feito com Astro.',
    },
    // por último: é o único sem site ao vivo no quadro, assim não interrompe a sequência
    {
      name: 'LEO CARDAN',
      stack: 'Landing page de mentoria',
      url: 'https://mentoria-leocardan.vercel.app',
      host: 'mentoria-leocardan.vercel.app',
      embed: false, // o site responde X-Frame-Options: DENY
      desc: 'Página da mentoria individual Status & Percepção, de Leo Cardan.',
      detail: 'Fala de autoridade percebida e presença que abre portas, com uma estrutura que conduz quem lê até a aplicação.',
    },
  ],
};

export const contact = {
  tag: 'Contato',
  title: ['Vamos', 'Colaborar?'],
  links: [
    { label: 'mateusbosa21@gmail.com', href: 'mailto:mateusbosa21@gmail.com', external: false },
    { label: 'github.com/barcate', href: 'https://github.com/barcate', external: true },
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
    hint: 'Um portal laranja abre para um planeta tranquilo, o lugar certo para conversar.',
  },
];

// ─── História de cada mundo: um item por "passo" (rolar para baixo avança, para cima volta) ───
//
// keyword: palavra gigante desenhada DENTRO da cena. No Planeta Vermelho (letras 3D) use só
//          MAIÚSCULAS sem acento (a fonte embutida do three só tem ASCII).
// meta:    chip de destaque (ex.: stack do projeto) · links: botões clicáveis no passo.
// lines:   no máximo 2 parágrafos curtos por passo (no celular o texto divide a tela com a cena).

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
      lines: [
        'Sou desenvolvedor full-stack e gosto de construir coisas que as pessoas lembram depois de fechar a aba.',
        'Este portfólio é um exemplo: em vez de uma lista de links, uma viagem. Vá com calma, cada portal guarda uma parte da história.',
      ],
      keyword: 'SOBRE',
    },
    {
      kicker: 'O que eu faço',
      title: 'Interfaces que vão além da tela',
      lines: [
        'Crio sites e aplicações web do zero: landing pages que convertem, portfólios com personalidade, lojas virtuais e sistemas feitos para crescer.',
        'Quando o projeto pede, levo a interface para o 3D, com WebGL, animação e som. Como esta aqui.',
      ],
      keyword: 'CRIAR',
    },
    {
      kicker: 'Como eu trabalho',
      title: 'Design e código na mesma conversa',
      lines: [
        'Não separo a ideia da execução. Penso no visual e na arquitetura ao mesmo tempo, então o que é desenhado é o que vai para o ar.',
        'Acompanho do primeiro rascunho até o deploy, e continuo por perto depois: ajuste fino, desempenho e aquele detalhe que faz diferença.',
      ],
      keyword: 'CÓDIGO',
    },
    {
      kicker: 'Ferramentas',
      title: 'O que vai na mochila',
      lines: [
        'TypeScript, React e Astro na base. Three.js e GSAP quando a página precisa ganhar profundidade e movimento.',
        'Mas a ferramenta vem depois do problema: escolho a tecnologia pelo que o projeto precisa, não pelo que está na moda.',
      ],
      keyword: 'STACK',
    },
  ],
  // 1 · Distrito Neon — Projetos (passo 0 = abertura, depois um por projeto)
  [
    {
      kicker: projects.tag,
      title: projects.title.join(' '),
      lines: [
        'Cada monólito desta avenida guarda um projeto que está no ar agora. Não são capturas de tela: são os sites de verdade.',
        `Role para visitar os ${projects.items.length} e clique em qualquer um para navegar por dentro, sem sair daqui.`,
      ],
      keyword: 'PROJETOS',
    },
    ...projects.items.map((item, i) => ({
      kicker: `Projeto ${i + 1}`,
      title: item.name,
      lines: [item.desc, item.detail],
      keyword: item.name,
      meta: item.stack,
      links: [{ label: item.host, href: item.url, external: true }],
      embed: item.embed === false ? undefined : item.url,
    })),
  ],
  // 2 · Planeta Vermelho — Contato
  [
    {
      kicker: contact.tag,
      title: contact.title.join(' '),
      lines: [
        'Sempre aberto a novos projetos, parcerias e ideias que ainda estão no guardanapo.',
        'Se você chegou até aqui, já viu como eu gosto de trabalhar. Agora quero ouvir o que você quer construir.',
      ],
      keyword: 'VAMOS',
    },
    {
      kicker: 'Do outro lado do sinal',
      title: 'Me conte a sua ideia',
      lines: [
        'Não precisa chegar com tudo pronto. Me conte o objetivo, para quem é e o prazo que você tem em mente.',
        'A partir daí eu proponho o caminho: escopo, tecnologia e as etapas até o lançamento.',
      ],
      keyword: 'FALE',
    },
    {
      kicker: 'Escolha seu canal',
      title: 'Estou por aqui',
      lines: ['Me chame por e-mail ou dê uma olhada no meu GitHub, onde também dá para ver mais do meu código.'],
      keyword: 'CONTATO',
      links: contact.links,
    },
  ],
];
