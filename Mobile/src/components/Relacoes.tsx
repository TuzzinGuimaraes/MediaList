// Relações da Mídia (spec `relacoes`): o carrossel depois da Sinopse, com o "e mais N" dos jogos,
// e o destaque da Sequência no anime ou mangá Concluído. Nomes, ordem, corte dos jogos, sugestão
// e link da fonte vêm de `dominio/relacoes`.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { useRelacoes } from '../api/midias';
import type { RelacaoDaMidia, TipoMidia } from '../api/tipos';
import { estadoDe, nomeDoTipo } from '@dominio/estadoConsumo';
import {
  carrosselDeRelacoes,
  descricaoDaRelacao,
  LIMITE_DE_JOGOS,
  linkDaFonte,
  nomeDaRelacao,
  ordenarRelacoes,
  sugestoesDeSequencia,
  TEXTOS_DAS_RELACOES,
} from '@dominio/relacoes';
import { rotaDaMidia } from '../rotas';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import { Fileira, LARGURA_CARD } from './Carrossel';
import { FalhaParcial } from './EstadoTela';
import { PlanejadoOuNaLista } from './PlanejadoOuNaLista';
import { Secao } from './Secao';
import { SeloStatus, SeloTipo } from './Selo';
import { Toque } from './Toque';

const textos = { fechar: 'Fechar' };

/** Largura do cartão na lista completa, duas ou três por linha. */
const LARGURA_NA_LISTA = 100;

type Midia = { id_midia: string; tipo: TipoMidia; data_lancamento: string | null };

function chave(r: RelacaoDaMidia): string {
  return `${r.relacao}-${r.id_midia ?? r.link_fonte ?? r.titulo}`;
}

/** O toque da obra relacionada: o Detalhe dela, o link `https://` da fonte ou nada. */
function useAbrirRelacao(relacao: RelacaoDaMidia): (() => void) | null {
  const router = useRouter();
  if (relacao.id_midia !== null) {
    const id = relacao.id_midia;
    return () => router.push(rotaDaMidia(id));
  }
  const link = linkDaFonte(relacao);
  return link ? () => void Linking.openURL(link).catch(() => {}) : null;
}

/** Link (interno ou externo) com a descrição para o leitor de tela; sem destino, só o bloco. */
function TocavelDaRelacao({
  relacao,
  caixa,
  className,
  children,
}: {
  relacao: RelacaoDaMidia;
  caixa?: { width: number } | { flex: number };
  className: string;
  children: React.ReactNode;
}) {
  const abrir = useAbrirRelacao(relacao);
  const rotulo = descricaoDaRelacao(relacao);
  return abrir ? (
    <Toque accessibilityRole="link" accessibilityLabel={rotulo} onPress={abrir} caixa={caixa} className={className}>
      {children}
    </Toque>
  ) : (
    <View accessible accessibilityLabel={rotulo} style={caixa} className={className}>
      {children}
    </View>
  );
}

function Poster({ relacao }: { relacao: RelacaoDaMidia }) {
  return relacao.poster_url ? (
    <Image
      source={relacao.poster_url}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
      recyclingKey={chave(relacao)}
      accessibilityIgnoresInvertColors
    />
  ) : null;
}

