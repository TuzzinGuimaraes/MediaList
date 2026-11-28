// Fábrica das chaves do TanStack Query: toda tela pede a chave aqui, para que cache e
// invalidação falem do mesmo dado.
//
// Tudo que mostra a Nota média ou o Total de avaliações de uma Mídia (Início, Explorar, o
// detalhe, as Sugestões) fica sob ['midias']: uma Avaliação gravada invalida esse
// prefixo e alcança todos. O que não muda com Avaliação nem com a Lista (Gêneros, facetas)
// fica sob ['catalogo'].
import type { OrdemCarrossel } from '@dominio/carrossel';
import type { TipoMidia } from '@dominio/estadoConsumo';
import type { Recorte } from '@dominio/recorte';

export const chaves = {
  midias: {
    /** Prefixo de tudo que mostra Mídias com nota. */
    todas: ['midias'] as const,
    emAlta: (recorte: Recorte, limite: number) => ['midias', 'em-alta', recorte, limite] as const,
    populares: (recorte: Recorte) => ['midias', 'populares', recorte] as const,
    carrossel: (recorte: Recorte, ordem: OrdemCarrossel, genero: string | null) =>
      ['midias', 'carrossel', recorte, ordem, genero] as const,
    explorar: (consulta: object) => ['midias', 'explorar', consulta] as const,
    /** A Temporada inteira, numa ordem (todas as páginas de GET /midias). */
    temporada: (estacao: string, ano: number, ordem: string) => ['midias', 'temporada', estacao, ano, ordem] as const,
    /** Os episódios do Calendário numa janela (GET /midias/calendario). */
    calendario: (de: string, ate: string) => ['midias', 'calendario', de, ate] as const,
    /** Prefixo das Sugestões (GET /sugestoes): toda escrita da Lista as refaz. */
    todasAsSugestoes: ['midias', 'sugestoes'] as const,
    /** As Sugestões de uma consulta (`consultaDasSugestoes`: sem `tipo` ou com um). */
    sugestoes: (tipo: string | null) => ['midias', 'sugestoes', tipo] as const,
    /** O detalhe; prefixo também da atividade. */
    detalhe: (id: string) => ['midias', id] as const,
    atividade: (id: string) => ['midias', id, 'atividade'] as const,
  },
  catalogo: {
    generos: (tipo: TipoMidia) => ['catalogo', 'generos', tipo] as const,
    facetas: (tipo: TipoMidia) => ['catalogo', 'facetas', tipo] as const,
  },
  avaliacoes: {
    /** A 1ª página das Avaliações de uma Mídia; prefixo também das notas. */
    daMidia: (id: string) => ['avaliacoes', id] as const,
    notas: (id: string) => ['avaliacoes', id, 'notas'] as const,
  },
  lista: {
    /** O RespostaLista inteiro: Lista, Início, detalhe e Perfil leem esta chave. */
    toda: ['lista'] as const,
  },
  /** As Relações de uma Mídia (GET /midias/<id>/relacoes): trazem o Status da Lista em cada obra. */
  relacoes: {
    todas: ['relacoes'] as const,
    daMidia: (id: string) => ['relacoes', id] as const,
  },
  usuario: {
    perfil: ['usuario', 'perfil'] as const,
    estatisticas: ['usuario', 'estatisticas'] as const,
  },
  notificacoes: ['notificacoes'] as const,
  /** GET /integracoes: as plataformas e as contas conectadas. */
  integracoes: ['integracoes'] as const,
  noticias: {
    todas: ['noticias'] as const,
    pagina: (pagina: number) => ['noticias', pagina] as const,
    /** Uma Notícia, aberta pelo link da Notificação. */
    uma: (id: string) => ['noticias', 'uma', id] as const,
  },
  moderacao: {
    usuarios: ['moderacao', 'usuarios'] as const,
    usuariosDaPagina: (pagina: number) => ['moderacao', 'usuarios', pagina] as const,
    avaliacoes: ['moderacao', 'avaliacoes'] as const,
    vinculos: ['moderacao', 'vinculos'] as const,
    vinculosDaPagina: (pagina: number) => ['moderacao', 'vinculos', pagina] as const,
  },
};
