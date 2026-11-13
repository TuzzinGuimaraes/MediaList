# Concluído segue o Progresso

Substitui a parte "**só promove, nunca rebaixa**" do ADR-0004. Com ela, um Item ficava
**Concluído** com o **Progresso** abaixo do total (61/64, 7/10) depois de o Usuário voltar o
stepper, e a Lista mostrava um estado que o próprio Item desmentia.

Para Tipos com Progresso e total conhecido (anime com `numero_episodios`, mangá com
`numero_capitulos`), vale **Concluído ⇔ Progresso = total**. O autor continua sendo
`Backend/dominio/lista_pessoal.py`, e `Mobile/src/dominio/itemLista.ts` espelha a regra só
para a tela mostrar o resultado antes da resposta:

- Progresso enviado no total leva o Item a Concluído (como antes).
- Progresso enviado abaixo do total tira um Item Concluído para o Rótulo de Em progresso do
  Tipo. A `data_conclusao` fica: ela descreve a passagem mais recente (ADR-0003).
- Escolher Concluído vindo de outro Estado leva o Progresso ao total.
- Entrar em Concluído vindo de outro Estado grava a data de hoje como `data_conclusao`. Se o
  Item já tinha uma `data_conclusao`, é uma nova passagem e soma **+1 na Recontagem**. Data ou
  Recontagem enviadas com valor diferente do guardado são escolha do Usuário e prevalecem;
  o mesmo valor reenviado pelo editor, que manda o formulário inteiro, não conta como escolha.
- Sem total conhecido, ou **Jogo** (horas não medem Progresso, então Platinado e Zerado não
  são afetados), nada muda.

O argumento do ADR-0004 contra rebaixar era não apagar a conclusão registrada. Rebaixar não
a apaga: a data fica, e voltar ao total conta a nova passagem na Recontagem. Preço aceito:
tirar e repor o último episódio no stepper vira uma Recontagem a mais, que o Usuário
corrige no editor.
