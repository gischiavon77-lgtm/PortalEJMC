/**
 * `cn` — utilitário interno do `components/ui` para juntar classes
 * condicionais sem trazer dependência extra (clsx/cva).
 *
 * Aceita strings, valores `false`/`null`/`undefined` (ignorados) e
 * arrays/objetos simples — nas formas mais usadas pelos componentes
 * deste pacote. Mantemos a implementação enxuta e sem export default
 * para combinar com o estilo named-exports do projeto.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  function push(value: ClassValue) {
    if (!value && value !== 0) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) push(v);
      return;
    }
    if (typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (value[key]) out.push(key);
      }
    }
  }

  for (const input of inputs) push(input);
  return out.join(' ');
}
