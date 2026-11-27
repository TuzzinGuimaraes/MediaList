import { Pressable, Text, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { useMudarProgresso } from '../api/lista';
import type { ItemLista } from '../api/tipos';
import { destaqueDoItem, paraAssistirAgora } from '@dominio/assistirAgora';
import { passoDeProgresso } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';
import { CardInfo } from './CardMidia';
import { Fileira } from './Carrossel';

const textos = {
  faixa: 'Para assistir agora',
  maisUm: (titulo: string) => `Mais um em ${titulo}`,
};

const LARGURA_CARTAO = 290;

/** +1 no Progresso, pela mesma escrita otimista do stepper da Lista. */
function MaisUm({ item, mudar }: { item: ItemLista; mudar(item: ItemLista): void }) {
  const desabilitado = passoDeProgresso(item, 1) === null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={textos.maisUm(tituloDaMidia(item))}
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={() => mudar(item)}
      hitSlop={8}
      className="min-h-9 items-center justify-center rounded-full bg-marca px-4 active:bg-marca-forte"
    >
      <Text className="text-corpo font-bold text-sobre-marca">+1</Text>
    </Pressable>
  );
}

function useMaisUm() {
  const progresso = useMudarProgresso();
  const mudar = (item: ItemLista) => progresso.mutate({ idLista: item.id_lista, idMidia: item.id_midia, passo: 1 });
  const falha = progresso.isError ? (
    <Text accessibilityRole="alert" className="text-corpo text-erro">
      {mensagemDeErro(progresso.error)}
    </Text>
  ) : null;
  return { mudar, falha };
}

/**
 * A faixa "Para assistir agora" do Início: os animes em exibição Em progresso, os atrasados
 * primeiro, com +1 nos atrasados. Sem nenhum, não aparece.
 */
export function FaixaAssistirAgora({ itens }: { itens: ItemLista[] }) {
  const { mudar, falha } = useMaisUm();
  const cartoes = paraAssistirAgora(itens, new Date());
  if (!cartoes.length) return null;
  return (
    <View className="gap-2">
      <Fileira
        titulo={textos.faixa}
        itens={cartoes}
        chave={(c) => c.item.id_lista}
        renderizar={({ item, atrasado, texto, proximo }) => (
          <View className="gap-2" style={{ width: LARGURA_CARTAO }}>
            <CardInfo midia={item} largura={LARGURA_CARTAO} />
            <View className="min-h-9 flex-row items-center justify-between gap-3 px-1">
              {/* O atraso em cima e o "próximo em" numa linha dele; com fonte grande ela quebra,
                  sem reticências. */}
              <View className="flex-1">
                <Text className={`text-legenda font-semibold ${atrasado ? 'text-marca-texto' : 'text-texto-suave'}`}>
                  {texto}
                </Text>
                {proximo ? (
                  <Text className="text-legenda font-semibold text-texto-suave">
                    {proximo}
                  </Text>
                ) : null}
              </View>
              {atrasado ? <MaisUm item={item} mudar={mudar} /> : null}
            </View>
          </View>
        )}
      />
      {falha ? <View className="px-4">{falha}</View> : null}
    </View>
  );
}

/** O destaque do Detalhe ("Você parou no ep. 5; saiu o 7") com +1; só no anime atrasado. */
export function DestaqueDoEpisodio({ item }: { item: ItemLista | null | undefined }) {
  const { mudar, falha } = useMaisUm();
  const destaque = destaqueDoItem(item);
  if (!item || !destaque) return falha;
  return (
    <View className="gap-2 rounded-md border border-marca bg-superficie p-4">
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-corpo font-semibold text-texto-forte">{destaque.texto}</Text>
        <MaisUm item={item} mudar={mudar} />
      </View>
      {falha}
    </View>
  );
}
