// "Avisar sobre Notícias" (spec noticias-avisos): a preferência `avisar_noticias` do Usuário,
// que vale para todos os aparelhos dele. A permissão do sistema é outra coisa e fica com o Android.
import { Switch, Text, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { usePreferencias, useSalvarPreferencias } from '../api/preferencias';
import { useCores } from '../tema/TemaContext';
import { FalhaParcial } from './EstadoTela';

const textos = {
  avisar: 'Avisar sobre Notícias',
  explicacao: 'Push no aparelho quando sair uma Notícia.',
};

export function AvisosPerfil() {
  const cores = useCores();
  const preferencias = usePreferencias();
  const salvar = useSalvarPreferencias();

  if (preferencias.isError && !preferencias.data) {
    return <FalhaParcial erro={preferencias.error} tentarDeNovo={() => void preferencias.refetch()} />;
  }
  if (!preferencias.data) return null;

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-corpo text-texto-forte">{textos.avisar}</Text>
          <Text className="text-legenda text-texto-suave">{textos.explicacao}</Text>
        </View>
        <Switch
          accessibilityLabel={textos.avisar}
          value={preferencias.data.avisar_noticias}
          disabled={salvar.isPending}
          onValueChange={(valor) => salvar.mutate({ avisar_noticias: valor })}
          trackColor={{ true: cores.marca, false: cores.borda }}
          thumbColor={cores.superficie}
        />
      </View>
      {salvar.isError ? (
        <Text accessibilityRole="alert" className="text-legenda text-erro">
          {mensagemDeErro(salvar.error)}
        </Text>
      ) : null}
    </View>
  );
}
