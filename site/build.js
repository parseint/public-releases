/**
 * Gera a pagina publica de downloads (dist/index.html) a partir do que esta
 * versionado neste repositorio.
 *
 * Nao clona binario nenhum: le a arvore pela API do GitHub e, para arquivos em
 * Git LFS, le o ponteiro (poucos bytes) para descobrir o tamanho real.
 *
 * Uso:  node site/build.js
 * Env:  GITHUB_TOKEN (opcional fora da action), GITHUB_REPOSITORY, BRANCH
 */

const fs = require('fs')
const path = require('path')

const REPO = process.env.GITHUB_REPOSITORY || 'parseint/public-releases'
const BRANCH = process.env.BRANCH || 'main'
const TOKEN = process.env.GITHUB_TOKEN || ''
const RAIZ = path.resolve(__dirname, '..')
const SAIDA = path.join(RAIZ, 'dist')

// Usado so quando o apps.json nao declara "abas"
const INSTALACAO_PADRAO = [
  'Clique em **Baixar**. O arquivo vai para a pasta **Downloads** do seu computador.',
  'Abra o arquivo baixado com dois cliques.',
  'Se o Windows mostrar o aviso **"O Windows protegeu o computador"**, clique em **Mais informações** e depois em **Executar assim mesmo**. O aviso aparece porque o instalador é distribuído fora da loja da Microsoft.',
  'Siga o instalador até o fim e abra o programa.',
]

const cabecalhos = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'parseint-releases-site',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
}

async function api(caminho) {
  const resp = await fetch(`https://api.github.com${caminho}`, { headers: cabecalhos })
  if (!resp.ok) throw new Error(`GitHub API ${resp.status} em ${caminho}: ${await resp.text()}`)
  return resp.json()
}

function urlDownload(caminho) {
  // Esta forma resolve tanto arquivo normal quanto ponteiro de LFS (redireciona
  // para media.githubusercontent.com). Nao trocar por raw.githubusercontent.com,
  // que devolve o ponteiro de texto no lugar do binario.
  const seguro = caminho.split('/').map(encodeURIComponent).join('/')
  return `https://github.com/${REPO}/raw/${BRANCH}/${seguro}`
}

/**
 * Ponteiros de LFS sao arquivos de texto minusculos; so vale a pena olhar os pequenos.
 * Aqui usamos raw.githubusercontent.com de proposito: ele NAO resolve o LFS e devolve
 * o ponteiro, que e justamente o que queremos ler (tamanho real + sha256).
 */
async function lerPonteiroLfs(blob) {
  if (blob.size > 1024) return null
  const seguro = blob.path.split('/').map(encodeURIComponent).join('/')
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${seguro}`
  const resp = await fetch(url, { headers: { 'User-Agent': cabecalhos['User-Agent'] } })
  if (!resp.ok) return null
  const texto = await resp.text()
  if (!texto.startsWith('version https://git-lfs.github.com/spec/v1')) return null
  const tamanho = /^size (\d+)$/m.exec(texto)
  const oid = /^oid sha256:([0-9a-f]{64})$/m.exec(texto)
  return { tamanho: tamanho ? Number(tamanho[1]) : blob.size, sha256: oid ? oid[1] : null }
}

async function dataDoArquivo(caminho) {
  try {
    const commits = await api(
      `/repos/${REPO}/commits?per_page=1&sha=${BRANCH}&path=${encodeURIComponent(caminho)}`
    )
    return commits[0]?.commit?.committer?.date || null
  } catch {
    return null
  }
}

function versaoDe(nome) {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(nome)
  if (!m) return null
  return { texto: m[0], peso: [m[1], m[2], m[3] || 0, m[4] || 0].map(Number) }
}

function comparaVersao(a, b) {
  const pa = a.versao?.peso || [0, 0, 0, 0]
  const pb = b.versao?.peso || [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]
  return a.nomeArquivo.localeCompare(b.nomeArquivo)
}

function formataTamanho(bytes) {
  if (bytes === null || bytes === undefined) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function formataData(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

function esc(texto) {
  const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(texto === null || texto === undefined ? '' : texto).replace(/[&<>"']/g, (c) => mapa[c])
}

// Passo de instalacao: texto escapado, com **trecho** virando negrito
function formataPasso(texto) {
  return esc(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

const ICONES = {
  impressora: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/>',
  monitor: '<path d="M3 4h18v12H3zM8 20h8M12 16v4"/>',
  totem: '<path d="M6 2h12v16H6zM9 22h6M12 18v4M9 6h6"/>',
  whatsapp: '<path d="M3 21l1.7-5A8.2 8.2 0 1 1 8 19.4L3 21z"/><path d="M9 9c0 3 3 6 6 6"/>',
  catraca: '<path d="M4 12h16M12 4v16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7"/>',
  balanca: '<path d="M4 20h16M12 4v16M12 4l-6 6h12l-6-6"/>',
  imagem: '<path d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6"/>',
  padrao: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
}

function icone(nome) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.padrao}</svg>`
}

