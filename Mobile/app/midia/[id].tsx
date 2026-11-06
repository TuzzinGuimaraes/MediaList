import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

export default function DetalheMidia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Text>{id}</Text>;
}
