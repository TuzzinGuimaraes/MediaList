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
| `nav` | `topo` (Topo), `lateral` (Lateral) |
| `inicio` | `a` (Destaque largo), `b` (Destaque + coluna) |
| `lista` | `linhas` (Abas + linhas), `grade` (Abas + grade) |
| `explorar` | `coluna` (Coluna), `sheet` (Sheet) |
| `detalhe` | `duas` (Duas colunas), `central` (Coluna central) |
| `tema` | `escuro` (Carmesim), `claro` (Rubi) |

Ex.: `http://localhost:3006/lista?nav=lateral&lista=grade&tema=claro`.

## O que é real

- API real pelo proxy `/api`: login, catálogo (Em alta, Populares, carrosséis por ordem e por
  gênero), Explorar com filtros e paginação, detalhe, Avaliações (leitura) e a Lista pessoal.
- O stepper e o editor do Item gravam de verdade (`PUT /lista/<id>/progresso`, `PUT /lista/<id>`,
  `POST /lista/adicionar`, `DELETE /lista/<id>`): mexem nos dados do Usuário de dev.
- Cores e fonte saem de `design/tokens.js` (`npm run tema` gera `src/tema.gerado.css`).
- Notícias, Perfil e Administração são páginas vazias.
