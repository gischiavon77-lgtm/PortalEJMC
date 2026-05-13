/**
 * `AuthBackground` — cena escura compartilhada das páginas públicas
 * (Task 5.7).
 *
 * Server Component (sem `'use client'`, sem props) que encapsula a
 * "cena" visual herdada do `login.html` original e replicada nas
 * Tasks 3.8 (`/login`), 3.9 (`/cadastro`) e 4.7 (`/403`):
 *
 *   - `.scene` (container absoluto que cobre toda a viewport).
 *   - 4 blobs animados (`.blob.blob-{1..4}`).
 *   - SVG orgânico com curvas de Bezier vermelhas + duas elipses
 *     translúcidas (mesmas coordenadas/cores do design original para
 *     manter paridade visual pixel-a-pixel).
 *   - Camada de grão (`.grain`) e light leak (`.light-leak`).
 *
 * Todas as classes utilitárias (`scene`, `blob`, `organic-svg`,
 * `grain`, `light-leak`) já estão definidas em
 * `src/app/globals.css` (Task 1.6) — este componente apenas as
 * compõe.
 *
 * Acessibilidade:
 *   - O contêiner raiz recebe `aria-hidden="true"` porque a cena é
 *     puramente decorativa e não contém informação relevante para
 *     leitores de tela.
 *
 * Uso esperado:
 *   - Renderizado uma única vez por `(auth)/layout.tsx` (Task 5.7),
 *     atrás do conteúdo das páginas `/login` e `/cadastro`.
 *   - Pode ser reutilizado por outras páginas públicas que precisem
 *     da mesma estética (ex.: `/403` em iterações futuras).
 *
 * O componente não recebe props porque a cena é determinística e
 * deve permanecer idêntica em todas as páginas que a consomem
 * (consistência visual exigida pelas Tasks 3.8 e 3.9).
 */
export function AuthBackground() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />

      <svg
        className="organic-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-80,200 C100,100 300,350 500,200 S800,50 1000,200 S1300,400 1520,250"
          stroke="#c0182e"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M0,500 C200,380 400,600 600,480 S900,350 1100,500 S1350,650 1520,520"
          stroke="#e8203a"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M200,750 C350,680 550,800 700,720 S950,600 1150,750 S1380,850 1520,780"
          stroke="#7a1220"
          strokeWidth="2"
          fill="none"
          opacity="0.4"
        />
        <ellipse
          cx="200"
          cy="150"
          rx="300"
          ry="180"
          fill="#7a1220"
          opacity="0.12"
          transform="rotate(-15,200,150)"
        />
        <ellipse
          cx="1200"
          cy="720"
          rx="280"
          ry="160"
          fill="#c0182e"
          opacity="0.1"
          transform="rotate(10,1200,720)"
        />
      </svg>

      <div className="grain" />
      <div className="light-leak" />
    </div>
  );
}
