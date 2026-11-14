import { Text, View } from 'react-native';

/** Cabeçalho de seção: legenda em caixa alta, espaçada. */
export function TituloSecao({ children, className = '' }: { children: string; className?: string }) {
  return (
    <Text accessibilityRole="header" className={`text-legenda font-bold uppercase tracking-wider text-texto-suave ${className}`}>
      {children}
    </Text>
  );
}

/** Bloco em superfície com o cabeçalho de seção no topo. */
export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-md bg-superficie p-4">
      <TituloSecao>{titulo}</TituloSecao>
      {children}
    </View>
  );
}
