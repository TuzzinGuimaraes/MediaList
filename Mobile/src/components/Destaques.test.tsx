import { act, renderHook } from '@testing-library/react-native';

import { INTERVALO_DESTAQUES_MS, useTrocaAutomatica } from './Destaques';

describe('useTrocaAutomatica', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a cada intervalo pede a página seguinte e, da última, volta à primeira', async () => {
    const trocar = jest.fn();
    const { rerender } = await renderHook((pagina: number) => useTrocaAutomatica(pagina, 3, true, trocar), {
      initialProps: 2,
    });

    await act(() => jest.advanceTimersByTime(INTERVALO_DESTAQUES_MS - 1));
    expect(trocar).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(trocar).toHaveBeenCalledWith(0);

    // Trocar de página (sozinho ou à mão) recomeça a contagem.
    await rerender(0);
    await act(() => jest.advanceTimersByTime(INTERVALO_DESTAQUES_MS));
    expect(trocar).toHaveBeenLastCalledWith(1);
  });

  it('parada (toque, arrasto ou "reduzir movimento") ou com uma página só, não troca', async () => {
    const trocar = jest.fn();
    await renderHook(() => useTrocaAutomatica(0, 3, false, trocar));
    await renderHook(() => useTrocaAutomatica(0, 1, true, trocar));

    await act(() => jest.advanceTimersByTime(INTERVALO_DESTAQUES_MS * 3));
    expect(trocar).not.toHaveBeenCalled();
  });
});
