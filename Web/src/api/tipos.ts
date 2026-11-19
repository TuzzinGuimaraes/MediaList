// Tipos da API, gerados do Backend (ADR 0011). Nada aqui é escrito à mão: mudou a API,
// `make api-tipos` regera `contrato/api.d.ts`.
import type { components, paths } from '../../../contrato/api';

export type Caminhos = paths;
export type Esquemas = components['schemas'];

export type UsuarioDaSessao = Esquemas['UsuarioDaSessao'];
export type NivelAcesso = Esquemas['Permissoes']['nivel_acesso'];
export type CodigoErro = Esquemas['CodigoErro'];
export type EnvelopeErro = Esquemas['Erro'];
