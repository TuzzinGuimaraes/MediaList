import { fireEvent, screen } from 'expo-router/testing-library';

/** A pílula do Recorte de catálogo no cabeçalho da aba visível. */
export const pilulaRecorte = (nome?: string) =>
  screen.findByRole('button', { name: nome ? `Recorte de catálogo: ${nome}` : /^Recorte de catálogo:/ });

/** Abre o menu da pílula e escolhe a opção pelo nome. */
export async function trocarRecorte(nome: 'Anime & Mangá' | 'Jogos') {
  await fireEvent.press(await pilulaRecorte());
  await fireEvent.press(await screen.findByRole('menuitem', { name: nome }));
}
