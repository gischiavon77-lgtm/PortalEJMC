/**
 * Fundo das telas públicas (login, cadastro).
 *
 * A identidade atual pede fundo chapado quase preto, sem degradês, formas
 * animadas ou efeito de vidro. Este componente ficou reduzido a uma camada
 * fixa na cor de fundo; continua existindo para que o layout `(auth)`
 * tenha um único ponto de troca caso o fundo volte a ter algum elemento.
 */
export function AuthBackground() {
  return <div className="fixed inset-0 -z-10 bg-bg" aria-hidden="true" />;
}
