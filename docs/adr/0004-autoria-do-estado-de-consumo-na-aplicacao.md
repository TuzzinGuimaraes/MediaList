# O Estado de consumo é escrito pela aplicação, não pelo banco

A regra "**Progresso** atinge o total → **Concluído**" tinha dois autores: a procedure
`atualizar_progresso_midia` a aplicava, e a rota gravava `status_consumo` do payload logo
depois, desfazendo na mesma requisição a decisão que a procedure acabara de tomar. O autor
do **Estado de consumo** passa a ser um só: o módulo `Backend/dominio/lista_pessoal.py`,
que faz uma escrita por requisição. As procedures `adicionar_midia_lista` e
`atualizar_progresso_midia` saíram do `Banco DDL.sql`; nada na aplicação as chamava mais.

É a mesma escolha do ADR-0002 pelo mesmo motivo: a regra depende do **Tipo de mídia**, que
a aplicação conhece, e barrar a escrita errada antes que ela aconteça vale mais do que
espalhar a decisão por procedures que nenhum teste alcança. Os triggers
`validar_progresso_lista` e `validar_progresso_lista_update` **ficam**, como rede de
segurança do banco: eles recusam progresso acima do total venha de onde vier, inclusive de
um cliente que não seja a API.

Três consequências que precisam estar explícitas. O módulo **só promove, nunca rebaixa**:
reduzir o Progresso de um Item concluído não o devolve a em andamento, porque a **Recontagem**
é contada, não historiada (ADR-0003), e rebaixar apagaria a conclusão registrada. O total
contra o qual o Progresso é medido vem da **Mídia** — número de episódios ou de capítulos —,
não do `progresso_total` denormalizado do Item, que deixa de ser gravável pela API por
pertencer à Mídia. E **Jogo** aceita `progresso_atual` (as horas do editor) sem nunca derivar
Concluído dele: horas não medem Progresso.

Preço aceito: o `Banco DDL.sql` não tem mecanismo de migração incremental, então aplicar
esta remoção é manual (`make db-dump` → editar → `make db-schema` → `make db-restore`) até
que exista um. O teste de contrato em `Backend/tests/test_sql_contract.py` afirma que as
procedures saíram e que os triggers continuam.
