import { useState } from 'react';
import { Text, View } from 'react-native';

import { usePermissoes, useUsuarioAtual } from '@/api/usuario';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Carregando, Falha } from '@/components/EstadoTela';
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
      <Text className="text-sm text-text-secondary">{rotulo}</Text>
      <Text className="text-base text-text-bright">{valor}</Text>
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
    <View className="flex-1 gap-6 bg-dark-primary p-6">
      <View>
        <Linha rotulo={textos.nome} valor={usuario.data.nome_completo} />
        <Linha rotulo={textos.email} valor={usuario.data.email} />
        <Linha rotulo={textos.nivel} valor={rotuloNivelAcesso(permissoes.data.nivel_acesso)} />
      </View>
      {botaoSair}
    </View>
  );
}
