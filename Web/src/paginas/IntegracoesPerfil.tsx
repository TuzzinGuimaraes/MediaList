// Integrações no Perfil (ADR 0015): conectar a conta pública de cada plataforma, importar com
// prévia e confirmação, ver os Não encontrados, desconectar. Uma linha por plataforma que a
// API registra (GET /integracoes), então o MAL e a Steam entram sem mudar esta tela; o que é
// próprio de uma plataforma (o XML do MAL, o "Sincronizar agora" da Steam) vai em `extras`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type ReactNode, useState } from 'react';

import { formatarData } from '@dominio/datas';
import {
  type NomePlataforma,
  naoEncontradosForaDaAmostra,
  PEDIDO_DE_CONTA,
  resumoDaImportacao,
  temOQueConfirmar,
} from '@dominio/integracoes';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { mensagemDeErro } from '../api/erros';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Campo } from '../componentes/Campo';
import { Carregando, ErroTela } from '../componentes/Estados';
import { useApi } from '../sessao/SessaoContext';

type Integracao = Esquemas['Integracao'];
type Previa = Esquemas['PreviaImportacao'];
type Resultado = Esquemas['ResultadoImportacao'];

/** Conteúdo a mais por plataforma, abaixo dos botões (os tickets do MAL e da Steam somam aqui). */
const EXTRAS: Partial<Record<NomePlataforma, (i: Integracao) => ReactNode>> = {};

function Alerta({ erro }: { erro: unknown }) {
  return (
    <p role="alert" className="text-[13px] text-erro">
      {mensagemDeErro(erro)}
    </p>
  );
}

function NaoEncontrados({ resultado }: { resultado: Resultado }) {
  if (!resultado.total_nao_encontrados) return null;
  const fora = naoEncontradosForaDaAmostra(resultado);
  return (
    <details className="text-[14px]">
      <summary className="cursor-pointer text-texto-suave">Não encontrados: adicione à mão</summary>
      <ul aria-label="Não encontrados" className="mt-2 flex flex-col gap-1">
        {resultado.nao_encontrados.map((n, i) => (
          <li key={`${n.titulo}-${i}`}>
            {n.link ? (
              <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-marca-texto underline">
                {n.titulo}
              </a>
            ) : (
              n.titulo
            )}
          </li>
        ))}
      </ul>
      {fora ? <p className="mt-1 text-texto-suave">e mais {fora}</p> : null}
    </details>
  );
}

