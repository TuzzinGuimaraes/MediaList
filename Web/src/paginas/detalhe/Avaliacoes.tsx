// Avaliações do detalhe: a 1ª página com o total, e escrever, editar e excluir a do Usuário,
// que vem de GET /midias/<id>/notas (pode não estar na 1ª página).
import { type FormEvent, useState } from 'react';

import { mensagemDeErro } from '../../api/erros';
import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Modal } from '../../componentes/Camada';
import { AreaTexto, Campo } from '../../componentes/Campo';
import { ErroTela } from '../../componentes/Estados';
import { TituloSecao } from '../../componentes/Fileira';
import { Icone } from '../../componentes/Icone';
import { type FormularioAvaliacao as Campos, TITULO_MAXIMO, validarAvaliacao } from '@dominio/avaliacao';
import { formatarData } from '@dominio/datas';
import { useAvaliacoes, useExcluirAvaliacao, useNotas, useSalvarAvaliacao } from './consultas';

type Avaliacao = Esquemas['AvaliacaoDaMidia'];

const textos = {
  titulo: 'Avaliações',
  nenhuma: 'Ninguém avaliou ainda.',
  escrever: 'Escrever Avaliação',
  editar: 'Editar minha Avaliação',
  excluir: 'Excluir minha Avaliação',
  tituloNova: 'Escrever Avaliação',
  tituloEdicao: 'Editar Avaliação',
  aviso:
    'Sua Avaliação é pública: aparece para todos e entra na Nota média da Mídia. ' +
    'Ela é separada da Nota pessoal da sua Lista, e as duas podem ser diferentes.',
  nota: 'Nota (0 a 10)',
  campoTitulo: 'Título',
  texto: 'Texto',
  publicar: 'Publicar',
  salvar: 'Salvar',
  cancelar: 'Cancelar',
  tituloExcluir: 'Excluir Avaliação',
  confirmacao: 'Excluir sua Avaliação? Não dá para desfazer.',
  confirmarExcluir: 'Excluir',
  manter: 'Manter',
};

const ID_FORMULARIO = 'formulario-avaliacao';

const textoDaNota = (nota: number) => String(Number(nota));

