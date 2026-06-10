'use client';

import { useState } from 'react';

// ─── Data Types ────────────────────────────────────────────────────────────────

interface Service {
  name: string;
  description: string;
  objective: string;
  macroSteps: string[];
  modules?: string[];
  subServices?: { name: string; steps: string[] }[];
}

interface Area {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  description: string;
  services: Service[];
}

// ─── Portfolio Data ────────────────────────────────────────────────────────────

const AREAS: Area[] = [
  {
    id: 'marketing',
    name: 'MARKETING',
    emoji: '📢',
    gradient: 'from-pink-500 to-rose-600',
    description:
      'Construir posicionamento, comunicação e ativos de marca que gerem reconhecimento e aquisição de clientes.',
    services: [
      {
        name: 'Branding Innovation',
        description: 'Criação completa da identidade e posicionamento de marca.',
        objective: 'Construir uma marca forte, memorável e estrategicamente posicionada.',
        macroSteps: [
          'Imersão e diagnóstico',
          'Posicionamento e estratégia de marca',
          'Criação da identidade visual',
          'Sistema e manual de marca',
          'Finalização e entrega do projeto',
        ],
      },
      {
        name: 'Marketing Estratégico',
        description: 'Estratégia de comunicação digital com posicionamento e conteúdo.',
        objective: 'Fortalecer a presença digital com estratégia e consistência.',
        macroSteps: [
          'Inicialização do projeto',
          'Diagnóstico digital e de mercado',
          'Posicionamento e diretrizes de comunicação',
          'Estratégia de conteúdo e calendário editorial',
          'Modelos de postagem e guia estratégico',
          'Finalização e entrega do projeto',
        ],
        modules: ['Análise de Desempenho Digital'],
      },
      {
        name: 'Plano de Marketing Digital',
        description: 'Solução completa integrando branding, conteúdo e execução digital.',
        objective: 'Entregar um sistema completo de marca e comunicação digital.',
        macroSteps: [
          'Inicialização do projeto',
          'Diagnóstico integrado',
          'Estratégia e posicionamento de marca',
          'Criação da identidade visual',
          'Sistema e manual de marca',
          'Estratégia de conteúdo e calendário editorial',
          'Modelos de postagem e guia de execução enriquecido',
          'Brandbook integrado e entrega final enriquecido',
        ],
        modules: ['Análise de Desempenho Digital'],
      },
      {
        name: 'Apresentação Estratégica',
        description: 'Design de apresentações com estrutura estratégica e impacto visual.',
        objective: 'Comunicar ideias com clareza e poder de persuasão.',
        macroSteps: [
          'Inicialização e definição de escopo',
          'Diagnóstico e coleta de conteúdo',
          'Estruturação estratégica do conteúdo',
          'Produção e refinamento',
          'Entrega e orientações de uso',
        ],
      },
    ],
  },
  {
    id: 'inteligencia-mercado',
    name: 'INTELIGÊNCIA DE MERCADO',
    emoji: '🔍',
    gradient: 'from-blue-500 to-indigo-600',
    description: 'Reduzir incertezas através de dados sobre consumidores, concorrentes e mercado.',
    services: [
      {
        name: 'Pesquisa de Mercado',
        description: 'Coleta e análise de dados primários e secundários sobre o mercado.',
        objective: 'Gerar insights acionáveis para decisões estratégicas.',
        macroSteps: [
          'Etapa de Inicialização',
          'Estruturação da Pesquisa',
          'Coleta e Análise de Dados',
          'Etapa de Finalização',
        ],
        modules: ['Grupos Focais'],
      },
      {
        name: 'Análise Concorrencial',
        description: 'Estudo profundo dos concorrentes e posicionamento competitivo.',
        objective: 'Entender o cenário competitivo e encontrar diferenciais.',
        macroSteps: [
          'Etapa de Inicialização',
          'Definição de Objetivos e Critérios',
          'Mapeamento de Concorrentes',
          'Análise dos 4Ps',
          'Análise S.W.O.T',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Análise Setorial',
        description: 'Panorama completo do setor com estrutura competitiva e cenários.',
        objective: 'Compreender a dinâmica do setor e antecipar movimentos.',
        macroSteps: [
          'Etapa de Inicialização',
          'Introdução e Contexto Setorial',
          'Estrutura e Competitividade do Setor',
          'Conduta e Segmentação',
          'Perspectivas, Riscos e Cenários',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Geomarketing',
        description: 'Análise geográfica para decisões de localização e expansão.',
        objective: 'Identificar as melhores localizações e estratégias regionais.',
        macroSteps: [
          'Etapa de Inicialização',
          'Coleta e Tratamento de Dados',
          'Análise de Zona de Influência e Segmentação',
          'Mapeamento de Concorrentes, Oportunidades e Riscos',
          'Modelagem de Cenários e Priorização de Localizações',
          'Estratégias de Segmentação e Marketing Geográfico',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Estudo de Mercado',
        description: 'Estudo completo combinando dados secundários, primários e análise setorial.',
        objective: 'Fornecer uma visão 360° do mercado para tomada de decisão.',
        macroSteps: [
          'Etapa de Inicialização',
          'Coleta de Dados Secundários',
          'Pesquisa de Mercado (Dados Primários)',
          'Análise Setorial e Macroambiente',
          'Segmentação e Comportamento do Cliente',
          'Análise Concorrencial',
          'Mapeamento de Tendências',
          'Síntese de Oportunidades e Estratégias',
          'Etapa de Finalização',
        ],
      },
    ],
  },
  {
    id: 'operacoes',
    name: 'OPERAÇÕES',
    emoji: '⚙️',
    gradient: 'from-emerald-500 to-green-600',
    description: 'Estruturar processos, pessoas e organização para crescimento sustentável.',
    services: [
      {
        name: 'Mapeamento de Processos',
        description: 'Documentação e otimização de processos operacionais.',
        objective: 'Criar eficiência e escalabilidade nos processos internos.',
        macroSteps: [
          'Etapa de Inicialização',
          'Levantamento e Coleta de Informações',
          'Mapeamento e Documentação dos Processos',
          'Análise e Diagnóstico Operacional',
          'Redesenho e Otimização dos Processos',
          'Etapa de Finalização',
        ],
        modules: ['Pesquisa de Clima Organizacional'],
      },
      {
        name: 'Mapeamento de Profissionais',
        description: 'Hunting e qualificação de talentos para posições estratégicas.',
        objective: 'Encontrar os melhores profissionais alinhados à cultura.',
        macroSteps: [
          'Etapa de Inicialização',
          'Mapeamento e Hunting de Profissionais',
          'Triagem e Qualificação dos Perfis',
          'Estruturação do Dossiê e Pipeline',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Plano de Salários',
        description: 'Estruturação de política salarial com faixas e benefícios.',
        objective: 'Criar equidade remuneratória e atratividade.',
        macroSteps: [
          'Etapa de Inicialização',
          'Benchmarking de Remuneração',
          'Construção das Faixas Salariais',
          'Modelo de Remuneração Variável',
          'Estruturação de Benefícios',
          'Etapa de Finalização',
        ],
        modules: ['Pesquisa Salarial Customizada'],
      },
    ],
  },
  {
    id: 'tech',
    name: 'TECH',
    emoji: '💻',
    gradient: 'from-violet-500 to-purple-700',
    description: 'Transformar tecnologia e dados em vantagem competitiva.',
    services: [
      {
        name: 'Base de Dados',
        description: 'Criação, otimização ou migração de bases de dados.',
        objective: 'Garantir dados confiáveis, organizados e acessíveis.',
        macroSteps: [],
        subServices: [
          {
            name: 'Criação e Modelagem',
            steps: [
              'Diagnóstico de Dados',
              'Modelagem da Estrutura',
              'Implementação da Base',
              'Validação e Treinamento',
            ],
          },
          {
            name: 'Otimização',
            steps: [
              'Diagnóstico da Base Atual',
              'Plano de Correção',
              'Limpeza e Reestruturação',
              'Entrega e Governança',
            ],
          },
          {
            name: 'Migração',
            steps: [
              'Mapeamento de Origem e Destino',
              'Preparação e Limpeza',
              'Execução da Migração',
              'Conferência e Handoff',
            ],
          },
        ],
      },
      {
        name: 'Indicadores e Business Intelligence',
        description: 'Dashboards, KPIs e automação de relatórios baseados em dados.',
        objective: 'Transformar dados em decisões inteligentes.',
        macroSteps: [],
        subServices: [
          {
            name: 'Desenvolvimento de Dashboards',
            steps: [
              'Diagnóstico Analítico',
              'Desenho dos Indicadores',
              'Construção do Dashboard',
              'Validação e Treinamento',
            ],
          },
          {
            name: 'Definição de KPIs',
            steps: [
              'Entendimento Estratégico',
              'Mapeamento de Processos e Dados',
              'Desenho dos KPIs',
              'Governança de Indicadores',
            ],
          },
          {
            name: 'Automação de Relatórios',
            steps: [
              'Mapeamento da Rotina Atual',
              'Desenho da Automação',
              'Implementação da Automação',
              'Testes e Handoff',
            ],
          },
        ],
      },
      {
        name: 'Desenvolvimento Web',
        description: 'Sites institucionais e landing pages de alta conversão.',
        objective: 'Presença digital profissional e orientada a resultados.',
        macroSteps: [],
        subServices: [
          {
            name: 'Site Institucional',
            steps: [
              'Briefing e Arquitetura',
              'UX e Wireframe',
              'Design e Desenvolvimento',
              'Publicação e Treinamento',
            ],
          },
          {
            name: 'Landing Page',
            steps: [
              'Briefing de Conversão',
              'Estrutura Persuasiva',
              'Design e Implementação',
              'Medição e Entrega',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'estrategia',
    name: 'ESTRATÉGIA DE NOVOS NEGÓCIOS',
    emoji: '🚀',
    gradient: 'from-amber-500 to-orange-600',
    description: 'Transformar ideias em negócios viáveis e escaláveis.',
    services: [
      {
        name: 'Viabilidade de Negócios',
        description: 'Análise completa de viabilidade de mercado, operacional e econômica.',
        objective: 'Validar se uma ideia de negócio é viável antes de investir.',
        macroSteps: [
          'Etapa de Inicialização',
          'Análise de Viabilidade de Mercado',
          'Análise de Viabilidade Operacional',
          'Análise de Viabilidade Econômica',
          'Síntese e Recomendação Estratégica',
          'Etapa de Finalização',
        ],
        subServices: [
          {
            name: 'Viabilidade de Mercado (módulo individual)',
            steps: [
              'Entendimento do Mercado',
              'Análise de Demanda',
              'Análise Competitiva',
              'Síntese de Mercado',
            ],
          },
          {
            name: 'Viabilidade Operacional (módulo individual)',
            steps: [
              'Mapeamento da Operação',
              'Processos e Recursos',
              'Riscos Operacionais',
              'Síntese Operacional',
            ],
          },
          {
            name: 'Viabilidade Econômica (módulo individual)',
            steps: [
              'Premissas Financeiras',
              'Modelagem Econômica',
              'Indicadores de Retorno',
              'Síntese Econômica',
            ],
          },
        ],
      },
      {
        name: 'Plano de Negócios',
        description: 'Documento completo para estruturar e apresentar um negócio.',
        objective: 'Criar um roadmap completo do negócio para execução ou investidores.',
        macroSteps: [
          'Etapa de Inicialização',
          'Estudo de Mercado',
          'Modelo de Negócio e Proposta de Valor',
          'Estratégia de Marketing e Posicionamento',
          'Estruturação de Processos e Modelo Operacional',
          'Modelagem Financeira',
          'Plano de Implementação',
          'Etapa de Finalização',
        ],
        modules: ['Pitch Deck para Investidores'],
      },
      {
        name: 'Estruturação Comercial e CRM',
        description: 'Planejamento comercial completo com implementação de CRM.',
        objective: 'Profissionalizar a operação de vendas e gestão de clientes.',
        macroSteps: [
          'Etapa de Inicialização',
          'Diagnóstico e Mapeamento Comercial',
          'Planejamento Estratégico Comercial',
          'Implementação e Configuração do CRM',
          'Treinamento e Dashboards',
          'Etapa de Finalização',
        ],
      },
    ],
  },
  {
    id: 'financeiro',
    name: 'FINANCEIRO',
    emoji: '💰',
    gradient: 'from-teal-500 to-cyan-600',
    description:
      'Garantir sustentabilidade financeira, tomada de decisão baseada em números e crescimento saudável.',
    services: [
      {
        name: 'Estruturação de Fluxo de Caixa e DRE',
        description: 'Implementação de controles financeiros essenciais.',
        objective: 'Criar visibilidade financeira para decisões assertivas.',
        macroSteps: [
          'Etapa de Inicialização',
          'Levantamento e Categorização de Lançamentos',
          'Implementação do Fluxo de Caixa e DRE',
          'Análise e Recomendações',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Precificação de Produtos e Serviços',
        description: 'Modelagem de preços baseada em custos e mercado.',
        objective: 'Definir preços que maximizem margem e competitividade.',
        macroSteps: [
          'Etapa de Inicialização',
          'Levantamento e Estruturação de Custos',
          'Análise de Benchmarking de Preços',
          'Modelagem e Definição de Preços',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Análise de Viabilidade Econômico-Financeira',
        description: 'Projeção de investimentos, receitas e retorno financeiro.',
        objective: 'Validar a viabilidade econômica de projetos e investimentos.',
        macroSteps: [
          'Etapa de Inicialização',
          'Levantamento de Investimento e Custos',
          'Projeção de Receitas',
          'Modelagem Financeira e Indicadores de Retorno',
          'Etapa de Finalização',
        ],
      },
      {
        name: 'Reestruturação Financeira',
        description: 'Plano de recuperação para empresas em dificuldade financeira.',
        objective: 'Criar um caminho de recuperação viável e sustentável.',
        macroSteps: [
          'Etapa de Inicialização',
          'Diagnóstico Financeiro',
          'Plano de Reestruturação',
          'Modelagem do Cenário de Reestruturação',
          'Etapa de Finalização',
        ],
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

          {/* Macro Steps — Timeline (only if macroSteps has content) */}
          {service.macroSteps.length > 0 && (
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
          )}

          {/* Sub-Services */}
          {service.subServices && service.subServices.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Modalidades</h2>
              <div className="space-y-5">
                {service.subServices.map((sub, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <h3
                      className={`mb-3 text-base font-semibold text-transparent bg-clip-text bg-gradient-to-r ${area.gradient}`}
                    >
                      {sub.name}
                    </h3>
                    <ol className="relative border-l-2 border-gray-200 pl-5">
                      {sub.steps.map((step, i) => (
                        <li key={i} className="relative mb-4 last:mb-0">
                          <span
                            className={`absolute -left-[25px] flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${area.gradient} text-[10px] font-bold text-white shadow`}
                          >
                            {i + 1}
                          </span>
                          <p className="text-sm text-gray-700">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Modules */}
          {service.modules && service.modules.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-800">Módulo adicional</h2>
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
                <p className="mt-1 text-sm opacity-80">{area.description}</p>
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
