// Uma conquista da Steam na tela (spec `conquistas-steam`), igual no Detalhe do jogo, no seletor de
// destaques e nos destaques do Perfil, e o botão "Destacar no Perfil" / "Tirar do Perfil".
import type { ReactNode } from 'react';

import {
  descricaoAcessivel,
  eLimiteDeDestaques,
  eRara,
  nomeDaConquista,
  TEXTOS_DAS_CONQUISTAS,
  textoDaObtencao,
  textoDaRaridade,
} from '@dominio/conquistas';

import { mensagemDeErro } from '../api/erros';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Selo } from '../componentes/Selo';
import { useMudarDestaque } from './consultas';

/** O que a linha mostra: a conquista do Item (Detalhe e seletor) ou o destaque do Perfil (sempre obtido). */
type Mostrada = Pick<Esquemas['ConquistaDoItem'], 'nome' | 'icone' | 'raridade' | 'obtida' | 'obtida_em'> & {
  descricao?: string | null;
};

/**
 * Uma conquista: ícone, nome, selo Rara, descrição, data e raridade. `acao` é o lugar do botão da linha (o
 * destaque no Perfil); `comJogo` mostra o jogo também na tela (o seletor e o Perfil misturam jogos);
 * `cartao` é a forma dos destaques do Perfil, em grade.
 */
export function LinhaDaConquista({
  conquista,
  jogo,
  acao,
  comJogo = false,
  cartao = false,
}: {
  conquista: Mostrada;
  jogo: string;
  acao?: ReactNode;
  comJogo?: boolean;
  cartao?: boolean;
}) {
  const obtencao = textoDaObtencao(conquista);
  const raridade = textoDaRaridade(conquista.raridade);
  return (
    <li
      aria-label={descricaoAcessivel(conquista, jogo)}
      className={`flex items-start gap-3 ${cartao ? 'rounded-lg bg-superficie-alta p-3' : 'py-3'}`}
    >
      <span className={`h-12 w-12 shrink-0 overflow-hidden rounded ${cartao ? 'bg-superficie' : 'bg-superficie-alta'}`}>
        {conquista.icone ? (
          <img
            src={conquista.icone}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${conquista.obtida ? '' : 'opacity-60'}`}
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`font-semibold ${conquista.obtida ? 'text-texto-forte' : 'text-texto-suave'}`}>
            {nomeDaConquista(conquista)}
          </span>
          {eRara(conquista.raridade) ? <Selo texto={TEXTOS_DAS_CONQUISTAS.rara} tom="marca" /> : null}
        </span>
        {comJogo ? <span className="truncate text-[13px] text-texto-suave">{jogo}</span> : null}
        {conquista.descricao ? <span className="text-[14px] text-texto">{conquista.descricao}</span> : null}
        <span className="flex flex-wrap gap-x-3 text-[12px] text-texto-suave">
          {obtencao ? <span>{obtencao}</span> : null}
          {raridade ? <span>{raridade}</span> : null}
        </span>
      </span>
      {acao}
    </li>
  );
}

/** "Destacar no Perfil" / "Tirar do Perfil" na obtida, com o aviso quando o Perfil já tem os 6 (Detalhe e seletor). */
export function BotaoDeDestaque({ conquista }: { conquista: Esquemas['ConquistaDoItem'] }) {
  const destaque = useMudarDestaque();
  const falha = destaque.isError
    ? eLimiteDeDestaques(destaque.error)
      ? TEXTOS_DAS_CONQUISTAS.limiteDeDestaques
      : mensagemDeErro(destaque.error)
    : null;
  return (
    <span className="flex max-w-48 shrink-0 flex-col items-end gap-1">
      <Botao
        variante="secundario"
        carregando={destaque.isPending}
        onClick={() => destaque.mutate({ conquista, destacar: !conquista.destacada })}
      >
        {conquista.destacada ? TEXTOS_DAS_CONQUISTAS.tirar : TEXTOS_DAS_CONQUISTAS.destacar}
      </Botao>
      {falha ? (
        <span role="alert" className="text-right text-[12px] text-erro">
          {falha}
        </span>
      ) : null}
    </span>
  );
}
