import {
  Dispatch,
  useEffect,
  useState,
  SetStateAction,
  useCallback,
} from 'react';
import {
  getBrowserStorageValue,
  setBrowserStorageValue,
  Store,
} from './storage';
import { deepEqual } from './utils/deepEqual';

export function useBrowserStorageState<K extends keyof Store>(
  key: K,
  initialValue: Store[K]
): [Store[K], Dispatch<SetStateAction<Store[K]>>, boolean] {
  const [state, setState] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getBrowserStorageState() {
      setIsLoading(true);
      const value = await getBrowserStorageValue(key);

      value !== undefined &&
        setState((prevState) =>
          deepEqual(prevState, value) ? prevState : value
        );
    }

    getBrowserStorageState()
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [key]);

  const setBrowserStorageState = useCallback(
    (value: SetStateAction<Store[K]>) =>
      setState((prevState) => {
        const newValue =
          typeof value === 'function'
            ? (value as (prev: Store[K]) => Store[K])(prevState)
            : value;
        setBrowserStorageValue(key, newValue);
        return newValue;
      }),
    [key]
  );

  return [state, setBrowserStorageState, isLoading];
}
