// PROTÓTIPO: barra de variantes. Visual de ferramenta (amarelo/preto, monoespaçado, como
// nos protótipos anteriores): não faz parte do design avaliado. ←→ troca o valor do eixo
// ativo, ⇧←→ troca o eixo; o estado fica na URL.
import { useEffect, useState } from 'react';

import { type Efetivo, EIXOS, type Eixo, LIGA, NOMES_EIXOS, NOMES_LIGA, opcaoDe, PADRAO, type Variantes } from './variantes';

function digitando(alvo: EventTarget | null) {
  const el = alvo as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function Barra({ v, mudar, ef }: { v: Variantes; mudar(p: Partial<Variantes>): void; ef: Efetivo }) {
  const [aberta, setAberta] = useState(true);
  const [ativo, setAtivo] = useState<Eixo>('nav');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      if (digitando(ev.target) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      const d = ev.key === 'ArrowLeft' ? -1 : 1;
      if (ev.shiftKey) {
        const i = NOMES_EIXOS.indexOf(ativo);
        setAtivo(NOMES_EIXOS[(i + d + NOMES_EIXOS.length) % NOMES_EIXOS.length]!);
        return;
      }
      const ops = EIXOS[ativo].opcoes;
      const i = ops.findIndex((o) => o.chave === v[ativo]);
      mudar({ [ativo]: ops[(i + d + ops.length) % ops.length]!.chave });
    }
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  });

  const resumo = NOMES_EIXOS.map((e) => v[e]).join(' · ');
  const ehPadrao = (Object.keys(PADRAO) as (keyof Variantes)[]).every((k) => PADRAO[k] === v[k]);

  if (!aberta)
    return (
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="fixed bottom-4 left-4 z-[1000] rounded-full border-2 border-black bg-yellow-300 px-3 py-1 font-mono text-[12px] font-bold text-black shadow-[0_6px_24px_rgba(0,0,0,0.5)]"
      >
        PROTÓTIPO · {resumo} ▴
      </button>
    );

  return (
    <div className="fixed bottom-4 left-4 z-[1000] w-[min(560px,calc(100vw-2rem))] rounded-xl border-2 border-black bg-yellow-300 p-2 font-mono text-[12px] leading-snug text-black shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
      <div className="mb-1.5 flex items-center gap-2">
        <b>PROTÓTIPO · Lista</b>
        <span className="opacity-70">←→ valor · ⇧←→ eixo · ★ = padrão</span>
        <span className="ml-auto flex gap-1">
          {ehPadrao ? null : (
            <button type="button" className="rounded border border-black px-1.5 hover:bg-black hover:text-yellow-300" onClick={() => mudar(PADRAO)}>
              padrão
            </button>
          )}
          <button
            type="button"
            className="rounded border border-black px-1.5 hover:bg-black hover:text-yellow-300"
            onClick={() => {
              void navigator.clipboard?.writeText(location.href);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1200);
            }}
          >
            {copiado ? 'copiado' : 'link'}
          </button>
          <button type="button" className="rounded border border-black px-1.5 hover:bg-black hover:text-yellow-300" onClick={() => setAberta(false)}>
            ▾
          </button>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {NOMES_EIXOS.map((e) => {
          const atual = opcaoDe(e, v[e]);
          return (
            <div key={e} onClick={() => setAtivo(e)} className={`rounded-md border border-black px-1.5 py-1 ${e === ativo ? 'bg-black text-yellow-300' : 'bg-yellow-100'}`}>
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-[76px] shrink-0 font-bold">{EIXOS[e].titulo}</span>
                {EIXOS[e].opcoes.map((o) => (
                  <button
                    key={o.chave}
                    type="button"
                    title={`${o.nome}: ${o.porque}`}
                    onClick={() => mudar({ [e]: o.chave })}
                    aria-pressed={v[e] === o.chave}
                    className={`min-w-[26px] rounded border px-1 ${e === ativo ? 'border-yellow-300' : 'border-black'} ${
                      v[e] === o.chave ? (e === ativo ? 'bg-yellow-300 text-black' : 'bg-black text-yellow-300') : 'hover:opacity-60'
                    }`}
                  >
                    {o.chave}
                    {o.chave === EIXOS[e].padrao ? '★' : ''}
                  </button>
                ))}
                <b className="ml-1 truncate">{atual.nome}</b>
              </div>
              <p className="pl-[80px] text-[11px] opacity-80">{atual.porque}</p>
            </div>
          );
        })}
        <div className="flex flex-col gap-0.5 rounded-md border border-black bg-yellow-100 px-1.5 py-1">
          {NOMES_LIGA.map((l) => (
            <label key={l} className="flex cursor-pointer items-start gap-1.5">
              <input type="checkbox" checked={v[l]} onChange={(ev) => mudar({ [l]: ev.target.checked })} className="mt-0.5 accent-black" />
              <span>
                <b>
                  {LIGA[l].titulo}
                  {LIGA[l].padrao ? '★' : ''}
                </b>{' '}
                <span className="text-[11px] opacity-80">{LIGA[l].porque}</span>
              </span>
            </label>
          ))}
        </div>
        {ef.notas.length ? (
          <div className="rounded-md border border-black bg-orange-300 px-1.5 py-1">
            <b>Ajustado:</b>
            <ul className="list-disc pl-4">
              {ef.notas.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