async function montaApp(app, blobs) {
  const pasta = app.pasta.replace(/\/$/, '')
  const extensoes = app.extensoes || ['.exe']
  const ignorar = app.ignorar || []
  const historicoEm = app.historicoEm ? app.historicoEm.replace(/\/$/, '') : null

  const pertence = (caminho, base) => {
    if (!caminho.startsWith(base + '/')) return false
    const resto = caminho.slice(base.length + 1)
    if (app.recursivo === false && resto.includes('/')) return false
    return true
  }

  const candidatos = blobs
    .filter((b) => {
      if (historicoEm && pertence(b.path, historicoEm)) return true
      if (!pertence(b.path, pasta)) return false
      if (historicoEm && b.path.startsWith(historicoEm + '/')) return false
      return true
    })
    .filter((b) => {
      const nome = b.path.split('/').pop()
      if (ignorar.some((p) => nome === p || nome.endsWith(p))) return false
      return extensoes.some((e) => nome.toLowerCase().endsWith(e))
    })

  if (!candidatos.length) return null

  const arquivos = []
  for (const blob of candidatos) {
    const nomeArquivo = blob.path.split('/').pop()
    const lfs = await lerPonteiroLfs(blob)
    arquivos.push({
      caminho: blob.path,
      nomeArquivo,
      url: urlDownload(blob.path),
      tamanho: lfs ? lfs.tamanho : blob.size,
      sha256: lfs ? lfs.sha256 : null,
      versao: versaoDe(nomeArquivo),
      historico: historicoEm ? blob.path.startsWith(historicoEm + '/') : false,
    })
  }

  arquivos.sort(comparaVersao)

  let atual
  if (app.principal) atual = arquivos.find((a) => a.nomeArquivo === app.principal)
  if (!atual) atual = arquivos.find((a) => !a.historico) || arquivos[0]

  const anteriores = app.listarTodos ? [] : arquivos.filter((a) => a !== atual)
  const todos = app.listarTodos ? arquivos : []

  atual.data = await dataDoArquivo(atual.caminho)

  return { ...app, atual, anteriores, todos }
}

function renderizaLinhaArquivo(arq) {
  const meta = [arq.versao ? `versão ${arq.versao.texto}` : null, formataTamanho(arq.tamanho)]
    .filter(Boolean)
    .join(' · ')
  return `<li>
        <a href="${esc(arq.url)}">${esc(arq.nomeArquivo)}</a>
        ${meta ? `<span>${esc(meta)}</span>` : ''}
      </li>`
}

