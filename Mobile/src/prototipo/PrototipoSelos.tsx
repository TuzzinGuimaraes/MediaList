// PROTÓTIPO (ticket 29), descartável. Selos estilo Netflix sobre o pôster/banner:
// Tipo discreto no canto, "Top 10" (posição em Populares), "Em exibição"/"Em publicação"
// (status de lançamento da Mídia, quando a listagem traz o campo) e o Status do Item
// na Lista do usuário. Tudo vem do cache do TanStack Query, sem rota nova: os selos
// aparecem quando Populares e a Lista já foram carregados (o Início A carrega os dois).
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import type { CartaoMidia, Midia, RespostaLista, RespostaMidias } from '../api/tipos';
import { type EstadoConsumo, estadoDe, NOMES_ESTADO, NOMES_TIPO, type TipoMidia } from '../dominio/estadoConsumo';
import { useRecorte } from '../recorte/RecorteContext';
import { type Paleta, usePaleta } from './PrototipoContext';

type MidiaComStatus = CartaoMidia & Partial<Pick<Midia, 'status_anime' | 'status_manga' | 'status_jogo'>>;

export function corDoEstado(estado: EstadoConsumo, p: Paleta): string {
  return {
    em_progresso: p['status-progresso'],
    concluido: p['status-concluido'],
    pausado: p['status-pausado'],
    abandonado: p['status-abandonado'],
    planejado: p['status-planejado'],
    platinado: p['status-platinado'],
  }[estado];
}

export type Selos = {
  top: number | null;
  lancamento: string | null;
  estado: EstadoConsumo | null;
};

/**
 * Lê o cache sem criar observador: um observador (mesmo desligado) passaria a dona da
 * queryFn da consulta e as invalidações chamariam a dele.
 */
export function useCache<T>(chave: QueryKey): T | undefined {
  const cliente = useQueryClient();
  const hash = JSON.stringify(chave);
  const assinar = useCallback((avisar: () => void) => cliente.getQueryCache().subscribe(avisar), [cliente]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ler = useCallback(() => cliente.getQueryData<T>(chave), [cliente, hash]);
  return useSyncExternalStore(assinar, ler, ler);
}

export function useSelos(midia: MidiaComStatus): Selos {
  const { recorte } = useRecorte();
  const topIds = useCache<RespostaMidias['midias']>(['midias', 'populares', recorte])
    ?.slice(0, 10)
    .map((m) => m.id_midia);
  const rotulo = useCache<RespostaLista>(['lista'])?.lista.find((i) => i.id_midia === midia.id_midia)?.status_consumo;
  const pos = topIds?.indexOf(midia.id_midia) ?? -1;
  const lancamento =
    midia.status_anime === 'em_exibicao' ? 'Em exibição' : midia.status_manga === 'em_publicacao' ? 'Em publicação' : null;
  return {
    top: pos >= 0 ? pos + 1 : null,
    lancamento,
    estado: rotulo ? estadoDe(rotulo, midia.tipo as TipoMidia) : null,
  };
}

/** Selo de Status (Estado de consumo) num tom dessaturado, com ponto. */
export function SeloStatus({ estado, sobreImagem = false }: { estado: EstadoConsumo; sobreImagem?: boolean }) {
  const p = usePaleta();
  const cor = corDoEstado(estado, p);
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-sm px-1.5 py-0.5"
      style={{ backgroundColor: sobreImagem ? 'rgba(0,0,0,0.72)' : `${cor}22`, borderWidth: 1, borderColor: `${cor}88` }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cor }} />
      <Text maxFontSizeMultiplier={1.2} className="text-[12px] font-semibold" style={{ color: sobreImagem ? '#F2F2F2' : cor }}>
        {NOMES_ESTADO[estado]}
      </Text>
    </View>
  );
}

/** Faixa "TOP 10" no canto, como a da Netflix. */
export function SeloTop({ posicao }: { posicao: number }) {
  return (
    <View accessibilityLabel={`Top 10, número ${posicao}`} className="items-center rounded-bl-md bg-marca px-1.5 py-0.5">
      <Text className="text-[9px] font-bold leading-[11px] text-sobre-marca">TOP</Text>
      <Text className="text-[14px] font-bold leading-[16px] text-sobre-marca">{posicao}</Text>
    </View>
  );
}

/**
 * Os selos posicionados sobre o pôster (o pai precisa de overflow-hidden).
 * `tipo`: mostra o Tipo discreto no canto (os cards que já mostram o SeloTipo passam false).
 */
export function SelosSobrePoster({ midia, tipo = true, status = true }: { midia: MidiaComStatus; tipo?: boolean; status?: boolean }) {
  const s = useSelos(midia);
  return (
    <>
      {tipo ? (
        <View className="absolute left-1 top-1 rounded-sm px-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <Text maxFontSizeMultiplier={1.2} className="text-[11px] font-semibold" style={{ color: '#E6E6E6' }}>
            {NOMES_TIPO[midia.tipo as TipoMidia] ?? midia.tipo}
          </Text>
        </View>
      ) : null}
      {s.top ? (
        <View className="absolute right-0 top-0">
          <SeloTop posicao={s.top} />
        </View>
      ) : null}
      {s.lancamento || (status && s.estado) ? (
        <View className="absolute bottom-1 left-1 right-1 gap-1">
          {s.lancamento ? (
            <View className="self-start rounded-sm bg-marca px-1.5 py-0.5">
              <Text maxFontSizeMultiplier={1.2} className="text-[11px] font-bold text-sobre-marca">
                {s.lancamento}
              </Text>
            </View>
          ) : null}
          {status && s.estado ? <SeloStatus estado={s.estado} sobreImagem /> : null}
        </View>
      ) : null}
    </>
  );
}
