// Integrações no Perfil (ADR 0015), espelho do web sem o XML do MAL: conectar a conta pública,
// importar com prévia e confirmação, ver os Não encontrados, desconectar; a Steam sincroniza
// direto. Uma linha por plataforma que a API registra (GET /integracoes).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { formatarData } from '@dominio/datas';
import {
  naoEncontradosForaDaAmostra,
  PEDIDO_DE_CONTA,
  resumoDaImportacao,
  SINCRONIZA_SEM_PREVIA,
  temOQueConfirmar,
  textoDePendentes,
} from '@dominio/integracoes';
import { mensagemDeErro } from '../api/erros';
import {
  useConectar,
  useConfirmarPrevia,
  useDesconectar,
  useGerarPrevia,
  useIntegracoes,
  useSincronizarSteam,
} from '../api/integracoes';
import type { Integracao, PreviaImportacao, ResultadoImportacao } from '../api/tipos';
import { vibrarConfirmacao } from '../tema/haptics';
import { useCores } from '../tema/TemaContext';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { FalhaParcial } from './EstadoTela';

const textos = {
  intro: 'Traga sua lista de outras plataformas pelo perfil público, sem senha.',
  indisponivel: 'Indisponível no momento.',
  nadaApagado:
    'Nada é apagado: o Progresso fica com o maior valor e suas notas, comentários e Avaliações ficam como estão.',
  naoEncontrados: 'Não encontrados: adicione à mão',
};

function Alerta({ erro }: { erro: unknown }) {
  return (
    <Text accessibilityRole="alert" className="text-legenda text-erro">
      {mensagemDeErro(erro)}
    </Text>
  );
}

/** Linha de resultado que o leitor de tela anuncia ao aparecer. */
function Aviso({ children }: { children: string }) {
  return (
    <Text accessibilityLiveRegion="polite" className="text-corpo text-texto-forte">
      {children}
    </Text>
  );
}

