#!/usr/bin/env bash
# Sobe o Metro (Expo) para o Expo Go no celular. Chamado por `make mobile-dev`.
#
# No WSL2 em modo NAT o celular só alcança o Windows, que encaminha 8081 (Metro) e
# 5000 (API) para o WSL via `netsh interface portproxy` (script do usuário, rodado
# como administrador). Aqui só lemos o estado: descobrimos o IP do Windows na rede,
# avisamos se o portproxy aponta para outro IP do WSL e subimos o Expo anunciando o
# IP do Windows, na porta 8081 fixa (é a que o portproxy encaminha).
#
# Fora do WSL, é um `expo start` simples.
#
# Uso: scripts/dev.sh [--dry-run] [args extras do expo start]
#   --dry-run  faz as verificações e mostra o comando, sem subir o Expo.
set -euo pipefail

PORTA_METRO=8081
PORTA_API=5000

simular=0
args=()
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then simular=1; else args+=("$arg"); fi
done

aviso() { printf 'AVISO: %s\n' "$*" >&2; }
erro() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

# Mostra o comando e o executa, ou só mostra em --dry-run.
rodar() {
  printf '+ %s\n' "$*"
  if [ "$simular" -eq 1 ]; then exit 0; fi
  exec "$@"
}

em_wsl() {
  grep -qi microsoft /proc/version 2>/dev/null && command -v powershell.exe >/dev/null 2>&1
}

porta_ocupada() {
  if command -v ss >/dev/null 2>&1; then
    [ -n "$(ss -ltnH "sport = :$1")" ]
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

# PowerShell sem perfil; a saída vem em CRLF.
powershell() {
  timeout 30 powershell.exe -NoProfile -NonInteractive -Command "$1" 2>/dev/null | tr -d '\r'
}

if ! em_wsl; then
  rodar npx expo start "${args[@]}"
fi

if porta_ocupada "$PORTA_METRO"; then
  erro "a porta $PORTA_METRO já está em uso no WSL (outro Metro aberto?). Feche-o: o portproxy só encaminha a $PORTA_METRO."
fi

ip_wsl=$(hostname -I | awk '{print $1}')
[ -n "$ip_wsl" ] || erro "não consegui obter o IP do WSL (hostname -I)."

# Mesmo critério do script de portproxy: a interface com gateway padrão.
ip_windows=$(powershell '(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1).IPv4Address.IPAddress' | head -n1 || true)
[[ "$ip_windows" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || erro "não consegui descobrir o IP do Windows na rede via powershell.exe."

# Linhas de dados do `show v4tov4`: <escuta> <porta> <destino> <porta>. O cabeçalho
# vem traduzido, então filtramos pelo formato, não pelo texto.
proxies=$(powershell 'netsh interface portproxy show v4tov4' | awk 'NF == 4 && $2 ~ /^[0-9]+$/ { print $2, $3 }' || true)
precisa_portproxy=0
for porta in "$PORTA_METRO" "$PORTA_API"; do
  destino=$(awk -v p="$porta" '$1 == p { print $2; exit }' <<<"$proxies")
  if [ -z "$destino" ]; then
    aviso "o Windows não encaminha a porta $porta (portproxy ausente)."
    precisa_portproxy=1
  elif [ "$destino" != "$ip_wsl" ]; then
    aviso "o portproxy da porta $porta aponta para $destino, mas o IP atual do WSL é $ip_wsl."
    precisa_portproxy=1
  fi
done
if [ "$precisa_portproxy" -eq 1 ]; then
  aviso 'o celular não vai alcançar o Metro/API. Num PowerShell como administrador, rode:'
  aviso '  powershell -ExecutionPolicy Bypass -File C:\Users\user\expo-portproxy.ps1'
fi

printf 'WSL %s, Windows %s: o Expo Go conecta em %s:%s.\n' "$ip_wsl" "$ip_windows" "$ip_windows" "$PORTA_METRO"
rodar env REACT_NATIVE_PACKAGER_HOSTNAME="$ip_windows" npx expo start --lan --port "$PORTA_METRO" "${args[@]}"
