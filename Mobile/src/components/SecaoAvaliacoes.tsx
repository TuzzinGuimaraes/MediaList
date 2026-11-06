import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useApagarAvaliacao } from '../api/avaliacoes';
import { mensagemDeErro } from '../api/erros';
import type { AvaliacaoCompleta } from '../api/tipos';
import { useSessao } from '../auth/SessaoContext';
import { formatarData } from '../dominio/datas';
import paleta from '../tema/paleta';
import { Botao } from './Botao';
import { FormularioAvaliacao } from './FormularioAvaliacao';

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
    <View className="gap-2 rounded-md border border-accent-red p-3">
      <Text className="text-corpo text-text-bright">{textos.confirmacao}</Text>
      {apagar.isError ? (
        <Text accessibilityRole="alert" className="text-corpo text-accent-red">
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

function ItemAvaliacao({ a }: { a: AvaliacaoCompleta }) {
  return (
    <View accessibilityLabel={`Avaliação de ${a.nome_completo}`} className="gap-1 rounded-md bg-dark-tertiary p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-corpo font-semibold text-text-bright">{a.nome_completo}</Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="star" size={16} color={paleta.accent.yellow} />
          <Text className="text-corpo font-bold text-accent-yellow">{String(Number(a.nota))}</Text>
        </View>
      </View>
      <Text className="text-legenda text-text-secondary">{formatarData(a.data_avaliacao)}</Text>
      {a.titulo_avaliacao ? (
        <Text className="text-corpo font-semibold text-text-bright">{a.titulo_avaliacao}</Text>
      ) : null}
      {a.texto_avaliacao ? <Text className="text-corpo text-text-primary">{a.texto_avaliacao}</Text> : null}
    </View>
  );
}

export function SecaoAvaliacoes({ idMidia, avaliacoes }: { idMidia: string; avaliacoes?: AvaliacaoCompleta[] }) {
  const { sessao } = useSessao();
  const [formulario, setFormulario] = useState<'novo' | 'edicao' | null>(null);
  const idUsuario = sessao.estado === 'autenticada' ? sessao.usuario.id : null;
  const minha = avaliacoes?.find((a) => a.id_usuario === idUsuario);
  const fechar = () => setFormulario(null);

  return (
    <View className="gap-3 rounded-md bg-dark-secondary p-4">
      <Text className="text-legenda font-bold uppercase tracking-wider text-text-secondary">{textos.titulo}</Text>
      {/* No máximo uma Avaliação por Mídia: com a própria, o botão vira editar. */}
      {!avaliacoes ? null : minha ? (
        <View className="gap-2">
          <Botao titulo={textos.editar} variante="secundario" onPress={() => setFormulario('edicao')} />
          <ApagarAvaliacao idMidia={idMidia} idAvaliacao={minha.id_avaliacao} />
        </View>
      ) : (
        <Botao titulo={textos.escrever} onPress={() => setFormulario('novo')} />
      )}
      {avaliacoes?.length ? (
        avaliacoes.map((a) => <ItemAvaliacao key={a.id_avaliacao} a={a} />)
      ) : avaliacoes ? (
        <Text className="text-corpo text-text-secondary">{textos.nenhuma}</Text>
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
