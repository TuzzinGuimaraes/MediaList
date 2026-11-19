# Web: PROTÓTIPO descartável (ticket 19)

Variantes de layout de desktop do web novo, para escolher antes de implementar (Q68). Não é
código de produção: sem testes, erro mínimo. Vive só na branch `artur/web-prototipo`.

## Rodar

Com o stack docker de pé (API em `http://localhost:5000`, dados do `make seed-dev`):

```bash
make web-prototipo        # ou: cd Web && npm install && npm run dev
```

Abra `http://localhost:3006`. O login já vem preenchido com `teste@medialist.dev` / `teste123`.

## Eixos

Cada eixo é um search param; o primeiro valor é o padrão. A barra amarela no rodapé (só em dev)
troca: `←`/`→` mudam o valor do eixo ativo, `Shift+←`/`→` trocam o eixo, e clicar escolhe.

| Eixo | Valores |
|---|---|
| `nav` | `lateral` (Lateral recolhida, 72px, abre no hover/foco), `topo` (Topo) |
| `tema` | `escuro` (Carmesim), `claro` (Rubi) |

Ex.: `http://localhost:3006/lista?nav=topo&tema=claro`.

Fixos na 2ª rodada (veredito e Q72 a Q75 do ticket 19): Início híbrido, Lista em cards compactos,
Explorar com coluna de filtros recolhíveis e detalhe em duas colunas com o mapa de atividade.

## O que é real

- API real pelo proxy `/api`: login, catálogo (Em alta, Populares, carrosséis por ordem e por
  gênero), Explorar com filtros e paginação, detalhe, Avaliações (leitura) e a Lista pessoal.
- O stepper e o editor do Item gravam de verdade (`PUT /lista/<id>/progresso`, `PUT /lista/<id>`,
  `POST /lista/adicionar`, `DELETE /lista/<id>`): mexem nos dados do Usuário de dev.
- Cores e fonte saem de `design/tokens.js` (`npm run tema` gera `src/tema.gerado.css`).
- Notícias, Perfil e Administração são páginas vazias.

## O que é simulado

- Mapa de atividade do detalhe: números gerados a partir do id da Mídia (`paginas/MapaAtividade.tsx`),
  porque `GET /midias/<id>/atividade` ainda não existe.
- Ano do Explorar: filtra só a página carregada, porque a API ainda não aceita `ano_min`/`ano_max`.
- Plataformas e Estúdios do Explorar: tirados de uma amostra de 150 Mídias populares (`useFacetas`).
