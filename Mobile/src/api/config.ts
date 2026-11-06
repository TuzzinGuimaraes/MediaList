import Constants from 'expo-constants';

const PORTA_API = 5000;

/**
 * URL base da API. `EXPO_PUBLIC_API_URL` vence; sem ela, em desenvolvimento, usa o host
 * do Metro (o IP da máquina na rede local, o mesmo que o Expo Go já alcança) na porta 5000.
 * Em build de produção a variável é obrigatória.
 */
export function resolverUrlApi(
  urlDoAmbiente: string | undefined,
  hostUri: string | undefined,
  desenvolvimento: boolean,
): string {
  if (urlDoAmbiente) return urlDoAmbiente.replace(/\/+$/, '');
  if (!desenvolvimento) {
    throw new Error('EXPO_PUBLIC_API_URL é obrigatória em build de produção.');
  }
  const host = hostUri ? hostUri.split(':')[0] : 'localhost';
  return `http://${host}:${PORTA_API}/api`;
}

export function urlApi(): string {
  return resolverUrlApi(
    process.env.EXPO_PUBLIC_API_URL,
    Constants.expoConfig?.hostUri ?? undefined,
    __DEV__,
  );
}