function renderizaApp(app) {
  const atual = app.atual
  // Quando o card lista todos os arquivos (ex.: wallpapers) nao existe "versao atual",
  // entao o cabecalho nao deve falar de tamanho/versao de um arquivo so.
  const meta = app.todos.length
    ? []
    : [
        atual.versao ? `Versão ${atual.versao.texto}` : null,
        formataTamanho(atual.tamanho),
        formataData(atual.data) ? `Atualizado em ${formataData(atual.data)}` : null,
      ].filter(Boolean)

  const listaAnteriores = app.anteriores.length
    ? `
      <details class="anteriores">
        <summary>Versões anteriores (${app.anteriores.length})</summary>
        <ul>${app.anteriores.map(renderizaLinhaArquivo).join('')}</ul>
      </details>`
    : ''

  const listaTodos = app.todos.length
    ? `
      <ul class="lista-simples">${app.todos.map(renderizaLinhaArquivo).join('')}</ul>`
    : ''

  const botao = app.todos.length
    ? ''
    : `
      <a class="baixar" href="${esc(atual.url)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
        Baixar
      </a>`

  return `
    <article class="app${app.destaque ? ' destaque' : ''}">
      <div class="topo">
        <span class="icone">${icone(app.icone)}</span>
        <div>
          <h3>${esc(app.nome)}</h3>
          ${meta.length ? `<p class="meta">${esc(meta.join(' · '))}</p>` : ''}
        </div>
      </div>
      <p class="descricao">${esc(app.descricao)}</p>
      ${app.requisitos ? `<p class="requisitos">${esc(app.requisitos)}</p>` : ''}
      ${app.autoUpdate ? `<p class="aviso-update">${esc(app.autoUpdate)}</p>` : ''}
      ${botao}
      ${listaTodos}
      ${listaAnteriores}
    </article>`
}

function renderizaCategoria(cat) {
  return `
  <section>
    <h2>${esc(cat.titulo)}</h2>
    ${cat.descricao ? `<p class="sub">${esc(cat.descricao)}</p>` : ''}
    <div class="grade">${cat.apps.map(renderizaApp).join('')}</div>
  </section>`
}

function renderizaInstalacao(aba) {
  if (!aba.instalacao || !aba.instalacao.length) return ''

  return `
  <section class="instalacao">
    <h2>Como instalar</h2>
    <ol>
${aba.instalacao.map((passo) => `      <li>${formataPasso(passo)}</li>`).join('\n')}
    </ol>
  </section>`
}

function renderizaConteudoDaAba(aba) {
  return aba.categorias.map(renderizaCategoria).join('') + renderizaInstalacao(aba)
}

// Com uma aba so (ex.: Android ainda sem APK publicado) a pagina sai sem barra de abas, como antes
function renderizaAbas(abas) {
  if (abas.length === 1) return renderizaConteudoDaAba(abas[0])

  const entradas = abas
    .map((aba, i) => `  <input type="radio" name="aba" id="aba-${aba.id}"${i === 0 ? ' checked' : ''}>`)
    .join('\n')
  const rotulos = abas.map((aba) => `<label for="aba-${aba.id}">${esc(aba.titulo)}</label>`).join('')
  const paineis = abas
    .map((aba) => `  <div class="aba-painel aba-painel-${aba.id}">${renderizaConteudoDaAba(aba)}\n  </div>`)
    .join('\n')

  return `
  <div class="abas">
${entradas}
  <nav class="abas-rotulos" aria-label="Plataforma">${rotulos}</nav>
${paineis}
  </div>
  <script>(function(){var e=document.getElementById('aba-'+decodeURIComponent(location.hash.slice(1)));if(e&&e.type==='radio')e.checked=true})()</script>`
}

function cssDasAbas(abas) {
  if (abas.length < 2) return ''

  return abas
    .map(
      (aba) => `
#aba-${aba.id}:checked ~ .aba-painel-${aba.id} { display: flex; }
#aba-${aba.id}:checked ~ .abas-rotulos label[for="aba-${aba.id}"] { color: var(--marca-texto); border-bottom-color: var(--marca); }
#aba-${aba.id}:focus-visible ~ .abas-rotulos label[for="aba-${aba.id}"] { outline: 2px solid var(--marca-texto); outline-offset: 3px; }`
    )
    .join('')
}

