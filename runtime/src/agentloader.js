import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lê um .claude/agents/<nome>.md e separa frontmatter (name,
 * description, tools, model) do corpo (que vira o system prompt).
 *
 * Parser propositalmente simples: os agentes desta fábrica sempre têm
 * frontmatter de linha única por campo (sem YAML aninhado, sem listas
 * multi-linha). Se isso mudar um dia, este parser quebra ALTO (erro
 * explícito abaixo), nunca silenciosamente devolvendo lixo.
 */
export function loadAgent(agentName, { agentsDir = "../.claude/agents" } = {}) {
  // resolve (não join): quando agentsDir já vem absoluto (caso do
  // painel web, que monta o caminho a partir de REPO_ROOT), resolve()
  // descarta process.cwd() em vez de grudar os dois — era isso que
  // causava o path duplicado no erro "Agente não encontrado".
  const path = resolve(process.cwd(), agentsDir, `${agentName}.md`);

  let raw;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    throw new Error(
      `Agente "${agentName}" não encontrado em ${path}. Rode a partir da pasta runtime/, ou confira o nome do arquivo em .claude/agents/.`
    );
  }

  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      `"${agentName}.md" não tem frontmatter --- no formato esperado (name/description/tools/model). Não vou adivinhar o conteúdo.`
    );
  }
  const [, frontmatterRaw, body] = match;

  const frontmatter = {};
  for (const line of frontmatterRaw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    frontmatter[key] = value;
  }

  if (!frontmatter.name) {
    throw new Error(`"${agentName}.md" não declara "name" no frontmatter — contrato mínimo quebrado.`);
  }

  const modelFallback = frontmatter.model_fallback || "capaz";
  if (modelFallback !== "capaz" && modelFallback !== "economico") {
    // Falha alto e explícito, não assume default silencioso: um valor
    // desconhecido aqui poderia rodar um agente crítico no tier errado
    // sem ninguém perceber.
    throw new Error(
      `"${agentName}.md" tem model_fallback="${modelFallback}" — só "capaz" ou "economico" são válidos.`
    );
  }

  // CORREÇÃO 2026-08-17 (auditoria): `model` não era validado, só
  // `model_fallback` — assimetria perigosa. Se alguém escrevesse
  // `model: claude-opus-5` (o ID real do modelo, erro plausível) ou
  // `model: inherit` (valor que o Claude Code aceita de verdade nos
  // agentes), o loader aceitava, o claude-provider lançava "tier
  // desconhecido", o erro NÃO é transiente, e o router fazia failover
  // silencioso. Resultado: um agente opus crítico (fiscal, security)
  // passaria a rodar em Llama pra sempre, e a única pista seria uma
  // linha que parece rate limit. Mesma proteção do campo irmão.
  const model = frontmatter.model || "sonnet";
  if (model !== "opus" && model !== "sonnet") {
    throw new Error(
      `"${agentName}.md" tem model="${model}" — só "opus" ou "sonnet" são válidos (é o TIER, não o ID do modelo; o ID vem de .env/provider).`
    );
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description || "",
    model,
    modelFallback,
    systemPrompt: body.trim(),
  };
}