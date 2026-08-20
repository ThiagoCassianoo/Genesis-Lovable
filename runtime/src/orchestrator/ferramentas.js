import { spawnSync } from "node:child_process";

/**
 * CAMADA DE FERRAMENTAS — nível 1/2 da régua do `gate.js`.
 *
 * Este é o arquivo que faz a diferença entre 70% e 80% sem IA, e a
 * diferença é honesta: em vez de inflar a contagem com decisões
 * inventadas, ele move trabalho REAL da IA para ferramenta.
 *
 * O princípio (Bloco 1 de `docs/arquitetura-orquestrador-offline.md`,
 * e a regra do Decision Record): **a ferramenta produz o FATO, a IA
 * julga o FATO.** `npm audit` acha a vulnerabilidade; a IA decide se é
 * prioridade pra este cliente. Antes, a IA fazia as duas coisas — lia
 * o projeto inteiro "procurando problema", o que é caro e alucinável.
 *
 * O que cada agente ganha de evidência ANTES de ser acordado:
 *   security-agent  → npm audit (vulnerabilidade é fato, não opinião)
 *   qa-agent        → npm test (passou/falhou é fato)
 *   implementation  → lint + build + type-check
 *   reviewer-agent  → contagem de anti-padrão da Regra 4 (grep, não IA)
 *   fiscal-agent    → diff + presença de campos obrigatórios
 *   business-agent  → decisões já registradas em docs/decisoes.md
 *
 * Todas falham ABERTO: se a ferramenta não existir no ambiente, devolve
 * `disponivel: false` e o agente segue sem ela — degradar é melhor que
 * travar. Mas o Decision Record registra que a evidência faltou, pra
 * não virar falsa sensação de auditoria.
 */

function rodar(cmd, args, cwd, timeoutMs = 120000) {
  try {
    const r = spawnSync(cmd, args, { cwd, encoding: "utf-8", timeout: timeoutMs });
    if (r.error) return { disponivel: false, erro: String(r.error.message) };
    return {
      disponivel: true,
      exitCode: r.status,
      stdout: (r.stdout || "").slice(0, 4000),
      stderr: (r.stderr || "").slice(0, 2000),
    };
  } catch (e) {
    return { disponivel: false, erro: String(e.message) };
  }
}

/**
 * Anti-padrões da Regra de Ouro 4 do CLAUDE.md. Detectar isto é
 * busca de string — nunca precisou de LLM. A IA entra só pra julgar
 * o que passou pelo filtro.
 */
