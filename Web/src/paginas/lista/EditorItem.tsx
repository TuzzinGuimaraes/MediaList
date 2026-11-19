// Editor do Item de lista, em modal. As regras são as do app (`@dominio/itemLista`): Status e
// Progresso andam juntos (ADR 0009) e sair de Concluído devolve o Progresso (ticket 33).
// Datas pelo calendário do navegador, nunca no futuro; Recontagem com − e +.
import { useId, useState } from 'react';

import { diaIso, formatarData } from '@dominio/datas';
import { estadoDe, NOMES_ESTADO, nomeDoTipo, rotulosDoTipo, type TipoMidia } from '@dominio/estadoConsumo';
import {
  type EdicaoItem,
  type FormularioItem,
  iniciarEdicao,
  mudarEdicao,
  nomeDaRecontagem,
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
import { Icone } from '../../componentes/Icone';
import { COR_DO_ESTADO } from '../../componentes/status';
import { type ItemLista, useRemoverItem, useSalvarItem } from './api';

/** O que o editor lê da Mídia: a da listagem, a do detalhe ou o próprio Item servem. */
export type MidiaDoEditor = Pick<
  Midia,
  'id_midia' | 'tipo' | 'titulo_original' | 'titulo_portugues' | 'numero_episodios' | 'numero_capitulos'
>;

const textos = {
  adicionar: 'Adicionar à Lista',
  editar: 'Editar Item da Lista',
  status: 'Status',
  nota: 'Nota pessoal',
  inicio: 'Início',
  conclusao: 'Conclusão',
  limpar: (campo: string) => `Limpar ${campo}`,
  futuro: (campo: string) => `A data de ${campo} não pode ser no futuro.`,
  comentario: 'Comentário',
  favorito: 'Favorito',
  privado: 'Privado',
  salvar: 'Salvar',
  cancelar: 'Cancelar',
  remover: 'Remover',
  confirmacao: 'Remover esta Mídia da sua Lista? Progresso, Nota pessoal e datas serão perdidos.',
  confirmar: 'Remover da Lista',
  manter: 'Manter',
};

/** "dd/mm/aaaa" do formulário ↔ "aaaa-mm-dd" do <input type="date">. */
function paraIso(texto: string): string {
  const [d, m, a] = texto.split('/');
  return texto ? `${a}-${m}-${d}` : '';
}

type PropsData = { rotulo: string; valor: string; minimo?: string; maximo: string; mudar(texto: string): void };

function CampoData({ rotulo, valor, minimo, maximo, mudar }: PropsData) {
  const id = useId();
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-texto-suave">
        {rotulo}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="date"
          value={paraIso(valor)}
          min={minimo || undefined}
          max={maximo}
          onChange={(e) => mudar(formatarData(e.target.value) ?? '')}
          className="w-full rounded-md border border-borda bg-superficie-alta px-3 py-2.5 text-[15px] text-texto-forte outline-none focus:border-marca-texto [color-scheme:light_dark]"
        />
        {valor ? (
          <button
            type="button"
            onClick={() => mudar('')}
            aria-label={textos.limpar(rotulo)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-alta hover:text-texto-forte"
          >
            <Icone nome="fechar" tamanho={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Recontagem com − e + (mínimo 0); na tela, "Reassistido 2×". */
function ContadorRecontagem({ tipo, valor, mudar }: { tipo: TipoMidia; valor: number; mudar(n: number): void }) {
  const nome = nomeDaRecontagem(tipo);
  const botao =
    'flex h-10 w-10 items-center justify-center rounded-full text-texto-forte outline-none hover:bg-superficie focus-visible:ring-2 focus-visible:ring-marca-texto disabled:text-borda';
  return (
    <div role="group" aria-label={nome} className="flex flex-col gap-1.5">
      <span aria-hidden className="text-[13px] font-semibold text-texto-suave">
        {nome}
      </span>
      <div className="flex items-center justify-between rounded-full border border-borda bg-superficie-alta">
        <button type="button" aria-label={`Diminuir ${nome}`} disabled={valor <= 0} onClick={() => mudar(valor - 1)} className={botao}>
          <Icone nome="menos" tamanho={16} />
        </button>
        <span aria-live="polite" aria-label={`${nome}: ${valor}×`} className="font-semibold tabular-nums text-texto-forte">
          {`${valor}×`}
        </span>
        <button type="button" aria-label={`Aumentar ${nome}`} onClick={() => mudar(valor + 1)} className={botao}>
          <Icone nome="mais" tamanho={16} />
        </button>
      </div>
    </div>
  );
}

function Alternar({ rotulo, icone, ativo, mudar }: { rotulo: string; icone: 'coracao' | 'escudo'; ativo: boolean; mudar(): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={mudar}
      className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
        ativo ? 'border-marca-texto text-texto-forte' : 'border-borda text-texto-suave hover:text-texto-forte'
      }`}
    >
      <Icone nome={icone} tamanho={16} cheio={ativo} className={ativo ? 'text-marca-texto' : ''} />
      {rotulo}
    </button>
  );
}

/** Status em pílulas, só os Rótulos válidos para o Tipo (ADR 0002); o escolhido na cor dele. */
function EscolhaStatus({ tipo, valor, mudar }: { tipo: TipoMidia; valor: string; mudar(rotulo: string): void }) {
  const nome = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-texto-suave">{textos.status}</legend>
      <div className="flex flex-wrap gap-1.5">
        {rotulosDoTipo(tipo).map((rotulo) => {
          const estado = estadoDe(rotulo, tipo);
          const ativo = rotulo === valor;
          const cor = estado ? COR_DO_ESTADO[estado] : 'var(--cor-marca-texto)';
          return (
            <label key={rotulo} className="cursor-pointer">
              <input type="radio" name={nome} value={rotulo} checked={ativo} onChange={() => mudar(rotulo)} className="peer sr-only" />
              <span
                className="inline-flex min-h-9 items-center rounded-full border border-borda px-3.5 text-[14px] font-semibold text-texto-suave transition hover:text-texto-forte peer-focus-visible:ring-2 peer-focus-visible:ring-marca-texto"
                style={ativo ? { borderColor: cor, color: cor, background: `color-mix(in srgb, ${cor} 15%, transparent)` } : undefined}
              >
                {estado ? NOMES_ESTADO[estado] : rotulo}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
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
    <div className="flex w-full flex-col gap-3">
      <p className="text-[14px] text-texto-forte">{textos.confirmacao}</p>
      <div className="flex justify-end gap-3">
        <Botao variante="secundario" onClick={() => setConfirmando(false)}>
          {textos.manter}
        </Botao>
        <Botao onClick={() => void confirmarRemocao()} carregando={remover.isPending}>
          {textos.confirmar}
        </Botao>
      </div>
    </div>
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
            minimo={paraIso(form.inicio)}
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
