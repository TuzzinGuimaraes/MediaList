// Editor do Item de lista, em modal. As regras são as do app (`@dominio/itemLista`): Status e
// Progresso andam juntos (ADR 0009) e sair de Concluído devolve o Progresso (ticket 33).
// Datas pelo calendário do navegador, nunca no futuro; Recontagem com − e +.
import { useState } from 'react';

import { diaIso } from '@dominio/datas';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import {
  type EdicaoItem,
  type FormularioItem,
  iniciarEdicao,
  mudarEdicao,
  nomeDoProgresso,
  temProgresso,
  totalDoItem,
  validarItem,
} from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';
import type { Midia } from '@dominio/tipos';

import { mensagemDeErro } from '../../api/erros';
import { Botao } from '../../componentes/Botao';
import { Modal } from '../../componentes/Camada';
import { AreaTexto, Campo } from '../../componentes/Campo';
import { type ItemLista, useRemoverItem, useSalvarItem } from './api';
import { Alternar } from './editor/Alternar';
import { CampoData } from './editor/CampoData';
import { ContadorRecontagem } from './editor/ContadorRecontagem';
import { textoParaIso } from './editor/datas';
import { EscolhaStatus } from './editor/EscolhaStatus';
import { textos } from './editor/textos';

/** O que o editor lê da Mídia: a da listagem, a do detalhe ou o próprio Item servem. */
export type MidiaDoEditor = Pick<
  Midia,
  'id_midia' | 'tipo' | 'titulo_original' | 'titulo_portugues' | 'numero_episodios' | 'numero_capitulos'
>;

/** O rodapé no lugar dos botões enquanto confirma a remoção do Item. */
function ConfirmarRemocao({ manter, remover, removendo }: { manter(): void; remover(): void; removendo: boolean }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-[14px] text-texto-forte">{textos.confirmacao}</p>
      <div className="flex justify-end gap-3">
        <Botao variante="secundario" onClick={manter}>
          {textos.manter}
        </Botao>
        <Botao onClick={remover} carregando={removendo}>
          {textos.confirmar}
        </Botao>
      </div>
    </div>
  );
}

type Props = { midia: MidiaDoEditor; item: ItemLista | null; fechar(): void };

export function EditorItem({ midia, item, fechar }: Props) {
  const tipo = midia.tipo;
  const total = totalDoItem(item ?? { ...midia, progresso_total: null });
  const [edicao, setEdicao] = useState<EdicaoItem>(() => iniciarEdicao(item, tipo));
  const form = edicao.form;
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const salvar = useSalvarItem();
  const remover = useRemoverItem();
  const hoje = diaIso();

  const mudar = <K extends keyof FormularioItem>(campo: K) => (valor: FormularioItem[K]) =>
    setEdicao((e) => mudarEdicao(e, { [campo]: valor }, { tipo, total }));

  const enviar = async () => {
    const resultado = validarItem(form, { tipo, total });
    if (!resultado.ok) return setErro(resultado.erro);
    const { data_inicio, data_conclusao } = resultado.dados;
    // O calendário já barra o futuro; a data digitada à mão passa por aqui.
    if (data_inicio && data_inicio > hoje) return setErro(textos.futuro(textos.inicio.toLowerCase()));
    if (data_conclusao && data_conclusao > hoje) return setErro(textos.futuro(textos.conclusao.toLowerCase()));
    setErro(null);
    try {
      await salvar.mutateAsync({ idMidia: midia.id_midia, idLista: item?.id_lista, dados: resultado.dados });
      fechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  const confirmarRemocao = async () => {
    if (!item) return;
    setErro(null);
    try {
      await remover.mutateAsync({ idMidia: midia.id_midia, idLista: item.id_lista });
      fechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  const rotuloProgresso =
    temProgresso(tipo) && total !== null ? `${nomeDoProgresso(tipo)} (de ${total})` : nomeDoProgresso(tipo);

  const rodape = confirmando ? (
    <ConfirmarRemocao manter={() => setConfirmando(false)} remover={() => void confirmarRemocao()} removendo={remover.isPending} />
  ) : (
    <>
      {item ? (
        <Botao variante="fantasma" className="mr-auto text-erro" onClick={() => setConfirmando(true)}>
          {textos.remover}
        </Botao>
      ) : null}
      <Botao variante="secundario" onClick={fechar}>
        {textos.cancelar}
      </Botao>
      <Botao onClick={() => void enviar()} carregando={salvar.isPending}>
        {textos.salvar}
      </Botao>
    </>
  );

  return (
    <Modal titulo={tituloDaMidia(midia)} aberto fechar={fechar} rodape={rodape}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <p className="-mt-2 text-[13px] text-texto-suave">
          {item ? textos.editar : textos.adicionar} · {nomeDoTipo(tipo)}
        </p>
        <EscolhaStatus tipo={tipo} valor={form.status_consumo} mudar={mudar('status_consumo')} />
        <div className="grid grid-cols-3 gap-4">
          <Campo rotulo={rotuloProgresso} inputMode="numeric" value={form.progresso} onChange={(e) => mudar('progresso')(e.target.value)} />
          <Campo rotulo={textos.nota} inputMode="decimal" placeholder="0 a 10" value={form.nota} onChange={(e) => mudar('nota')(e.target.value)} />
          <ContadorRecontagem
            tipo={tipo}
            valor={Number(form.recontagem) || 0}
            mudar={(n) => mudar('recontagem')(String(Math.max(0, n)))}
          />
        </div>
        <div className="flex gap-4">
          <CampoData rotulo={textos.inicio} valor={form.inicio} maximo={hoje} mudar={mudar('inicio')} />
          <CampoData
            rotulo={textos.conclusao}
            valor={form.conclusao}
            minimo={textoParaIso(form.inicio)}
            maximo={hoje}
            mudar={mudar('conclusao')}
          />
        </div>
        <div className="flex gap-2">
          <Alternar rotulo={textos.favorito} icone="coracao" ativo={form.favorito} mudar={() => mudar('favorito')(!form.favorito)} />
          <Alternar rotulo={textos.privado} icone="escudo" ativo={form.privado} mudar={() => mudar('privado')(!form.privado)} />
        </div>
        <AreaTexto rotulo={textos.comentario} value={form.comentario} onChange={(e) => mudar('comentario')(e.target.value)} />
        {erro ? (
          <p role="alert" className="text-[14px] text-erro">
            {erro}
          </p>
        ) : null}
        {/* Enter num campo salva. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
