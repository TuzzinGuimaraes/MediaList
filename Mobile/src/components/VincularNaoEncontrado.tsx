// Vincular um Não encontrado (Q115/Q116), espelho do web: a busca do Catálogo no Tipo do item;
// escolher a Mídia grava o vínculo para todos e já leva o Item para a Lista.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { nomeDoTipo, type TipoMidia } from '@dominio/estadoConsumo';
import { type NomePlataforma, tituloDoVincular } from '@dominio/integracoes';
import { tituloDaMidia } from '@dominio/midia';
import { mensagemDeErro } from '../api/erros';
import { useBuscaDoVincular, useVincular } from '../api/integracoes';
import type { NaoEncontrado } from '../api/tipos';
import { vibrarConfirmacao } from '../tema/haptics';
import { useCores } from '../tema/TemaContext';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import { Campo } from './Campo';

const ATRASO_BUSCA_MS = 300;
/** Como no Explorar: um caractere só casaria quase tudo. */
const MINIMO_BUSCA = 2;

const textos = {
  busca: 'Buscar no Catálogo',
  explicacao: (tipo: TipoMidia) =>
    `Busque a obra no Catálogo (Tipo ${nomeDoTipo(tipo)}). O vínculo vale para todos e o Item já entra na sua Lista.`,
  nada: 'Nada no Catálogo com esse título.',
  cancelar: 'Cancelar',
};

function useTermo(texto: string): string {
  const [termo, setTermo] = useState('');
  useEffect(() => {
    const espera = setTimeout(() => setTermo(texto.trim()), ATRASO_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [texto]);
  return termo.length >= MINIMO_BUSCA ? termo : '';
}

type Props = {
  plataforma: NomePlataforma;
  item: NaoEncontrado & { origem_id: string; tipo: TipoMidia };
  aoFechar(): void;
  aoVincular(): void;
};

export function VincularNaoEncontrado({ plataforma, item, aoFechar, aoVincular }: Props) {
  const cores = useCores();
  const [texto, setTexto] = useState('');
  const termo = useTermo(texto);
  const busca = useBuscaDoVincular(item.tipo, termo);
  const vincular = useVincular(plataforma);
  const titulo = tituloDoVincular(item);
  const fechar = () => {
    if (!vincular.isPending) aoFechar();
  };
  const escolher = (id_midia: string) =>
    vincular.mutate(
      { origem_id: item.origem_id, id_midia },
      {
        onSuccess: () => {
          vibrarConfirmacao();
          aoVincular();
        },
      },
    );
  const midias = termo ? (busca.data ?? []) : [];

  return (
    <BottomSheet
      rotulo={titulo}
      aoFechar={fechar}
      cabecalho={
        <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
          {titulo}
        </Text>
      }
      rodape={<Botao titulo={textos.cancelar} variante="secundario" onPress={fechar} />}
    >
      <Text className="text-corpo text-texto-suave">{textos.explicacao(item.tipo)}</Text>
      <Campo
        rotulo={textos.busca}
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {vincular.isError ? (
        <Text accessibilityRole="alert" className="text-legenda text-erro">
          {mensagemDeErro(vincular.error)}
        </Text>
      ) : null}
      {busca.isError ? (
        <Text accessibilityRole="alert" className="text-legenda text-erro">
          {mensagemDeErro(busca.error)}
        </Text>
      ) : termo && busca.isFetching && !busca.data ? (
        <ActivityIndicator color={cores['marca-texto']} accessibilityLabel="Buscando" />
      ) : termo && busca.data && !midias.length ? (
        <Text className="text-corpo text-texto-suave">{textos.nada}</Text>
      ) : null}
      <View className="gap-2">
        {midias.map((m) => {
          const nome = tituloDaMidia(m);
          const ano = m.data_lancamento?.slice(0, 4);
          const esta = vincular.isPending && vincular.variables?.id_midia === m.id_midia;
          return (
            <Pressable
              key={m.id_midia}
              accessibilityRole="button"
              accessibilityLabel={`Vincular a ${nome}`}
              accessibilityState={{ disabled: vincular.isPending, busy: esta }}
              disabled={vincular.isPending}
              onPress={() => escolher(m.id_midia)}
              className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-md bg-superficie-alta px-4 py-3"
            >
              <Text className="flex-1 text-corpo text-texto-forte">
                {nome}
                {ano ? <Text className="text-texto-suave">{` · ${ano}`}</Text> : null}
              </Text>
              {esta ? (
                <ActivityIndicator color={cores['marca-texto']} />
              ) : (
                <Text className="text-corpo font-semibold text-marca-texto">Escolher</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
