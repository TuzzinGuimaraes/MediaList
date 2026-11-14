import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { usePermissoes, useUsuarioAtual } from '@/api/usuario';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Carregando, Falha } from '@/components/EstadoTela';
import { EstatisticasPerfil } from '@/components/EstatisticasPerfil';
import { rotuloNivelAcesso } from '@/dominio/conta';
import { usePrototipo } from '@/prototipo/PrototipoContext';

const textos = {
  nome: 'Nome',
  email: 'Email',
  nivel: 'Nível de acesso',
  sair: 'Sair',
  tema: 'Tema',
};

const TEMAS = [
  { chave: 'sistema', nome: 'Sistema' },
  { chave: 'escuro', nome: 'Escuro' },
  { chave: 'claro', nome: 'Claro' },
] as const;

/** PROTÓTIPO (ticket 29): Sistema / Escuro / Claro, em memória, no mesmo estado do eixo `tema`. */
function SeletorTema() {
  const { valores, mudar } = usePrototipo();
  return (
    <View className="gap-2">
      <Text className="text-legenda text-text-secondary">{textos.tema}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={textos.tema} className="flex-row rounded-md border border-borda bg-superficie p-1">
        {TEMAS.map((t) => {
          const ativo = valores.tema === t.chave;
          return (
            <Pressable
              key={t.chave}
              accessibilityRole="radio"
              accessibilityLabel={t.nome}
              accessibilityState={{ checked: ativo }}
              onPress={() => mudar('tema', t.chave)}
              className={`flex-1 items-center rounded py-2 ${ativo ? 'bg-marca' : ''}`}
            >
              <Text className={`text-corpo font-semibold ${ativo ? 'text-sobre-marca' : 'text-texto-suave'}`}>{t.nome}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
      <SeletorTema />
      <EstatisticasPerfil />
      {botaoSair}
    </ScrollView>
  );
}