function renderizaPagina(cfg, abas, geradoEm, estilo) {
  const suporte =
    cfg.suporte && cfg.suporte.url
      ? `
      <section class="suporte">
        <p>${esc(cfg.suporte.texto)}</p>
        <a href="${esc(cfg.suporte.url)}">${esc(cfg.suporte.rotulo || 'Falar com o suporte')}</a>
      </section>`
      : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.titulo)}</title>
<meta name="description" content="${esc(cfg.subtitulo)}">
<meta property="og:title" content="${esc(cfg.titulo)}">
<meta property="og:description" content="${esc(cfg.subtitulo)}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap">
<style>${estilo}${cssDasAbas(abas)}</style>
</head>
<body>
<div class="envolucro">
  <header>
    <span class="marca-eyebrow">Parseint · Sischef</span>
    <h1>${esc(cfg.titulo)}</h1>
    <p>${esc(cfg.subtitulo)}</p>
  </header>
${renderizaAbas(abas)}
${suporte}

  <footer>
    Página atualizada automaticamente a cada nova versão publicada · ${esc(geradoEm)}
  </footer>
</div>
</body>
</html>
`
}

async function principal() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'apps.json'), 'utf8'))
  const abas = cfg.abas && cfg.abas.length ? cfg.abas : [{ id: 'windows', titulo: 'Windows', instalacao: INSTALACAO_PADRAO }]

  for (const aba of abas) {
    if (!/^[a-z0-9-]+$/.test(aba.id)) throw new Error(`id de aba invalido no apps.json: "${aba.id}" (use a-z, 0-9 e -)`)
  }

  const arvore = await api(`/repos/${REPO}/git/trees/${BRANCH}?recursive=1`)
  if (arvore.truncated) console.warn('AVISO: a arvore veio truncada pela API; algum arquivo pode ficar de fora.')
  const blobs = arvore.tree.filter((n) => n.type === 'blob')

  const categorias = []
  for (const cat of cfg.categorias) {
    const apps = []
    for (const app of cat.apps) {
      if (app.oculto) {
        console.log(`Ignorando "${app.nome}": marcado como oculto no apps.json.`)
        continue
      }
      const montado = await montaApp(app, blobs)
      if (montado) apps.push(montado)
      else console.warn(`AVISO: nenhum arquivo encontrado para "${app.nome}" em ${app.pasta}`)
    }
    if (apps.length) categorias.push({ ...cat, apps })
  }

  const abaDe = (cat) => cat.aba || abas[0].id
  for (const cat of categorias) {
    if (!abas.some((aba) => aba.id === abaDe(cat))) console.warn(`AVISO: categoria "${cat.titulo}" aponta para a aba inexistente "${cat.aba}"`)
  }

  const abasComConteudo = abas
    .map((aba) => ({ ...aba, categorias: categorias.filter((cat) => abaDe(cat) === aba.id) }))
    .filter((aba) => aba.categorias.length)

  const geradoEm = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const estilo = fs.readFileSync(path.join(__dirname, 'estilo.css'), 'utf8')
  const html = renderizaPagina(cfg, abasComConteudo, geradoEm, estilo)

  fs.rmSync(SAIDA, { recursive: true, force: true })
  fs.mkdirSync(SAIDA, { recursive: true })
  fs.writeFileSync(path.join(SAIDA, 'index.html'), html)
  fs.writeFileSync(path.join(SAIDA, '.nojekyll'), '')
  if (cfg.dominio) fs.writeFileSync(path.join(SAIDA, 'CNAME'), cfg.dominio + '\n')

  const total = categorias.reduce((s, c) => s + c.apps.length, 0)
  console.log(`dist/index.html gerado com ${total} item(ns) em ${abasComConteudo.length} aba(s).`)
}

principal().catch((e) => {
  console.error(e)
  process.exit(1)
})
