import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';

import { useApagarAvaliacao } from '../api/avaliacoes';
import { mensagemDeErro } from '../api/erros';
import type { Avaliacao } from '../api/tipos';
import { formatarData } from '../dominio/datas';
import { useCores } from '../tema/TemaContext';
import { Botao } from './Botao';
import { FormularioAvaliacao } from './FormularioAvaliacao';
import { TituloSecao } from './Secao';

const textos = {
  titulo: 'Avaliações',
  nenhuma: 'Nenhuma Avaliação ainda.',
  escrever: 'Escrever Avaliação',
  editar: 'Editar minha Avaliação',
  apagar: 'Apagar minha Avaliação',
  confirmacao: 'Apagar sua Avaliação? Não dá para desfazer.',
  confirmar: 'Apagar',
  manter: 'Manter',
};

/** Apagar com confirmação na própria tela (sem Alert nativo). */
function ApagarAvaliacao({ idMidia, idAvaliacao }: { idMidia: string; idAvaliacao: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const apagar = useApagarAvaliacao(idMidia);

  if (!confirmando) {
    return <Botao titulo={textos.apagar} variante="secundario" onPress={() => setConfirmando(true)} />;
  }
  return (
    <View className="gap-2 rounded-md border border-erro p-3">
      <Text className="text-corpo text-texto-forte">{textos.confirmacao}</Text>
      {apagar.isError ? (
        <Text accessibilityRole="alert" className="text-corpo text-erro">
          {mensagemDeErro(apagar.error)}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Botao titulo={textos.manter} variante="secundario" onPress={() => setConfirmando(false)} />
        </View>
        <View className="flex-1">
          <Botao titulo={textos.confirmar} onPress={() => apagar.mutate(idAvaliacao)} carregando={apagar.isPending} />
        </View>
      </View>
    </View>
  );
}

function ItemAvaliacao({ a }: { a: Avaliacao }) {
  const cores = useCores();
  return (
    <View accessibilityLabel={`Avaliação de ${a.nome_completo}`} className="gap-1 rounded-md bg-superficie-alta p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-corpo font-semibold text-texto-forte">{a.nome_completo}</Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="star" size={16} color={cores.nota} />
          <Text className="text-corpo font-bold text-nota">{String(Number(a.nota))}</Text>
        </View>
      </View>
      <Text className="text-legenda text-texto-suave">{formatarData(a.data_avaliacao)}</Text>
      {a.titulo_avaliacao ? (
        <Text className="text-corpo font-semibold text-texto-forte">{a.titulo_avaliacao}</Text>
      ) : null}
      {a.texto_avaliacao ? <Text className="text-corpo text-texto">{a.texto_avaliacao}</Text> : null}
    </View>
  );
}

/**
 * `avaliacoes`: a 1ª página. `minha`: a Avaliação do Usuário (GET /midias/<id>/notas), que pode
 * não estar na página; null sem Avaliação, undefined enquanto carrega. `falha`: o aviso de
 * erro da página, no lugar da lista.
 */
export function SecaoAvaliacoes({
  idMidia,
  avaliacoes,
  minha,
  falha,
}: {
  idMidia: string;
  avaliacoes?: Avaliacao[];
  minha?: Avaliacao | null;
  falha?: ReactNode;
}) {
  const [formulario, setFormulario] = useState<'novo' | 'edicao' | null>(null);
  const fechar = () => setFormulario(null);

  return (
    <View className="gap-3 rounded-md bg-superficie p-4">
      <TituloSecao>{textos.titulo}</TituloSecao>
      {/* No máximo uma Avaliação por Mídia: com a própria, o botão vira editar. */}
      {minha === undefined ? null : minha ? (
        <View className="gap-2">
          <Botao titulo={textos.editar} variante="secundario" onPress={() => setFormulario('edicao')} />
          <ApagarAvaliacao idMidia={idMidia} idAvaliacao={minha.id_avaliacao} />
        </View>
      ) : (
        <Botao titulo={textos.escrever} onPress={() => setFormulario('novo')} />
      )}
      {falha ? (
        falha
      ) : avaliacoes?.length ? (
        avaliacoes.map((a) => <ItemAvaliacao key={a.id_avaliacao} a={a} />)
      ) : avaliacoes ? (
        <Text className="text-corpo text-texto-suave">{textos.nenhuma}</Text>
      ) : null}
      {formulario === 'novo' ? <FormularioAvaliacao idMidia={idMidia} aoFechar={fechar} /> : null}
      {formulario === 'edicao' && minha ? (
        <FormularioAvaliacao
          idMidia={idMidia}
          edicao={{
            idAvaliacao: minha.id_avaliacao,
            campos: {
              nota: String(Number(minha.nota)),
              titulo: minha.titulo_avaliacao ?? '',
              texto: minha.texto_avaliacao ?? '',
            },
          }}
          aoFechar={fechar}
        />
      ) : null}
    </View>
  );
}
