"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Estado local que começa com os dados do servidor e volta a acompanhá-los
 * sempre que o servidor mandar dados novos (por exemplo, ao voltar para a página).
 * No meio do caminho, a tela pode alterar o estado para responder na hora.
 */
export function useServerState<T>(serverValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(serverValue);
  const [previous, setPrevious] = useState(serverValue);
  if (serverValue !== previous) {
    setPrevious(serverValue);
    setValue(serverValue);
  }
  return [value, setValue];
}
