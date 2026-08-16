import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  const path = join(process.cwd(), agentsDir, `${agentName}.md`);

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

  return {
    name: frontmatter.name,
    description: frontmatter.description || "",
    model: frontmatter.model || "sonnet", // tier no Claude: opus | sonnet
    modelFallback, // tier no Gemini (fallback): capaz | economico
    systemPrompt: body.trim(),
  };
}
