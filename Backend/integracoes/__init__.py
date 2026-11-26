"""Integrações (ADR 0015): trazer para a Lista o que o Usuário registra no AniList, MAL e Steam.

Somar uma plataforma (tickets do MAL e da Steam):

1. `integracoes/<nome>.py` com uma classe que segue `plataforma.Plataforma`:
   `nome`, `rotulo`, `disponivel()` (False sem a chave no ambiente), `conectar(identificador)
   -> Conta` e `ler(conta) -> list[ItemDeOrigem]`. Erros: `PerfilPrivado`,
   `PerfilNaoEncontrado`, `OrigemIndisponivel`, `PlataformaIndisponivel` (a rota traduz).
2. Cada `ItemDeOrigem` sai normalizado: `status` pelo `mapeamento.estado_da_origem`, `nota`
   por `mapeamento.nota_anilist`/`nota_mal`; jogos com `horas` e `jogado_em`. `catalogo`
   (`RefCatalogo(fonte, id_fonte, dados)`) diz como achar a Mídia: `anilist` + id do AniList
   (o MAL casa pelo `idMal` e entrega a obra do AniList em `dados`), `rawg` + slug. Sem
   `catalogo`, o item vai para "Não encontrados" (sem palpite).
3. Registrar em `servico.PLATAFORMAS`. As rotas genéricas já servem:
   `GET /api/integracoes`, `PUT|DELETE /api/integracoes/<nome>`,
   `POST /api/integracoes/<nome>/previa`, `POST /api/integracoes/previas/<id>/confirmar`.

Peças reaproveitáveis:
- `aplicar.aplicar(item, origem, total=, hoje=)`: regras da Q110/Q111, pura.
- `servico.previa_de_itens(id_usuario, nome, itens)`: prévia de itens já lidos (o XML do MAL).
- `servico.aplicar_casados(id_usuario, casados, nao_encontrados)`: grava sem prévia (Steam, Vincular).
- `catalogo.IMPORTADORES`: (fonte, Tipo) -> gravação da obra sob demanda (some `rawg`).
- `casamento.casar(plataforma, itens, fonte)`: a Mídia de cada item, a fonte da plataforma
  primeiro e o vínculo de um Usuário (Vincular) como reserva; a prévia, o confirmar e a
  sincronização da Steam passam por ele, cada um com a sua fonte.
"""