/** Fechado por padrão (como o <details> do web); abre sem animação. Os links vão para o navegador. */
function NaoEncontrados({ resultado }: { resultado: ResultadoImportacao }) {
  const cores = useCores();
  const [aberto, setAberto] = useState(false);
  if (!resultado.total_nao_encontrados) return null;
  const fora = naoEncontradosForaDaAmostra(resultado);
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={textos.naoEncontrados}
        accessibilityState={{ expanded: aberto }}
        onPress={() => setAberto((a) => !a)}
        className="min-h-[44px] flex-row items-center gap-1"
      >
        <Ionicons name={aberto ? 'chevron-down' : 'chevron-forward'} size={16} color={cores['texto-suave']} />
        <Text className="text-corpo text-texto-suave">{textos.naoEncontrados}</Text>
      </Pressable>
      {aberto ? (
        <View accessibilityLabel="Não encontrados" className="gap-1 pl-5">
          {resultado.nao_encontrados.map((n, i) =>
            n.link ? (
              <Pressable
                key={`${n.titulo}-${i}`}
                accessibilityRole="link"
                accessibilityLabel={n.titulo}
                onPress={() => void Linking.openURL(n.link!).catch(() => {})}
                className="min-h-[36px] justify-center"
              >
                <Text className="text-corpo text-marca-texto underline">{n.titulo}</Text>
              </Pressable>
            ) : (
              <Text key={`${n.titulo}-${i}`} className="text-corpo text-texto">
                {n.titulo}
              </Text>
            ),
          )}
          {fora ? <Text className="text-corpo text-texto-suave">e mais {fora}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function CaixaDaPrevia({
  previa,
  confirmando,
  confirmar,
  fechar,
}: {
  previa: PreviaImportacao;
  confirmando: boolean;
  confirmar: () => void;
  fechar: () => void;
}) {
  const podeConfirmar = temOQueConfirmar(previa);
  return (
    <View accessibilityLabel="Prévia da importação" className="gap-3 rounded-md bg-superficie-alta p-4">
      <Text className="text-corpo font-bold text-texto-forte">{resumoDaImportacao(previa)}</Text>
      <Text className="text-legenda text-texto-suave">{textos.nadaApagado}</Text>
      <NaoEncontrados resultado={previa} />
      <View className="gap-2">
        {podeConfirmar ? <Botao titulo="Confirmar" carregando={confirmando} onPress={confirmar} /> : null}
        {confirmando ? null : (
          <Botao titulo={podeConfirmar ? 'Cancelar' : 'Fechar'} variante="secundario" onPress={fechar} />
        )}
      </View>
    </View>
  );
}

function SincronizarSteam() {
  const sincronizar = useSincronizarSteam();
  const pendentes = sincronizar.data ? textoDePendentes(sincronizar.data.pendentes) : null;
  return (
    <View className="gap-2">
      <Botao
        titulo="Sincronizar agora"
        variante="secundario"
        carregando={sincronizar.isPending}
        onPress={() => sincronizar.mutate(undefined, { onSuccess: vibrarConfirmacao })}
      />
      {sincronizar.data ? (
        <View className="gap-1">
          <Aviso>{`Sincronizado: ${resumoDaImportacao(sincronizar.data)}`}</Aviso>
          {pendentes ? (
            <Text className="text-corpo text-texto-suave">{`${pendentes}; o resto entra na sincronização diária.`}</Text>
          ) : null}
          <NaoEncontrados resultado={sincronizar.data} />
        </View>
      ) : null}
      {sincronizar.isError ? <Alerta erro={sincronizar.error} /> : null}
    </View>
  );
}

function Conectar({ integracao }: { integracao: Integracao }) {
  const [identificador, setIdentificador] = useState('');
  const conectar = useConectar(integracao.plataforma);
  const pedido = PEDIDO_DE_CONTA[integracao.plataforma];
  const enviar = () => {
    const valor = identificador.trim();
    if (valor) conectar.mutate(valor);
  };
  return (
    <View className="gap-3">
      <Campo
        rotulo={pedido.rotulo}
        placeholder={pedido.exemplo}
        value={identificador}
        onChangeText={setIdentificador}
        onSubmitEditing={enviar}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="go"
      />
      {conectar.isError ? <Alerta erro={conectar.error} /> : null}
      <Botao titulo="Conectar" carregando={conectar.isPending} onPress={enviar} />
    </View>
  );
}

function Conectada({ integracao }: { integracao: Integracao }) {
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [importado, setImportado] = useState<ResultadoImportacao | null>(null);
  const gerar = useGerarPrevia(integracao.plataforma);
  const confirmar = useConfirmarPrevia();
  const desconectar = useDesconectar(integracao.plataforma);

  const ultima = formatarData(integracao.ultima_sincronizacao);
  const semPrevia = SINCRONIZA_SEM_PREVIA.has(integracao.plataforma);
  const erro = gerar.error ?? confirmar.error ?? desconectar.error;

  const importar = () =>
    gerar.mutate(undefined, {
      onSuccess: (p) => {
        setImportado(null);
        setPrevia(p);
      },
    });
  const confirmarPrevia = (p: PreviaImportacao) =>
    confirmar.mutate(p.id_previa, {
      onSuccess: (r) => {
        vibrarConfirmacao();
        setPrevia(null);
        setImportado(r);
      },
    });

  return (
    <View className="gap-3">
      <Text className="text-corpo text-texto-suave">
        Conectado como{' '}
        <Text className="font-bold text-texto-forte">{integracao.nome_exibicao ?? integracao.identificador}</Text>
        {ultima ? ` · última ${semPrevia ? 'sincronização' : 'importação'} em ${ultima}` : ''}
      </Text>

      {previa ? (
        <CaixaDaPrevia
          previa={previa}
          confirmando={confirmar.isPending}
          confirmar={() => confirmarPrevia(previa)}
          fechar={() => setPrevia(null)}
        />
      ) : (
        <View className="gap-2">
          {semPrevia ? <SincronizarSteam /> : <Botao titulo="Importar" carregando={gerar.isPending} onPress={importar} />}
          <Botao
            titulo="Desconectar"
            variante="secundario"
            carregando={desconectar.isPending}
            onPress={() => desconectar.mutate()}
          />
        </View>
      )}

      {importado ? (
        <View className="gap-2">
          <Aviso>{`Importado: ${resumoDaImportacao(importado)}`}</Aviso>
          <NaoEncontrados resultado={importado} />
        </View>
      ) : !previa && integracao.ultimo_resultado ? (
        <NaoEncontrados resultado={integracao.ultimo_resultado} />
      ) : null}
      {erro ? <Alerta erro={erro} /> : null}
    </View>
  );
}

function Plataforma({ integracao }: { integracao: Integracao }) {
  return (
    <View accessibilityLabel={integracao.rotulo} className="gap-3 rounded-md border border-borda p-4">
      <Text accessibilityRole="header" className="text-corpo font-bold text-texto-forte">
        {integracao.rotulo}
      </Text>
      {!integracao.disponivel ? (
        <Text className="text-corpo text-texto-suave">{textos.indisponivel}</Text>
      ) : integracao.conectada ? (
        <Conectada integracao={integracao} />
      ) : (
        <Conectar integracao={integracao} />
      )}
    </View>
  );
}

/** O conteúdo da seção Integrações do Perfil; um erro aqui não esconde o resto do Perfil. */
export function IntegracoesPerfil() {
  const cores = useCores();
  const consulta = useIntegracoes();
  if (!consulta.data) {
    return consulta.isError ? (
      <FalhaParcial erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <ActivityIndicator color={cores['marca-texto']} accessibilityLabel="Carregando integrações" />
    );
  }
  return (
    <View className="gap-3">
      <Text className="text-corpo text-texto-suave">{textos.intro}</Text>
      {consulta.data.map((i) => (
        <Plataforma key={i.plataforma} integracao={i} />
      ))}
    </View>
  );
}