/** Confirmar a prévia (de qualquer plataforma ou do XML): a Lista, as estatísticas e os contadores mudam. */
function useConfirmarPrevia(aoConfirmar: (r: Resultado) => void) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      exigir(api.POST('/api/integracoes/previas/{id_previa}/confirmar', { params: { path: { id_previa: id } } })),
    onSuccess: (r) => {
      aoConfirmar(r);
      for (const queryKey of [chaves.integracoes, chaves.lista.toda, ['usuario'], chaves.midias.todas]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

function CaixaDaPrevia({
  previa,
  confirmar,
  fechar,
}: {
  previa: Previa;
  confirmar: ReturnType<typeof useConfirmarPrevia>;
  fechar: () => void;
}) {
  return (
    <div role="group" aria-label="Prévia da importação" className="flex flex-col gap-3 rounded-lg bg-superficie-alta p-4">
      <p className="font-bold text-texto-forte">{resumoDaImportacao(previa)}</p>
      <p className="text-[13px] text-texto-suave">
        Nada é apagado: o Progresso fica com o maior valor e suas notas, comentários e Avaliações ficam como estão.
      </p>
      <NaoEncontrados resultado={previa} />
      <div className="flex flex-wrap gap-2">
        {temOQueConfirmar(previa) ? (
          <Botao carregando={confirmar.isPending} onClick={() => confirmar.mutate(previa.id_previa)}>
            Confirmar
          </Botao>
        ) : null}
        <Botao variante="secundario" onClick={fechar} disabled={confirmar.isPending}>
          {temOQueConfirmar(previa) ? 'Cancelar' : 'Fechar'}
        </Botao>
      </div>
    </div>
  );
}

function Conectar({ integracao }: { integracao: Integracao }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [identificador, setIdentificador] = useState('');
  const pedido = PEDIDO_DE_CONTA[integracao.plataforma];
  const conectar = useMutation({
    mutationFn: () =>
      exigir(
        api.PUT('/api/integracoes/{plataforma}', {
          params: { path: { plataforma: integracao.plataforma } },
          body: { identificador: identificador.trim() },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.integracoes }),
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (identificador.trim()) conectar.mutate();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <Campo
        rotulo={pedido.rotulo}
        dica={pedido.exemplo}
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
        autoComplete="off"
      />
      {conectar.isError ? <Alerta erro={conectar.error} /> : null}
      <Botao type="submit" carregando={conectar.isPending} disabled={!identificador.trim()}>
        Conectar
      </Botao>
    </form>
  );
}

function Conectada({ integracao }: { integracao: Integracao }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [importado, setImportado] = useState<Resultado | null>(null);
  const caminho = { params: { path: { plataforma: integracao.plataforma } } };

  const gerar = useMutation({
    mutationFn: () => exigir(api.POST('/api/integracoes/{plataforma}/previa', caminho)),
    onSuccess: (p) => {
      setImportado(null);
      setPrevia(p);
    },
  });
  const confirmar = useConfirmarPrevia((r) => {
    setPrevia(null);
    setImportado(r);
  });
  const desconectar = useMutation({
    mutationFn: () => exigir(api.DELETE('/api/integracoes/{plataforma}', caminho)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.integracoes }),
  });

  const ultima = formatarData(integracao.ultima_sincronizacao);
  const erro = gerar.error ?? confirmar.error ?? desconectar.error;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-texto-suave">
        Conectado como <strong className="text-texto-forte">{integracao.nome_exibicao ?? integracao.identificador}</strong>
        {ultima ? ` · última importação em ${ultima}` : ''}
      </p>

      {previa ? (
        <CaixaDaPrevia previa={previa} confirmar={confirmar} fechar={() => setPrevia(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Botao carregando={gerar.isPending} onClick={() => gerar.mutate()}>
            Importar
          </Botao>
          <Botao variante="fantasma" carregando={desconectar.isPending} onClick={() => desconectar.mutate()}>
            Desconectar
          </Botao>
        </div>
      )}

      {importado ? (
        <div role="status" className="flex flex-col gap-2 text-[14px]">
          <p className="text-texto-forte">Importado: {resumoDaImportacao(importado)}</p>
          <NaoEncontrados resultado={importado} />
        </div>
      ) : !previa && integracao.ultimo_resultado ? (
        <NaoEncontrados resultado={integracao.ultimo_resultado} />
      ) : null}
      {erro ? <Alerta erro={erro} /> : null}
      {EXTRAS[integracao.plataforma]?.(integracao)}
    </div>
  );
}

/**
 * O XML exportado do MyAnimeList (o AniList e o Kitsu exportam o mesmo formato), só no web.
 * Não precisa conectar nem da chave do MAL no servidor: aparece mesmo com o MAL indisponível.
 */
function XmlDoMal() {
  const api = useApi();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [importado, setImportado] = useState<Resultado | null>(null);
  const enviar = useMutation({
    mutationFn: (escolhido: File) =>
      exigir(
        api.POST('/api/integracoes/mal/xml', {
          body: { arquivo: escolhido.name },
          bodySerializer: () => {
            const corpo = new FormData();
            corpo.append('arquivo', escolhido, escolhido.name);
            return corpo;
          },
        }),
      ),
    onSuccess: (p) => {
      setImportado(null);
      setPrevia(p);
    },
  });
  const confirmar = useConfirmarPrevia((r) => {
    setPrevia(null);
    setImportado(r);
  });

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (arquivo) enviar.mutate(arquivo);
  }

  const erro = enviar.error ?? confirmar.error;
  return (
    <div className="flex flex-col gap-3 border-t border-borda pt-3">
      {previa ? (
        <CaixaDaPrevia previa={previa} confirmar={confirmar} fechar={() => setPrevia(null)} />
      ) : (
        <form onSubmit={aoEnviar} className="flex flex-col gap-2" aria-label="Arquivo XML do MyAnimeList">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-texto-suave">
            Arquivo XML exportado
            <input
              type="file"
              accept=".xml,.gz,application/xml,text/xml,application/gzip"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="text-[14px] font-normal text-texto-forte"
            />
          </label>
          <p className="text-[13px] text-texto-suave">
            No MyAnimeList, em Export, baixe a lista (.xml ou .xml.gz, até 5 MB). O AniList e o Kitsu exportam o mesmo formato.
          </p>
          <div>
            <Botao type="submit" variante="secundario" carregando={enviar.isPending} disabled={!arquivo}>
              Enviar XML
            </Botao>
          </div>
        </form>
      )}
      {importado ? (
        <div role="status" className="flex flex-col gap-2 text-[14px]">
          <p className="text-texto-forte">Importado: {resumoDaImportacao(importado)}</p>
          <NaoEncontrados resultado={importado} />
        </div>
      ) : null}
      {erro ? <Alerta erro={erro} /> : null}
    </div>
  );
}

function Plataforma({ integracao }: { integracao: Integracao }) {
  return (
    <li aria-label={integracao.rotulo} className="flex flex-col gap-3 rounded-lg border border-borda p-4">
      <h3 className="font-bold text-texto-forte">{integracao.rotulo}</h3>
      {!integracao.disponivel ? (
        <p className="text-[14px] text-texto-suave">Indisponível no momento.</p>
      ) : integracao.conectada ? (
        <Conectada integracao={integracao} />
      ) : (
        <Conectar integracao={integracao} />
      )}
      {integracao.plataforma === 'mal' ? <XmlDoMal /> : null}
    </li>
  );
}

export function IntegracoesPerfil() {
  const api = useApi();
  const consulta = useQuery({
    queryKey: chaves.integracoes,
    queryFn: () => exigir(api.GET('/api/integracoes')),
    select: (r) => r.integracoes,
  });

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando integrações" />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-texto-suave">
        Traga sua lista de outras plataformas pelo perfil público, sem senha.
      </p>
      <ul className="flex flex-col gap-3">
        {consulta.data.map((i) => (
          <Plataforma key={i.plataforma} integracao={i} />
        ))}
      </ul>
    </div>
  );
}
