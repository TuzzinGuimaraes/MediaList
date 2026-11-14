// PagerView de mentira: um View com as páginas. `setPage` avisa `onPageSelected` como o
// nativo faria depois de deslizar; deslizar à mão é `fireEvent(pager, 'pageSelected', ...)`.
import { Component } from 'react';
import { View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  initialPage?: number;
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
};

export default class PagerView extends Component<Props> {
  setPage = (pagina: number) => this.props.onPageSelected?.({ nativeEvent: { position: pagina } });
  setPageWithoutAnimation = this.setPage;
  setScrollEnabled = () => {};
  render() {
    return <View {...this.props} />;
  }
}
