// Formulário de Notícia do admin. O autor é o Usuário logado: a API não lê `autor` do corpo.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { CATEGORIAS_NOTICIA, type CategoriaNoticia } from '@dominio/noticia';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { ErroApi, mensagemDeErro } from '../api/erros';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Modal } from '../componentes/Camada';
import { AreaTexto, Campo } from '../componentes/Campo';
import { Opcoes } from '../componentes/Opcoes';
import { useApi } from '../sessao/SessaoContext';

type Formulario = { titulo: string; conteudo: string; categoria: CategoriaNoticia; tags: string; imagem_url: string };

const VAZIO: Formulario = { titulo: '', conteudo: '', categoria: 'geral', tags: '', imagem_url: '' };

/** Corpo do POST /noticias: tags separadas por vírgula, campos vazios como null. */
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

type Props = { aberto: boolean; fechar(): void; publicada(): void };

export function NovaNoticia({ aberto, fechar, publicada }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);

  const publicar = useMutation({
    mutationFn: (corpo: Esquemas['CorpoNoticia']) => exigir(api.POST('/api/noticias', { body: corpo })),
    onSuccess: async () => {
      setForm(VAZIO);
      await queryClient.invalidateQueries({ queryKey: chaves.noticias.todas });
      publicada();
    },
  });

  const detalhes = publicar.error instanceof ErroApi ? (publicar.error.detalhes ?? {}) : {};
  const erroGeral = publicar.error && !Object.keys(detalhes).length ? mensagemDeErro(publicar.error) : null;
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
    fechar();
  };

  return (
    <Modal
      titulo="Nova notícia"
      aberto={aberto}
      fechar={sair}
      rodape={
        <>
          <Botao variante="secundario" onClick={sair} disabled={publicar.isPending}>
            Cancelar
          </Botao>
          <Botao type="submit" form="nova-noticia" carregando={publicar.isPending}>
            Publicar
          </Botao>
        </>
      }
    >
      <form id="nova-noticia" noValidate onSubmit={enviar} className="flex flex-col gap-4">
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
