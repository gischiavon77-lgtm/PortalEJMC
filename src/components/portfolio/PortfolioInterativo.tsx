'use client';

import { useState } from 'react';

// ─── Data Types ────────────────────────────────────────────────────────────────

interface Service {
  name: string;
  description: string;
  objective: string;
  macroSteps: string[];
  modules?: string[];
}

interface Area {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  services: Service[];
}

// ─── Portfolio Data ────────────────────────────────────────────────────────────

const AREAS: Area[] = [
  {
    id: 'marketing',
    name: 'MARKETING',
    emoji: '🦅',
    gradient: 'from-purple-500 to-purple-700',
    services: [
      {
        name: 'Plano de Marketing',
        description:
          'Documento estratégico que organiza os caminhos da comunicação e posicionamento de marca.',
        objective: 'Criar um plano alinhado com a identidade e metas do negócio.',
        macroSteps: [
          'Briefing / Diagnóstico',
          'Pesquisa de mercado',
          'Definição de persona',
          'Estratégias e canais',
          'Cronograma de ações',
          'Entrega final',
        ],
      },
      {
        name: 'Social Media',
        description: 'Gestão de redes sociais com foco em posicionamento e engajamento.',
        objective: 'Fortalecer a presença digital e gerar conexão com o público.',
        macroSteps: [
          'Briefing',
          'Planejamento de conteúdo',
          'Produção visual e textual',
          'Publicação programada',
          'Relatório de métricas',
        ],
      },
      {
        name: 'Identidade Visual',
        description: 'Criação de logo, tipografia, cores e linguagem da marca.',
        objective: 'Traduzir a essência da empresa num sistema visual memorável.',
        macroSteps: [
          'Briefing criativo',
          'Pesquisa de referências',
          'Geração de conceitos',
          'Refinamento',
          'Manual de marca',
        ],
      },
      {
        name: 'Design Editorial / Apresentação',
        description: 'Design de pitch-decks, portfólios, catálogos e documentos corporativos.',
        objective: 'Comunicar ideias com impacto visual e clareza.',
        macroSteps: [
          'Briefing',
          'Estrutura do documento',
          'Design de layouts',
          'Revisão / ajustes',
          'Entrega',
        ],
      },
    ],
  },
  {
    id: 'projetos',
    name: 'PROJETOS',
    emoji: '🐙',
    gradient: 'from-orange-500 to-orange-700',
    services: [
      {
        name: 'Site Institucional',
        description: 'Site com páginas informativas e responsivo.',
        objective: 'Apresentar a empresa no digital com profissionalismo.',
        macroSteps: [
          'Briefing',
          'Wireframe',
          'Design UI',
          'Desenvolvimento front-end',
          'Publicação',
        ],
        modules: ['Multi-páginas', 'Blog', 'Formulários', 'Integrações', 'CMS'],
      },
      {
        name: 'Landing Page',
        description: 'Página única com foco em conversão.',
        objective: 'Converter visitantes em leads ou vendas.',
        macroSteps: ['Briefing', 'Copywriting', 'Design', 'Desenvolvimento', 'Teste A/B'],
        modules: ['Formulário', 'CTA', 'Métricas', 'Pixel de rastreamento'],
      },
      {
        name: 'E-commerce',
        description: 'Loja virtual completa com catálogo, carrinho e checkout.',
        objective: 'Vender produtos ou serviços online com autonomia.',
        macroSteps: [
          'Briefing',
          'Arquitetura da loja',
          'Design UI',
          'Integração de pagamento',
          'Publicação',
        ],
        modules: ['Catálogo', 'Carrinho', 'Checkout', 'Painel Admin', 'Integrações logísticas'],
      },
      {
        name: 'Sistema / App Web',
        description: 'Aplicações sob medida para resolver problemas específicos.',
        objective: 'Automatizar ou digitalizar processos com software personalizado.',
        macroSteps: [
          'Levantamento de requisitos',
          'Prototipação',
          'Desenvolvimento',
          'Testes',
          'Deploy',
        ],
        modules: ['Auth', 'Dashboard', 'APIs', 'Banco de dados', 'Deploy'],
      },
      {
        name: 'Automação',
        description: 'Integração de ferramentas, bots, fluxos automatizados.',
        objective: 'Eliminar tarefas repetitivas e acelerar processos.',
        macroSteps: [
          'Mapeamento de processos',
          'Definição de gatilhos',
          'Implementação',
          'Monitoramento',
        ],
      },
    ],
  },
  {
    id: 'adm-fin',
    name: 'ADM-FIN',
    emoji: '🦁',
    gradient: 'from-yellow-500 to-amber-600',
    services: [
      {
        name: 'Planejamento Financeiro',
        description: 'Projeção de receitas, custos e ponto de equilíbrio.',
        objective: 'Dar clareza sobre a viabilidade do negócio.',
        macroSteps: [
          'Levantamento de dados',
          'Projeção de cenários',
          'Análise de viabilidade',
          'Relatório final',
        ],
      },
      {
        name: 'Pricing / Precificação',
        description: 'Definição de preços baseada em custos, mercado e percepção de valor.',
        objective: 'Encontrar o preço ideal para maximizar lucro e competitividade.',
        macroSteps: [
          'Análise de custos',
          'Pesquisa de mercado',
          'Modelagem de preço',
          'Recomendação final',
        ],
      },
      {
        name: 'Estruturação Financeira',
        description: 'Organização de fluxo de caixa, DRE e controles internos.',
        objective: 'Criar bases sólidas para decisões financeiras.',
        macroSteps: ['Diagnóstico atual', 'Modelagem', 'Implementação', 'Treinamento'],
      },
    ],
  },
  {
    id: 'vendas',
    name: 'VENDAS',
    emoji: '🦈',
    gradient: 'from-teal-400 to-teal-600',
    services: [
      {
        name: 'Pesquisa de Mercado',
        description: 'Estudo do segmento, público, concorrentes.',
        objective: 'Gerar dados para decisões estratégicas.',
        macroSteps: ['Definição do escopo', 'Coleta de dados', 'Análise', 'Relatório'],
      },
      {
        name: 'Diagnóstico de Negócio',
        description: 'Avaliação 360° das áreas do negócio.',
        objective: 'Identificar pontos fortes e gargalos.',
        macroSteps: ['Entrevista', 'Análise interna', 'Benchmarking', 'Plano de ação'],
      },
      {
        name: 'CRM',
        description: 'Implementação de sistemas de gestão de relacionamento com clientes.',
        objective: 'Organizar a jornada do lead ao cliente.',
        macroSteps: ['Mapeamento', 'Escolha de ferramenta', 'Configuração', 'Treinamento'],
      },
      {
        name: 'Canvas e Modelagem de Negócio',
        description: 'Framework visual para estruturar ou pivotar modelos de negócio.',
        objective: 'Organizar proposta de valor, canais, receitas e parcerias num único quadro.',
        macroSteps: ['Workshop', 'Preenchimento', 'Validação', 'Iteração'],
      },
    ],
  },
  {
    id: 'gestao-pessoas',
    name: 'GESTÃO DE PESSOAS',
    emoji: '🐬',
    gradient: 'from-sky-400 to-sky-600',
    services: [
      {
        name: 'Plano de Cargos e Salários',
        description: 'Estruturação de níveis, faixas salariais e critérios de promoção.',
        objective: 'Criar equidade e transparência na remuneração.',
        macroSteps: [
          'Mapeamento de cargos',
          'Pesquisa salarial',
          'Definição de faixas',
          'Documento final',
        ],
      },
      {
        name: 'PDI (Plano de Desenvolvimento Individual)',
        description: 'Ferramenta de acompanhamento de crescimento dos colaboradores.',
        objective: 'Alinhar desenvolvimento pessoal com metas da empresa.',
        macroSteps: ['Diagnóstico', 'Definição de metas', 'Cronograma', 'Acompanhamento'],
      },
      {
        name: 'Pesquisa de Clima Organizacional',
        description: 'Medição de satisfação e engajamento interno.',
        objective: 'Entender o sentimento do time e direcionar melhorias.',
        macroSteps: ['Elaboração do questionário', 'Aplicação', 'Análise', 'Plano de ação'],
      },
      {
        name: 'Processo Seletivo',
        description: 'Estruturação e execução de recrutamento e seleção.',
        objective: 'Atrair e selecionar talentos alinhados à cultura.',
        macroSteps: ['Job description', 'Divulgação', 'Triagem', 'Entrevistas', 'Decisão'],
      },
    ],
  },
  {
    id: 'presidencia',
    name: 'PRESIDÊNCIA',
    emoji: '🐘',
    gradient: 'from-red-800 to-red-950',
    services: [
      {
        name: 'Planejamento Estratégico',
        description: 'Definição de visão, missão, valores, OKRs e roadmap.',
        objective: 'Alinhar toda a organização em torno de metas claras.',
        macroSteps: [
          'Diagnóstico',
          'Definição de missão e visão',
          'OKRs',
          'Roadmap',
          'Alinhamento',
        ],
      },
      {
        name: 'Mentoria Empresarial',
        description: 'Acompanhamento próximo com foco em decisões estratégicas.',
        objective: 'Acelerar resultados com experiência direcionada.',
        macroSteps: ['Mapeamento', 'Sessões periódicas', 'Feedbacks', 'Ajustes'],
      },
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export function PortfolioInterativo() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<number | null>(null);

  const area = selectedArea ? AREAS.find((a) => a.id === selectedArea) : null;
  const service = area && selectedService !== null ? area.services[selectedService] : null;

  // ── Service Detail View ──────────────────────────────────────────────────────
  if (area && service !== null && selectedService !== null) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => setSelectedService(null)}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <span aria-hidden="true">←</span> Voltar
          </button>

          {/* Header */}
          <div
            className={`mb-8 rounded-2xl bg-gradient-to-br ${area.gradient} p-6 text-white shadow-lg`}
          >
            <p className="mb-1 text-sm font-medium uppercase tracking-wide opacity-80">
              {area.emoji} {area.name}
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">{service.name}</h1>
          </div>

          {/* Description */}
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Descrição</h2>
            <p className="text-gray-600">{service.description}</p>
          </section>

          {/* Objective */}
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Objetivo</h2>
            <p className="text-gray-600">{service.objective}</p>
          </section>

          {/* Macro Steps — Timeline */}
          <section className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Macroetapas</h2>
            <ol className="relative border-l-2 border-gray-200 pl-6">
              {service.macroSteps.map((step, i) => (
                <li key={i} className="relative mb-6 last:mb-0">
                  <span
                    className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${area.gradient} text-xs font-bold text-white shadow`}
                  >
                    {i + 1}
                  </span>
                  <p className="text-gray-700">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Modules */}
          {service.modules && service.modules.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-800">Módulos</h2>
              <div className="flex flex-wrap gap-2">
                {service.modules.map((mod, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center rounded-full bg-gradient-to-r ${area.gradient} px-3 py-1 text-xs font-medium text-white shadow-sm`}
                  >
                    {mod}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ── Area Services View ───────────────────────────────────────────────────────
  if (area) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => {
              setSelectedArea(null);
              setSelectedService(null);
            }}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <span aria-hidden="true">←</span> Voltar ao mapa
          </button>

          {/* Area Header */}
          <div
            className={`mb-8 rounded-2xl bg-gradient-to-br ${area.gradient} p-6 text-white shadow-lg`}
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">{area.emoji}</span>
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">{area.name}</h1>
                <p className="text-sm opacity-80">
                  {area.services.length} serviço{area.services.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Services List */}
          <div className="grid gap-4 sm:grid-cols-2">
            {area.services.map((svc, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedService(idx)}
                className="group rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                <h3 className="mb-1 text-lg font-semibold text-gray-800 group-hover:text-gray-900">
                  {svc.name}
                </h3>
                <p className="line-clamp-2 text-sm text-gray-500">{svc.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Map View (default) ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-800 sm:text-4xl">Portfólio de Serviços</h1>
          <p className="mt-2 text-gray-500">Clique em uma área para explorar nossos serviços</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AREAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedArea(a.id)}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradient} p-6 text-left text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              <span className="absolute right-4 top-4 text-5xl opacity-30 transition-transform group-hover:scale-110">
                {a.emoji}
              </span>
              <div className="relative z-10">
                <h2 className="text-xl font-bold">{a.name}</h2>
                <p className="mt-1 text-sm opacity-80">
                  {a.services.length} serviço{a.services.length !== 1 ? 's' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
