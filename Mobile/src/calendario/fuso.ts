/** O fuso do aparelho (IANA, ex. "America/Sao_Paulo"), que o Calendário usa para os dias e as horas. */
export function fusoDoAparelho(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
