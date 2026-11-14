import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Fundo escuro, área segura e rolagem com teclado: a moldura dos formulários. */
export function TelaFormulario({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-fundo">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-4 p-6"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
