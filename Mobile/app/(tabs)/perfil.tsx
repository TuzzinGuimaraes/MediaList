import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { usePermissoes, useUsuarioAtual } from '@/api/usuario';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Carregando, Falha } from '@/components/EstadoTela';
import { EstatisticasPerfil } from '@/components/EstatisticasPerfil';
import { rotuloNivelAcesso } from '@/dominio/conta';

const textos = {
  nome: 'Nome',
  email: 'Email',
  nivel: 'Nível de acesso',
  sair: 'Sair',
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="gap-1 border-b border-dark-border py-3">
      <Text className="text-legenda text-text-secondary">{rotulo}</Text>
      <Text className="text-corpo text-text-bright">{valor}</Text>
    </View>
  );
}

export default function Perfil() {
  const { sair } = useSessao();
  const usuario = useUsuarioAtual();
  const permissoes = usePermissoes();
  const [saindo, setSaindo] = useState(false);

  const botaoSair = (
    <Botao
      titulo={textos.sair}
      variante="secundario"
      carregando={saindo}
      onPress={() => {
        setSaindo(true);
        sair();
      }}
    />
  );

  if (!usuario.data || !permissoes.data) {
    if (usuario.isError || permissoes.isError) {
      return (
        <View className="flex-1 bg-dark-primary">
          <Falha
            erro={usuario.error ?? permissoes.error}
            tentarDeNovo={() => {
              usuario.refetch();
              permissoes.refetch();
            }}
          />
          <View className="p-6">{botaoSair}</View>
        </View>
      );
    }
    return <Carregando />;
  }

  return (
    <ScrollView className="flex-1 bg-dark-primary" contentContainerClassName="gap-6 p-6">
      <View>
        <Linha rotulo={textos.nome} valor={usuario.data.nome_completo} />
        <Linha rotulo={textos.email} valor={usuario.data.email} />
        <Linha rotulo={textos.nivel} valor={rotuloNivelAcesso(permissoes.data.nivel_acesso)} />
      </View>
      <EstatisticasPerfil />
      {botaoSair}
    </ScrollView>
  );
}
