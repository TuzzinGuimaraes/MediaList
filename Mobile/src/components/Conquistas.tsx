// Conquistas da Steam no Detalhe do jogo (spec `conquistas-steam`, ticket 02): o "34/50 conquistas"
// abre a tela da lista (app/conquistas/[id].tsx); com 100% fora de Platinado, o destaque "Você tem
// todas as conquistas" com "Marcar Platinado", que grava pela escrita do Item (nunca automático, ADR 0015).
// Na lista, cada obtida tem "Destacar no Perfil" / "Tirar do Perfil" (ticket 03).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { chaveDasConquistasDoItem, useMudarDestaque } from '../api/conquistas';
import { mensagemDeErro } from '../api/erros';
import { useSalvarItem } from '../api/lista';
import type { ConquistaDoItem, ItemLista } from '../api/tipos';
import { useCores } from '../tema/TemaContext';
import {
  descricaoAcessivel,
  eLimiteDeDestaques,
  eRara,
  nomeDaConquista,
  sugereMarcarPlatinado,
  TEXTOS_DAS_CONQUISTAS,
  textoDaObtencao,
  textoDaRaridade,
  textoDoResumo,
} from '@dominio/conquistas';
import { rotuloPara } from '@dominio/estadoConsumo';
import { mudancaDeStatus } from '@dominio/itemLista';
import { Botao } from './Botao';
import { Selo } from './Selo';
import { Toque } from './Toque';

/** O "34/50 conquistas" do Detalhe, que abre a tela da lista; nada no jogo sem dado. */
export function ResumoDasConquistas({ item }: { item: ItemLista | null | undefined }) {
  const cores = useCores();
  const router = useRouter();
  const texto = textoDoResumo(item?.conquistas);
  if (!item || !texto) return null;
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={() => router.push({ pathname: '/conquistas/[id]', params: { id: item.id_midia } })}
      className="min-h-11 flex-row items-center justify-between gap-3 rounded-md bg-superficie px-4 py-3"
    >
      <Text className="text-corpo font-semibold text-texto-forte">{texto}</Text>
      <Ionicons name="chevron-forward" size={18} color={cores['texto-suave']} />
    </Toque>
  );
}

/** "Você tem todas as conquistas" com "Marcar Platinado", junto do bloco do Item. */
export function DestaqueDePlatinado({ item }: { item: ItemLista | null | undefined }) {
  const queryClient = useQueryClient();
  const salvar = useSalvarItem();
  const platinado = rotuloPara('platinado', 'jogo');
  const falha = salvar.isError ? (
    <Text accessibilityRole="alert" className="text-corpo text-erro">
      {mensagemDeErro(salvar.error)}
    </Text>
  ) : null;
  if (!item || !platinado || !sugereMarcarPlatinado(item)) return falha;
  const marcar = () =>
    salvar.mutate(
      { idMidia: item.id_midia, idLista: item.id_lista, dados: mudancaDeStatus(item, platinado) },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveDasConquistasDoItem(item.id_lista) }) },
    );
  return (
    <View accessibilityLabel={TEXTOS_DAS_CONQUISTAS.todas} className="gap-3 rounded-md border border-marca bg-superficie p-4">
      <Text accessibilityRole="header" className="text-corpo font-bold text-texto-forte">
        {TEXTOS_DAS_CONQUISTAS.todas}
      </Text>
      <Botao titulo={TEXTOS_DAS_CONQUISTAS.marcarPlatinado} onPress={marcar} carregando={salvar.isPending} />
      {falha}
    </View>
  );
}

/** "Destacar no Perfil" / "Tirar do Perfil" na obtida, com o aviso quando o Perfil já tem os 6. */
export function BotaoDeDestaque({ idLista, conquista }: { idLista: string; conquista: ConquistaDoItem }) {
  const destaque = useMudarDestaque(idLista);
  const falha = destaque.isError
    ? eLimiteDeDestaques(destaque.error)
      ? TEXTOS_DAS_CONQUISTAS.limiteDeDestaques
      : mensagemDeErro(destaque.error)
    : null;
  return (
    <View className="max-w-[45%] items-end gap-1">
      <Botao
        titulo={conquista.destacada ? TEXTOS_DAS_CONQUISTAS.tirar : TEXTOS_DAS_CONQUISTAS.destacar}
        variante="secundario"
        carregando={destaque.isPending}
        onPress={() => destaque.mutate({ conquista, destacar: !conquista.destacada })}
      />
      {falha ? (
        <Text accessibilityRole="alert" className="text-right text-legenda text-erro">
          {falha}
        </Text>
      ) : null}
    </View>
  );
}

/** Uma conquista: ícone, nome, descrição, data e raridade. `acao` é o lugar do botão da linha (o destaque no Perfil). */
export function LinhaDaConquista({ conquista, jogo, acao }: { conquista: ConquistaDoItem; jogo: string; acao?: ReactNode }) {
  const obtencao = textoDaObtencao(conquista);
  const raridade = textoDaRaridade(conquista.raridade);
  return (
    <View className="flex-row items-start gap-3 py-3">
      <View accessible accessibilityLabel={descricaoAcessivel(conquista, jogo)} className="flex-1 flex-row items-start gap-3">
        <View className="h-12 w-12 overflow-hidden rounded bg-superficie-alta">
          {conquista.icone ? (
            <Image
              source={conquista.icone}
              style={{ width: '100%', height: '100%', opacity: conquista.obtida ? 1 : 0.6 }}
              contentFit="cover"
              cachePolicy="disk"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className={`text-corpo font-semibold ${conquista.obtida ? 'text-texto-forte' : 'text-texto-suave'}`}>
              {nomeDaConquista(conquista)}
            </Text>
            {eRara(conquista.raridade) ? <Selo texto={TEXTOS_DAS_CONQUISTAS.rara} tom="marca" /> : null}
          </View>
          {conquista.descricao ? <Text className="text-corpo text-texto">{conquista.descricao}</Text> : null}
          <View className="flex-row flex-wrap gap-x-3">
            {obtencao ? <Text className="text-legenda text-texto-suave">{obtencao}</Text> : null}
            {raridade ? <Text className="text-legenda text-texto-suave">{raridade}</Text> : null}
          </View>
        </View>
      </View>
      {acao}
    </View>
  );
}
