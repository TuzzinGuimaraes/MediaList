import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { usePermissoes, useUsuarioAtual } from '@/api/usuario';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Carregando, Falha } from '@/components/EstadoTela';
import { EstatisticasPerfil } from '@/components/EstatisticasPerfil';
import { rotuloNivelAcesso } from '@/dominio/conta';
import type { PreferenciaTema } from '@/tema/tema';
import { useTema } from '@/tema/TemaContext';

const textos = {
  nome: 'Nome',
  email: 'Email',
  nivel: 'Nível de acesso',
  sair: 'Sair',
  tema: 'Tema',
};

const TEMAS: { valor: PreferenciaTema; titulo: string }[] = [
  { valor: 'sistema', titulo: 'Sistema' },
  { valor: 'escuro', titulo: 'Escuro' },
  { valor: 'claro', titulo: 'Claro' },
];

/** Sistema / Escuro / Claro; a escolha fica guardada no aparelho. */
function SeletorTema() {
  const { preferencia, escolher } = useTema();
  return (
    <View className="gap-2">
      <Text className="text-legenda text-texto-suave">{textos.tema}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={textos.tema}
        className="flex-row rounded-md border border-borda bg-superficie p-1"
      >
        {TEMAS.map((t) => {
          const ativo = preferencia === t.valor;
          return (
            <Pressable
              key={t.valor}
              accessibilityRole="radio"
              accessibilityLabel={t.titulo}
              accessibilityState={{ checked: ativo }}
              onPress={() => escolher(t.valor)}
              className={`min-h-[40px] flex-1 items-center justify-center rounded ${ativo ? 'bg-marca' : ''}`}
            >
              <Text className={`text-corpo font-semibold ${ativo ? 'text-sobre-marca' : 'text-texto-suave'}`}>
                {t.titulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="gap-1 border-b border-borda py-3">
      <Text className="text-legenda text-texto-suave">{rotulo}</Text>
      <Text className="text-corpo text-texto-forte">{valor}</Text>
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
        <View className="flex-1 bg-fundo">
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
    <ScrollView className="flex-1 bg-fundo" contentContainerClassName="gap-6 p-6">
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
