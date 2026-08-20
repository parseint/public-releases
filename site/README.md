# Página pública de downloads

Gera `dist/index.html` — a página que o cliente acessa para baixar os instaladores
com um clique, sem precisar entrar no GitHub.

Publicada pelo workflow [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)
a cada push na `main` que mexa em `sischef/**`, `wallpapers/**` ou `site/**`.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `apps.json` | Catálogo: nome, descrição, requisitos e ícone de cada app. **É aqui que se edita o texto que o cliente lê.** |
| `build.js` | Monta o HTML lendo o que está versionado no repositório. |
| `estilo.css` | Aparência da página. |

Versão, tamanho e data de cada arquivo **não** ficam no `apps.json`: saem do próprio
repositório a cada build. Publicou um `.exe` novo, a página se atualiza sozinha.

## Rodar local

```bash
node site/build.js
# abre dist/index.html no navegador
```

Sem `GITHUB_TOKEN` funciona, mas usa o limite de 60 requisições/hora da API pública.

## Como adicionar um app novo

Acrescente um item em `apps.json`:

```json
{
  "pasta": "sischef/nome-da-pasta",
  "nome": "Nome que o cliente vê",
  "descricao": "O que o programa faz, em uma ou duas frases.",
  "requisitos": "Windows 10 ou superior (64 bits)",
  "icone": "monitor",
  "extensoes": [".exe"]
}
```

Campos opcionais:

- `oculto: true`: a pasta **não** aparece na página. É assim que se escolhe o que vai
  para o cliente sem apagar a configuração — o item continua no `apps.json`, pronto
  para voltar trocando por `false`. O `whatsapp-connect` está assim hoje.
- `principal`: nome exato do arquivo que é sempre o download atual (use quando o
  instalador tem nome fixo, sem versão — ex.: `PDV Sischef Setup.exe`). Sem ele,
  vence a maior versão encontrada no nome do arquivo.
- `historicoEm`: subpasta cujos arquivos vão direto para "Versões anteriores".
- `ignorar`: nomes ou sufixos a esconder (ex.: `.blockmap`, `latest.yml`).
- `recursivo: false`: não entra em subpastas.
- `listarTodos: true`: mostra todos os arquivos em lista, sem botão de download
  (usado nos wallpapers).
- `destaque: true`: dá um pouco mais de peso visual ao card.
- `autoUpdate`: frase extra avisando que o app se atualiza sozinho.
- `icone`: `impressora`, `monitor`, `totem`, `whatsapp`, `catraca`, `balanca`,
  `imagem` ou `padrao`.

## Detalhes que não são óbvios

**O link de download é `github.com/<repo>/raw/main/<arquivo>`, não
`raw.githubusercontent.com`.** Para os arquivos em Git LFS, o `raw.githubusercontent`
devolve o ponteiro de texto de ~130 bytes em vez do instalador. A forma usada aqui
redireciona para `media.githubusercontent.com` e funciona nos dois casos.

**O tamanho do arquivo vem do ponteiro do LFS.** Arquivo em LFS aparece na API com
133 bytes; o `build.js` lê o ponteiro (que é texto e traz `size` e `sha256`) para
mostrar o tamanho real. Por isso o checkout do workflow usa `lfs: false` e
`sparse-checkout: site` — nenhum binário é baixado no build.

**Não mexa no `sischef/monitor-impressao`.** Aquela pasta está fora do LFS de
propósito (veja o `.gitattributes`), porque o auto-update do electron-updater lê o
`latest.yml` e o `.exe` pelo `raw.githubusercontent.com` e não sabe resolver
ponteiro de LFS.