/** Card A da obra relacionada: o Status sobre o pôster; título, Tipo e a Relação abaixo. */
function CartaoDaRelacao({ relacao, largura }: { relacao: RelacaoDaMidia; largura: number }) {
  const estado = estadoDe(relacao.status_consumo, relacao.tipo);
  return (
    <TocavelDaRelacao relacao={relacao} caixa={{ width: largura }} className="gap-1.5">
      <View className="aspect-[2/3] w-full overflow-hidden rounded-md bg-superficie-alta">
        <Poster relacao={relacao} />
        {estado ? (
          <View className="absolute bottom-1.5 left-1 right-1">
            <SeloStatus estado={estado} sobreImagem />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} className="text-legenda text-texto">
        {relacao.titulo}
      </Text>
      <SeloTipo tipo={relacao.tipo} />
      <Text numberOfLines={1} className="text-legenda font-semibold text-texto-suave">
        {nomeDaRelacao(relacao)}
      </Text>
    </TocavelDaRelacao>
  );
}

/** A seção "Relações"; some sem nenhuma. Nos jogos de série grande, o "e mais N" abre a lista completa. */
export function SecaoRelacoes({ midia }: { midia: Midia }) {
  const relacoes = useRelacoes(midia.id_midia);
  const [todas, setTodas] = useState(false);
  if (relacoes.isError && !relacoes.data) {
    return (
      <Secao titulo={TEXTOS_DAS_RELACOES.secao}>
        <FalhaParcial erro={relacoes.error} tentarDeNovo={() => relacoes.refetch()} />
      </Secao>
    );
  }
  const lista = relacoes.data ?? [];
  const { cartoes, mais } = carrosselDeRelacoes(lista, midia);
  const acao =
    mais > 0 ? (
      <Pressable accessibilityRole="button" onPress={() => setTodas(true)} hitSlop={8} className="min-h-[36px] justify-center">
        <Text className="text-corpo font-semibold text-marca-texto">{TEXTOS_DAS_RELACOES.mais(mais)}</Text>
      </Pressable>
    ) : null;
  return (
    <>
      <Fileira
        titulo={TEXTOS_DAS_RELACOES.secao}
        itens={cartoes}
        chave={chave}
        renderizar={(r) => <CartaoDaRelacao relacao={r} largura={LARGURA_CARD} />}
        acao={acao}
        inicial={LIMITE_DE_JOGOS}
        className="-mx-4"
      />
      {todas ? (
        <BottomSheet
          rotulo={TEXTOS_DAS_RELACOES.listaCompleta}
          aoFechar={() => setTodas(false)}
          cabecalho={
            <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
              {TEXTOS_DAS_RELACOES.listaCompleta}
            </Text>
          }
          rodape={<Botao titulo={textos.fechar} variante="secundario" onPress={() => setTodas(false)} />}
        >
          <View className="flex-row flex-wrap gap-3">
            {ordenarRelacoes(lista).map((r) => (
              <CartaoDaRelacao key={chave(r)} relacao={r} largura={LARGURA_NA_LISTA} />
            ))}
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}

/** O destaque do anime ou mangá Concluído: cada Sequência fora da Lista, com "Planejado" se está no Catálogo. */
export function SugestaoDeSequencia({ midia, item }: { midia: Midia; item: { status_consumo: string } | null | undefined }) {
  const relacoes = useRelacoes(midia.id_midia);
  const sugestoes = sugestoesDeSequencia(midia, item, relacoes.data ?? []);
  if (!sugestoes.length) return null;
  return (
    <View accessibilityLabel={TEXTOS_DAS_RELACOES.sugestao} className="gap-3 rounded-md border border-marca bg-superficie p-4">
      <Text accessibilityRole="header" className="text-corpo font-bold text-texto-forte">
        {TEXTOS_DAS_RELACOES.sugestao}
      </Text>
      {sugestoes.map(({ relacao, planejavel }) => (
        <View key={chave(relacao)} className="flex-row items-center gap-3">
          <TocavelDaRelacao relacao={relacao} caixa={{ flex: 1 }} className="flex-row items-center gap-3">
            <View className="h-[60px] w-10 overflow-hidden rounded bg-superficie-alta">
              <Poster relacao={relacao} />
            </View>
            <View className="flex-1">
              <Text numberOfLines={2} className="text-corpo font-semibold text-texto-forte">
                {relacao.titulo}
              </Text>
              <Text className="text-legenda text-texto-suave">
                {nomeDaRelacao(relacao)} · {nomeDoTipo(relacao.tipo)}
              </Text>
            </View>
          </TocavelDaRelacao>
          {planejavel && relacao.id_midia !== null ? (
            <PlanejadoOuNaLista idMidia={relacao.id_midia} tipo={relacao.tipo} titulo={relacao.titulo} naLista={false} />
          ) : null}
        </View>
      ))}
    </View>
  );
}