export const ANTI_PADROES = [
  { nome: "gradiente roxo genérico", rx: /(from-purple|to-purple|bg-gradient.*purple|#[89ab][0-9a-f]{2}[0-9a-f]{2}f{1,2})/i },
  { nome: "texto vago", rx: /soluç(ões|ao|ão) inovadora|transformamos seu neg|excelência em|qualidade e compromisso/i },
  { nome: "glassmorphism sem função", rx: /backdrop-blur/i },
  { nome: "três cards idênticos", rx: null }, // exige AST — fica pra IA por ora, declarado
];

export const FERRAMENTA_POR_AGENTE = {
  "security-agent": {
    nome: "npm audit",
    // A vulnerabilidade é FATO produzido por ferramenta. A IA recebe a
    // lista e classifica severidade/prioridade — que é julgamento real.
    executar: (cwd) => {
      const r = rodar("npm", ["audit", "--json"], cwd);
      if (!r.disponivel) return { ...r, resumo: "npm audit indisponível" };
      let total = 0;
      let porNivel = {};
      try {
        const j = JSON.parse(r.stdout || "{}");
        porNivel = j.metadata?.vulnerabilities || {};
        total = Object.entries(porNivel)
          .filter(([k]) => k !== "total")
          .reduce((a, [, v]) => a + (v || 0), 0);
      } catch { /* saída não-JSON: reporta cru */ }
      return {
        ...r,
        fato: true,
        resumo: `npm audit: ${total} vulnerabilidade(s) — ${JSON.stringify(porNivel)}`,
        precisaIaPara: total > 0 ? "classificar severidade e prioridade de correção" : null,
      };
    },
  },

  "qa-agent": {
    nome: "npm test",
    executar: (cwd) => {
      const r = rodar("npm", ["test", "--silent"], cwd);
      if (!r.disponivel) return { ...r, resumo: "npm test indisponível" };
      return {
        ...r,
        fato: true,
        resumo: `npm test: exit ${r.exitCode} (${r.exitCode === 0 ? "passou" : "FALHOU"})`,
        precisaIaPara: r.exitCode === 0 ? "desenhar caso de borda novo que o teste não cobre" : "interpretar a falha",
      };
    },
  },

  "implementation-agent": {
    nome: "lint + build",
    executar: (cwd) => {
      const lint = rodar("npm", ["run", "lint", "--silent"], cwd);
      const build = rodar("npm", ["run", "build", "--silent"], cwd);
      return {
        disponivel: lint.disponivel || build.disponivel,
        fato: true,
        exitCode: (lint.exitCode || 0) + (build.exitCode || 0),
        resumo: `lint: exit ${lint.exitCode ?? "n/d"} · build: exit ${build.exitCode ?? "n/d"}`,
        precisaIaPara: null, // passou ou não passou: é fato, não julgamento
      };
    },
  },

  "reviewer-agent": {
    nome: "varredura de anti-padrão (Regra 4)",
    executar: (cwd, alvos = ["src"]) => {
      const achados = [];
      for (const { nome, rx } of ANTI_PADROES) {
        if (!rx) continue;
        const r = rodar("grep", ["-rIl", "-E", rx.source, ...alvos], cwd, 20000);
        if (r.disponivel && r.exitCode === 0 && r.stdout.trim()) {
          achados.push({ padrao: nome, arquivos: r.stdout.trim().split("\n").slice(0, 10) });
        }
      }
      return {
        disponivel: true,
        fato: true,
        achados,
        resumo: achados.length === 0
          ? "varredura de anti-padrão: nenhum dos padrões proibidos da Regra 4 encontrado"
          : `varredura: ${achados.length} anti-padrão(ões) — ${achados.map((a) => a.padrao).join(", ")}`,
        precisaIaPara: "julgar conversão e hierarquia visual (número não mede isso)",
      };
    },
  },

  "business-agent": {
    nome: "decisões já registradas",
    // O maior desperdício mapeado no Bloco 1: o business-agent
    // rediagnosticava do zero o que já estava decidido em
    // docs/decisoes.md. Ler isso é grep, não julgamento.
    executar: (cwd, termos = []) => {
      const alvo = "docs/decisoes.md";
      if (termos.length === 0) {
        const r = rodar("tail", ["-40", alvo], cwd, 10000);
        return {
          disponivel: r.disponivel,
          fato: true,
          resumo: r.disponivel ? "últimas decisões lidas de docs/decisoes.md (sem IA)" : "docs/decisoes.md não encontrado",
          conteudo: (r.stdout || "").slice(0, 3000),
          precisaIaPara: "diagnóstico NOVO, sobre o que ainda não foi decidido",
        };
      }
      const r = rodar("grep", ["-i", "-n", termos.join("\\|"), alvo], cwd, 10000);
      return {
        disponivel: r.disponivel,
        fato: true,
        resumo: r.exitCode === 0
          ? `decisões existentes sobre "${termos.join(", ")}" encontradas — NÃO rediagnostique`
          : `nada decidido ainda sobre "${termos.join(", ")}" — diagnóstico novo é justificado`,
        conteudo: (r.stdout || "").slice(0, 3000),
        precisaIaPara: r.exitCode === 0 ? "adaptar a decisão existente ao caso novo" : "diagnóstico novo",
      };
    },
  },

  "infra-agent": {
    nome: "checklist de infra (healthcheck + DNS)",
    // O checklist de deploy é mecânico — o próprio frontmatter dele já
    // reconhece isso (`model_fallback: economico`). Rodar as checagens
    // e reportar só o que falhou tira da IA o trabalho de "verificar" e
    // deixa pra ela só a decisão de rollback/incidente.
    executar: (cwd) => {
      const temGit = rodar("git", ["rev-parse", "--is-inside-work-tree"], cwd, 10000);
      const temEnvExample = rodar("test", ["-f", "runtime/.env.example"], cwd, 5000);
      const envVersionado = rodar("git", ["ls-files", "runtime/.env"], cwd, 10000);
      const itens = [
        `repositório git: ${temGit.exitCode === 0 ? "ok" : "AUSENTE"}`,
        `.env.example presente: ${temEnvExample.exitCode === 0 ? "ok" : "AUSENTE"}`,
        `.env versionado por engano: ${envVersionado.stdout?.trim() ? "SIM — RISCO" : "não"}`,
      ];
      return {
        disponivel: true,
        fato: true,
        resumo: `checklist de infra: ${itens.join(" · ")}`,
        precisaIaPara: "decidir rollback, janela de suporte e resposta a incidente",
      };
    },
  },

  "docs-agent": {
    nome: "estado do fechamento",
    // O docs-agent REGISTRA o que os outros decidiram — não interpreta.
    // Boa parte é preencher template a partir de dado que já existe.
    // A ferramenta traz o estado; a IA só escreve a prosa do post-mortem.
    executar: (cwd) => {
      const temConhecimento = rodar("ls", ["docs/conhecimento"], cwd, 10000);
      const ultimaDecisao = rodar("tail", ["-3", "docs/decisoes.md"], cwd, 10000);
      return {
        disponivel: true,
        fato: true,
        resumo: `fechamento: docs/conhecimento ${temConhecimento.exitCode === 0 ? "existe" : "AUSENTE"} · última decisão registrada lida`,
        conteudo: (ultimaDecisao.stdout || "").slice(0, 1500),
        precisaIaPara: "escrever o post-mortem em prosa e propor a regra nova",
      };
    },
  },

  "fiscal-agent": {
    nome: "diff + hash",
    executar: (cwd) => {
      const diff = rodar("git", ["diff", "--cached", "--stat"], cwd, 20000);
      return {
        disponivel: diff.disponivel,
        fato: true,
        resumo: diff.disponivel ? `diff staged:\n${(diff.stdout || "(vazio)").slice(0, 1500)}` : "git indisponível",
        precisaIaPara: "achar genérico/vago que grep não pega — é o que o fiscal existe pra fazer",
      };
    },
  },
};

/**
 * Roda a ferramenta do agente ANTES de acordá-lo, se existir.
 * @returns {{temFerramenta: boolean, evidencia?: string, precisaIaPara?: string, bruto?: object}}
 */
export function coletarEvidencia(agente, cwd, extra) {
  const f = FERRAMENTA_POR_AGENTE[agente];
  if (!f) {
    return { temFerramenta: false };
  }
  const r = f.executar(cwd, extra);
  return {
    temFerramenta: true,
    ferramenta: f.nome,
    evidencia: r.resumo,
    precisaIaPara: r.precisaIaPara,
    disponivel: r.disponivel !== false,
    bruto: r,
  };
}

/** Quais agentes têm ferramenta que gera evidência antes da IA. */
export const AGENTES_COM_FERRAMENTA = Object.keys(FERRAMENTA_POR_AGENTE);