function FormularioAvaliacao({ idMidia, minha, fechar }: { idMidia: string; minha: Avaliacao | null; fechar(): void }) {
  const [campos, setCampos] = useState<Campos>(
    minha
      ? { nota: textoDaNota(minha.nota), titulo: minha.titulo_avaliacao ?? '', texto: minha.texto_avaliacao ?? '' }
      : { nota: '', titulo: '', texto: '' },
  );
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarAvaliacao(idMidia);
  const mudar = (campo: keyof Campos) => (e: { target: { value: string } }) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const resultado = validarAvaliacao(campos);
    if (!resultado.ok) return setErro(resultado.erro);
    setErro(null);
    try {
      await salvar.mutateAsync({ idAvaliacao: minha?.id_avaliacao, dados: resultado.dados });
      fechar();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  };

  return (
    <Modal
      titulo={minha ? textos.tituloEdicao : textos.tituloNova}
      aberto
      fechar={fechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            {textos.cancelar}
          </Botao>
          <Botao type="submit" form={ID_FORMULARIO} carregando={salvar.isPending}>
            {minha ? textos.salvar : textos.publicar}
          </Botao>
        </>
      }
    >
      <form id={ID_FORMULARIO} noValidate onSubmit={enviar} className="flex flex-col gap-4">
        <p className="text-[14px] text-texto-suave">{textos.aviso}</p>
        <Campo rotulo={textos.nota} value={campos.nota} onChange={mudar('nota')} inputMode="decimal" className="max-w-40" />
        <Campo rotulo={textos.campoTitulo} value={campos.titulo} onChange={mudar('titulo')} maxLength={TITULO_MAXIMO} />
        <AreaTexto rotulo={textos.texto} value={campos.texto} onChange={mudar('texto')} />
        {erro ? (
          <p role="alert" className="text-[14px] text-erro">
            {erro}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function ConfirmarExclusao({ idMidia, idAvaliacao, fechar }: { idMidia: string; idAvaliacao: string; fechar(): void }) {
  const excluir = useExcluirAvaliacao(idMidia);
  return (
    <Modal
      titulo={textos.tituloExcluir}
      aberto
      fechar={fechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar}>
            {textos.manter}
          </Botao>
          <Botao carregando={excluir.isPending} onClick={() => excluir.mutate(idAvaliacao, { onSuccess: fechar })}>
            {textos.confirmarExcluir}
          </Botao>
        </>
      }
    >
      <p className="text-texto-forte">{textos.confirmacao}</p>
      {excluir.isError ? (
        <p role="alert" className="mt-3 text-[14px] text-erro">
          {mensagemDeErro(excluir.error)}
        </p>
      ) : null}
    </Modal>
  );
}

function ItemAvaliacao({ a }: { a: Avaliacao }) {
  return (
    <article aria-label={`Avaliação de ${a.nome_completo}`} className="rounded-lg border border-borda bg-superficie p-4">
      <div className="mb-2 flex items-center gap-3">
        {a.foto_perfil ? (
          <img src={a.foto_perfil} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-superficie-alta font-bold text-texto-forte">
            {a.nome_completo.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-texto-forte">{a.nome_completo}</p>
          <p className="text-[12px] text-texto-suave">{formatarData(a.data_avaliacao)}</p>
        </div>
        <span aria-label={`Nota ${textoDaNota(a.nota)}`} className="inline-flex items-center gap-1 font-bold text-nota">
          <Icone nome="estrela" tamanho={14} cheio /> {textoDaNota(a.nota)}
        </span>
      </div>
      {a.titulo_avaliacao ? <p className="font-semibold text-texto-forte">{a.titulo_avaliacao}</p> : null}
      {a.texto_avaliacao ? <p className="whitespace-pre-line text-[14px] text-texto">{a.texto_avaliacao}</p> : null}
    </article>
  );
}

export function Avaliacoes({ idMidia }: { idMidia: string }) {
  const pagina = useAvaliacoes(idMidia);
  const notas = useNotas(idMidia);
  const [aberto, setAberto] = useState<'formulario' | 'exclusao' | null>(null);
  const fechar = () => setAberto(null);
  // undefined enquanto carrega: sem saber, nem escrever nem editar.
  const minha = notas.data?.minha_avaliacao;
  const total = pagina.data?.total;

  return (
    <section aria-labelledby="titulo-avaliacoes">
      <TituloSecao
        direita={
          minha === undefined ? null : minha ? (
            <div className="flex gap-2">
              <Botao variante="secundario" icone={<Icone nome="editar" tamanho={16} />} onClick={() => setAberto('formulario')}>
                {textos.editar}
              </Botao>
              <Botao variante="fantasma" onClick={() => setAberto('exclusao')}>
                {textos.excluir}
              </Botao>
            </div>
          ) : (
            <Botao variante="secundario" onClick={() => setAberto('formulario')}>
              {textos.escrever}
            </Botao>
          )
        }
      >
        <span id="titulo-avaliacoes">{total ? `${textos.titulo} · ${total}` : textos.titulo}</span>
      </TituloSecao>
      {pagina.isError ? (
        <ErroTela erro={pagina.error} tentarDeNovo={() => void pagina.refetch()} />
      ) : pagina.data ? (
        pagina.data.itens.length ? (
          <div className="flex flex-col gap-3">
            {pagina.data.itens.map((a) => (
              <ItemAvaliacao key={a.id_avaliacao} a={a} />
            ))}
          </div>
        ) : (
          <p className="text-texto-suave">{textos.nenhuma}</p>
        )
      ) : null}
      {aberto === 'formulario' && minha !== undefined ? (
        <FormularioAvaliacao idMidia={idMidia} minha={minha} fechar={fechar} />
      ) : null}
      {aberto === 'exclusao' && minha ? (
        <ConfirmarExclusao idMidia={idMidia} idAvaliacao={minha.id_avaliacao} fechar={fechar} />
      ) : null}
    </section>
  );
}
