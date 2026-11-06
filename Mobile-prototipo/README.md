# ⚠️ PROTÓTIPO DESCARTÁVEL: MediaList Mobile (ticket 01)

1. `npm install` (só na primeira vez), depois `npx expo start` nesta pasta.
2. Celular: abra o Expo Go (SDK 58) e escaneie o QR do terminal (mesma rede Wi-Fi).
3. Navegador: com o servidor rodando, aperte `w`.

Não é código de produção: dados simulados em memória, sem backend, sem testes. Vive só na branch
`artur/mobile-v1-prototipo` e não entra na integração. Expo SDK 58, TypeScript, Expo Router.

## Perguntas que responde

- **(a) Navegação** (uma variação): 5 abas, seletor de Recorte de catálogo no topo de Início,
  Explorar e Lista, tocar num card abre o detalhe da Mídia empilhado, voltar retorna.
- **(b) Lista e editor** (variações): na aba **Lista**, a barra flutuante amarela/branca no rodapé
  alterna com ◀ ▶ três dimensões independentes:
  - `Lista`: `secoes` (seções recolhíveis por Estado de consumo) / `abas` (uma aba por Estado);
  - `Editor`: `sheet` (bottom sheet, Modal nativo) / `tela` (tela cheia empilhada);
  - `+1`: `botao` (botão +1 no card) / `stepper` (− / +) / `gesto` (deslizar o card para a direita).

  O painel "PROTÓTIPO" acima da barra mostra o Item atual (Estado, Rótulo, Progresso, nota) e a
  última ação. Toque no título do Item para abrir o editor; toque no pôster para o detalhe.

## Regras simuladas (CONTEXT.md)

- +1 nunca passa do total; atingir o total leva a Concluído. Total desconhecido (One Piece,
  Chainsaw Man) não limita.
- Jogo não tem Progresso: mostra horas, sem +1; horas não levam a Concluído.
- O editor só oferece Rótulos de estado válidos para o Tipo (`platinado` só em jogo).
- Platinado conta como Concluído (aparece na seção/aba Concluído, com 🏆).

A barra só aparece em desenvolvimento (`__DEV__`).
