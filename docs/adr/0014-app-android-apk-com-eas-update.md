# App só para Android, como APK do EAS Build, atualizado por EAS Update

Emenda o ADR-0005 (que previa Android e iOS, sem EAS e sem publicação).

O app (ADR-0005) é distribuído só para Android, como um APK gerado pelo EAS Build na nuvem da Expo e anexado a um GitHub Release (`app-v<version>`). Não há Play Store nem App Store. No iPhone, o MediaList é usado pelo web.

O pacote é `dev.medialist.app` e a chave de assinatura é gerada e guardada pelo EAS, com uma cópia fora da Expo. Os dois são permanentes: trocar qualquer um faz o Android recusar o APK novo como atualização.

As mudanças de JS e assets chegam por **EAS Update** no canal `production`, publicadas pelo workflow `deploy` depois da API, para o app novo nunca chamar uma rota que ainda não existe. O `runtimeVersion` segue o `version` do `app.json`, que só sobe quando muda algo nativo, junto com um APK novo; assim um update nunca cai num APK incompatível. O `versionCode` é do EAS (`appVersionSource: remote`). O update é baixado ao abrir e aplicado na próxima abertura, ou na hora pelo botão "Atualizar agora" do Perfil.

## Considered Options

- **Play Store:** taxa de US$ 25 e revisão a cada versão, para um projeto de hobby.
- **App Store / iOS:** exige a conta Apple Developer (US$ 99 por ano) até para instalar fora do Expo Go.
- **Só APK, sem OTA:** cada correção exigiria baixar e instalar um APK à mão.
- **Build local:** exigiria o Android SDK no WSL; o plano grátis do EAS cobre a frequência de APKs novos.
- **Aplicar o update na hora, ao abrir:** recarrega a tela no meio do uso ou deixa a abertura mais lenta.

## Consequences

- O plano grátis do EAS limita builds por mês (fila de baixa prioridade) e o EAS Update a 1.000 usuários ativos por mês.
- Os artefatos do Release são públicos, o que é aceitável: o APK só contém a URL pública da API.
- Perder a chave de assinatura e a cópia obriga todos a desinstalar e reinstalar o app.
