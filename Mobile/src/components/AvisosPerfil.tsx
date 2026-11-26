// "Avisar sobre Notícias" (spec noticias-avisos) e "Avisar sobre episódios novos" (spec
// episodio-novo): as preferências `avisar_noticias` e `avisar_episodios` do Usuário, que valem
// para todos os aparelhos dele. A permissão do sistema é outra coisa e fica com o Android.
import { Switch, Text, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { usePreferencias, useSalvarPreferencias } from '../api/preferencias';
import type { RespostaPreferencias } from '../api/tipos';
import { useCores } from '../tema/TemaContext';
import { FalhaParcial } from './EstadoTela';

/** Os push do app: as chaves `avisar_*` das Preferências do contrato. */
type Aviso = Extract<keyof RespostaPreferencias['preferencias'], `avisar_${string}`>;

const avisos: { chave: Aviso; titulo: string; explicacao: string }[] = [
  { chave: 'avisar_noticias', titulo: 'Avisar sobre Notícias', explicacao: 'Push no aparelho quando sair uma Notícia.' },
  {
    chave: 'avisar_episodios',
    titulo: 'Avisar sobre episódios novos',
    explicacao: 'Push no aparelho quando sair episódio de um anime que você acompanha.',
  },
];

export function AvisosPerfil() {
  const cores = useCores();
  const preferencias = usePreferencias();
  const salvar = useSalvarPreferencias();

  if (preferencias.isError && !preferencias.data) {
    return <FalhaParcial erro={preferencias.error} tentarDeNovo={() => void preferencias.refetch()} />;
  }
  if (!preferencias.data) return null;
  const valores = preferencias.data;

  return (
    <View className="gap-2">
      {avisos.map((aviso) => (
        <View key={aviso.chave} className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-corpo text-texto-forte">{aviso.titulo}</Text>
            <Text className="text-legenda text-texto-suave">{aviso.explicacao}</Text>
          </View>
          <Switch
            accessibilityLabel={aviso.titulo}
            value={valores[aviso.chave]}
            disabled={salvar.isPending}
            onValueChange={(valor) => salvar.mutate({ [aviso.chave]: valor })}
            trackColor={{ true: cores.marca, false: cores.borda }}
            thumbColor={cores.superficie}
          />
        </View>
      ))}
      {salvar.isError ? (
        <Text accessibilityRole="alert" className="text-legenda text-erro">
          {mensagemDeErro(salvar.error)}
        </Text>
      ) : null}
    </View>
  );
}
