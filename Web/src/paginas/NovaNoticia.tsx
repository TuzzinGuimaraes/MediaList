// Formulário de Notícia do admin, para publicar ou, com `noticia`, editar (Q130). O autor é o
// Usuário logado na publicação e não muda na edição: a API não lê `autor` do corpo.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { CATEGORIAS_NOTICIA } from '@dominio/noticia';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { ErroApi, mensagemDeErro } from '../api/erros';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Modal } from '../componentes/Camada';
import { AreaTexto, Campo } from '../componentes/Campo';
import { Opcoes } from '../componentes/Opcoes';
import { useApi } from '../sessao/SessaoContext';

/** `categoria` é texto: a API aceita qualquer uma, e editar preserva a que não está na lista. */
type Formulario = { titulo: string; conteudo: string; categoria: string; tags: string; imagem_url: string };

const VAZIO: Formulario = { titulo: '', conteudo: '', categoria: 'geral', tags: '', imagem_url: '' };

function formularioDa(n: Esquemas['Noticia']): Formulario {
  return { titulo: n.titulo, conteudo: n.conteudo, categoria: n.categoria, tags: n.tags.join(', '), imagem_url: n.imagem_url ?? '' };
}

/** Corpo do POST e do PUT /noticias: tags separadas por vírgula, campos vazios como null. */
function corpoDaNoticia(f: Formulario): Esquemas['CorpoNoticia'] {
  return {
    titulo: f.titulo.trim(),
    conteudo: f.conteudo.trim() || null,
    categoria: f.categoria,
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    imagem_url: f.imagem_url.trim() || null,
  };
}

type Props = {
  aberto: boolean;
  fechar(): void;
  publicada(): void;
  /** Editar esta Notícia: o formulário vem preenchido e salvar faz o PUT. */
  noticia?: Esquemas['Noticia'];
};

export function NovaNoticia({ aberto, fechar, publicada, noticia }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const inicial = noticia ? formularioDa(noticia) : VAZIO;
  const [form, setForm] = useState<Formulario>(inicial);
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);

  const publicar = useMutation({
    mutationFn: (corpo: Esquemas['CorpoNoticia']) =>
      noticia
        ? exigir(api.PUT('/api/noticias/{id_noticia}', { params: { path: { id_noticia: noticia.id_noticia } }, body: corpo }))
        : exigir(api.POST('/api/noticias', { body: corpo })),
    onSuccess: async () => {
      if (!noticia) setForm(VAZIO);
      await queryClient.invalidateQueries({ queryKey: chaves.noticias.todas });
      publicada();
    },
  });

  const detalhes = publicar.error instanceof ErroApi ? (publicar.error.detalhes ?? {}) : {};
  const erroGeral = publicar.error && !Object.keys(detalhes).length ? mensagemDeErro(publicar.error) : null;
  const idForm = noticia ? `editar-noticia-${noticia.id_noticia}` : 'nova-noticia';
  const mudar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setErroTitulo('Informe o título.');
      return;
    }
    setErroTitulo(null);
    publicar.mutate(corpoDaNoticia(form));
  };

  const sair = () => {
    if (publicar.isPending) return;
    publicar.reset();
    setErroTitulo(null);
    // Editar de novo começa do que está publicado, não do rascunho abandonado.
    if (noticia) setForm(formularioDa(noticia));
    fechar();
  };

  return (
    <Modal
      titulo={noticia ? 'Editar notícia' : 'Nova notícia'}
      aberto={aberto}
      fechar={sair}
      rodape={
        <>
          <Botao variante="secundario" onClick={sair} disabled={publicar.isPending}>
            Cancelar
          </Botao>
          <Botao type="submit" form={idForm} carregando={publicar.isPending}>
            {noticia ? 'Salvar' : 'Publicar'}
          </Botao>
        </>
      }
    >
      <form id={idForm} noValidate onSubmit={enviar} className="flex flex-col gap-4">
        {erroGeral ? (
          <p role="alert" className="rounded-md border border-erro/40 bg-erro/10 p-3 text-[14px] text-erro">
            {erroGeral}
          </p>
        ) : null}
        <Campo
          rotulo="Título"
          value={form.titulo}
          onChange={(e) => mudar('titulo', e.target.value)}
          erro={erroTitulo ?? detalhes.titulo}
          required
        />
        <AreaTexto
          rotulo="Conteúdo"
          value={form.conteudo}
          onChange={(e) => mudar('conteudo', e.target.value)}
          erro={detalhes.conteudo}
          rows={6}
        />
        <Opcoes rotulo="Categoria" opcoes={CATEGORIAS_NOTICIA} valor={form.categoria} mudar={(c) => mudar('categoria', c)} />
        <Campo
          rotulo="Tags"
          dica="Separadas por vírgula: anime, ação"
          value={form.tags}
          onChange={(e) => mudar('tags', e.target.value)}
          erro={detalhes.tags}
        />
        <Campo
          rotulo="URL da imagem"
          type="url"
          placeholder="https://..."
          value={form.imagem_url}
          onChange={(e) => mudar('imagem_url', e.target.value)}
          erro={detalhes.imagem_url}
        />
      </form>
    </Modal>
  );
}
