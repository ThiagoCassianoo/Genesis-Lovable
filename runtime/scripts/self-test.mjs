#!/usr/bin/env node
/**
 * Autoteste do runtime — "setor de autodefesa" (item 5 do pedido do
 * Thiago em 2026-08-16). NÃO recria nada, só valida o que já existe e
 * corrige o que é mecânico e seguro de corrigir sozinho (permissão de
 * execução). O resto vira relatório pro Thiago decidir.
 *
 * Roda offline — não chama nenhuma API paga, só lê arquivo.
 * Uso: cd runtime && npm test
 */
import { readFileSync, readdirSync, statSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // raiz do repo (runtime/scripts -> raiz)

function getBashCommand() {
  if (process.platform !== "win32") {
    return "bash";
  }
  const paths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe",
    join(process.env.USERPROFILE || "C:\\Users", "AppData\\Local\\Programs\\Git\\bin\\bash.exe")
  ];
  for (const p of paths) {
    try {
      if (statSync(p).isFile()) {
        return p;
      }
    } catch {}
  }
  return "bash";
}

const results = []; // { ok: boolean, msg: string, fixed?: boolean }

function check(ok, msg) {
  results.push({ ok, msg });
}

function fixed(msg) {
  results.push({ ok: true, msg, fixed: true });
}

// 1. Cada .claude/agents/*.md tem frontmatter válido (name, model,
//    model_fallback) — mesmo parser que agent-loader.js usa de verdade,
//    pra pegar exatamente o que travaria em produção.
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatterRaw] = match;
  const fm = {};
  for (const line of frontmatterRaw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fm;
}

const agentsDir = join(ROOT, ".claude", "agents");
let agentFiles = [];
try {
  agentFiles = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
} catch (err) {
  check(false, `não consegui ler ${agentsDir}: ${err.message}`);
}

// ÂNCORA DE CONTAGEM (2026-08-17) — sem isto, o loop abaixo com lista
// vazia registrava ZERO checagens e o teste passava "Tudo OK". Teste
// que some quando o alvo some é pior que teste ausente: dá confiança
// falsa. Mesmo padrão aplicado nos outros loops deste arquivo.
const AGENTES_ESPERADOS = 16;
check(
  agentFiles.length === AGENTES_ESPERADOS,
  `.claude/agents/ tem ${agentFiles.length} agentes (esperado ${AGENTES_ESPERADOS} — se mudou de propósito, atualize AGENTES_ESPERADOS)`
);

for (const file of agentFiles) {
  const path = join(agentsDir, file);
  const raw = readFileSync(path, "utf-8");
  const fm = parseFrontmatter(raw);
  if (!fm) {
    check(false, `${file}: sem frontmatter --- válido`);
    continue;
  }
  if (!fm.name) {
    check(false, `${file}: frontmatter sem "name"`);
    continue;
  }
  const modelFallback = fm.model_fallback || "capaz"; // default do agent-loader.js
  if (modelFallback !== "capaz" && modelFallback !== "economico") {
    check(false, `${file}: model_fallback="${modelFallback}" inválido (só capaz|economico)`);
    continue;
  }
  // model era IMPRESSO mas nunca VALIDADO (auditoria 2026-08-17) —
  // `model: claude-opus-5` (ID real do modelo, erro plausível) passava
  // verde aqui e fazia o agente cair pro fallback pra sempre em
  // runtime, com a pista parecendo rate limit.
  const model = fm.model || "sonnet";
  if (model !== "opus" && model !== "sonnet") {
    check(false, `${file}: model="${model}" inválido (é o TIER: só opus|sonnet — o ID do modelo vem do .env)`);
    continue;
  }
  check(true, `${file}: frontmatter OK (model=${model}, fallback=${modelFallback})`);
}

// 2. Providers registrados no router.js batem com as vars do
//    .env.example — evita "integrei o provider mas esqueci de
//    documentar a chave" (ou o oposto).
const routerRaw = readFileSync(join(ROOT, "runtime", "src", "router.js"), "utf-8");
const envExampleRaw = readFileSync(join(ROOT, "runtime", ".env.example"), "utf-8");

const providerKeyMap = {
  claude: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const registeredProviders = [...routerRaw.matchAll(/^\s*(\w+):\s*\{\s*send:/gm)].map((m) => m[1]);

// ÂNCORA (2026-08-17): se a regex parasse de casar (ex.: alguém renomeia
// a propriedade `send`), o loop rodava zero vezes, as 4 checagens
// sumiam do relatório e o npm test continuava "Tudo OK".
check(
  registeredProviders.length === 4,
  `router.js registra ${registeredProviders.length} providers (esperado 4 — se mudou, atualize esta âncora)`
);

for (const provider of registeredProviders) {
  const envVar = providerKeyMap[provider];
  if (!envVar) {
    check(false, `router.js registra provider "${provider}" sem entrada em providerKeyMap deste teste — atualizar self-test.mjs`);
    continue;
  }
  if (!envExampleRaw.includes(envVar)) {
    check(false, `.env.example não documenta ${envVar} (provider "${provider}" registrado no router.js)`);
  } else {
    check(true, `provider "${provider}" <-> ${envVar} documentado`);
  }
}

// 3. Cada provider importado no router.js tem o arquivo correspondente
//    e exporta a função esperada.
const providerImports = [...routerRaw.matchAll(/import \{ (\w+) \} from "\.\/providers\/([\w-]+)\.js";/g)];
for (const [, fnName, fileBase] of providerImports) {
  const path = join(ROOT, "runtime", "src", "providers", `${fileBase}.js`);
  try {
    const src = readFileSync(path, "utf-8");
    if (src.includes(`export async function ${fnName}`) || src.includes(`export function ${fnName}`)) {
      check(true, `providers/${fileBase}.js exporta ${fnName}() como esperado`);
    } else {
      check(false, `providers/${fileBase}.js existe mas não exporta ${fnName}()`);
    }
  } catch {
    check(false, `router.js importa de providers/${fileBase}.js mas o arquivo não existe`);
  }
}

// 4. package.json declara dependência pra cada provider externo usado
//    (groq-sdk, openai) — pega o caso "código novo, esqueci do npm install".
const pkg = JSON.parse(readFileSync(join(ROOT, "runtime", "package.json"), "utf-8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
for (const [dep, why] of [["groq-sdk", "groq-provider.js"], ["openai", "cerebras-provider.js"]]) {
  check(!!deps[dep], `package.json declara "${dep}" (usado em ${why})`);
}

// 4b. Memória de uso (item 1 do pedido 2026-08-16): usage-logger.js
//     precisa exportar logUsage/summarizeUsage, cli.js precisa chamar
//     logUsage, e o script de relatório + o comando npm precisam existir.
const usageLoggerPath = join(ROOT, "runtime", "src", "usage-logger.js");
try {
  const src = readFileSync(usageLoggerPath, "utf-8");
  check(src.includes("export function logUsage"), "usage-logger.js exporta logUsage()");
  check(src.includes("export function summarizeUsage"), "usage-logger.js exporta summarizeUsage()");
} catch {
  check(false, "runtime/src/usage-logger.js não existe");
}

const cliRaw = readFileSync(join(ROOT, "runtime", "src", "cli.js"), "utf-8");
check(cliRaw.includes("logUsage("), "cli.js grava uso a cada resposta (logUsage)");

// 4c. Achado 2026-08-16: histórico sem limite zerava token antes do 3º
// agente. Extraído em 2026-08-17 pra runtime/src/history.js (Bloco 4
// — reaproveitado pela futura web API, não duplicado). Importa a
// função REAL, não uma cópia — se alguém quebrar history.js, este
// teste quebra junto, não fica satisfeito com uma reimplementação que
// pode divergir com o tempo.
check(cliRaw.includes("trimHistory(") && cliRaw.includes("history: trimmed") && cliRaw.includes('from "./history.js"'), "cli.js corta o histórico antes de chamar sendMessage, via módulo compartilhado history.js");
{
  const { trimHistory } = await import(pathToFileURL(join(ROOT, "runtime", "src", "history.js")));
  const fake = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", text: `msg${i}` }));
  const { trimmed, dropped } = trimHistory(fake, 3);
  check(trimmed.length === 6 && dropped === 14 && trimmed[0].text === "msg14", "trimHistory (real, de history.js): janela de 3 turnos corta 20 mensagens pra 6, mantém as mais recentes");
  const { trimmed: t2, dropped: d2 } = trimHistory(fake.slice(0, 4), 6);
  check(t2.length === 4 && d2 === 0, "trimHistory (real): histórico menor que a janela não corta nada");
}

try {
  readFileSync(join(ROOT, "runtime", "scripts", "custos-report.mjs"), "utf-8");
  check(true, "scripts/custos-report.mjs existe");
} catch {
  check(false, "runtime/scripts/custos-report.mjs não existe");
}
check(!!pkgScriptsHasCustos(), 'package.json declara script "custos"');

function pkgScriptsHasCustos() {
  try {
    const p = JSON.parse(readFileSync(join(ROOT, "runtime", "package.json"), "utf-8"));
    return !!p.scripts?.custos;
  } catch {
    return false;
  }
}

// 5. Hooks de shell precisam ser executáveis — corrige sozinho (item
//    mecânico, sem julgamento envolvido) e registra o que corrigiu.
const hooksDir = join(ROOT, ".claude", "hooks");
try {
  for (const file of readdirSync(hooksDir).filter((f) => f.endsWith(".sh"))) {
    const path = join(hooksDir, file);
    const mode = statSync(path).mode;
    const isExecutable = (mode & 0o111) !== 0;
    if (!isExecutable) {
      chmodSync(path, 0o755);
      fixed(`.claude/hooks/${file} não era executável — corrigido (chmod 755)`);
    } else {
      check(true, `.claude/hooks/${file} executável`);
    }
  }
} catch (err) {
  check(false, `não consegui checar .claude/hooks/: ${err.message}`);
}

// ================================================================
// 6. REGRESSÕES DA AUDITORIA DE 2026-08-17
// Cada checagem abaixo corresponde a um bug REAL encontrado naquela
// auditoria. Não são checagens genéricas "por precaução" — são travas
// pra que cada bug específico não volte. É a política do Bloco 2
// (docs/arquitetura-orquestrador-offline.md) aplicada: erro que já
// mordeu vira checagem permanente.
// ================================================================

// 6a. guard-red-lines.sh não pode voltar a parsear JSON com regex.
// O bug: `grep -o '"command"..."[^"]*"'` parava na primeira aspa
// escapada, e `echo "oi" && rm -rf x` passava batido (exit 0).
{
  const guard = readFileSync(join(ROOT, ".claude", "hooks", "guard-red-lines.sh"), "utf-8");
  // Ignora linhas de comentário — o arquivo DOCUMENTA o bug antigo de
  // propósito (pra não ser reintroduzido por desconhecimento), então
  // procurar a string solta daria falso positivo no próprio comentário.
  const linhasExecutaveis = guard
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");
  check(
    !/grep -o '"command"/.test(linhasExecutaveis),
    "guard-red-lines.sh NÃO extrai comando com regex sobre JSON (bug do bypass por aspas)"
  );
  check(
    /json\.load|JSON\.parse/.test(guard),
    "guard-red-lines.sh usa parse de JSON de verdade"
  );

  // Teste FUNCIONAL, não de texto: roda o hook de verdade com o payload
  // exato que burlava a trava antes. É a única checagem que prova que
  // o bypass está fechado — as duas acima só provam que o código mudou.
  const casos = [
    ['{"tool_input":{"command":"echo \\"oi\\" && rm -rf /tmp/x"}}', 2, "aspas + rm -rf"],
    ['{"tool_input":{"command":"cd \\"/tmp\\" && npm install x"}}', 2, "aspas + npm install"],
    ['{"tool_input":{"command":"npm test"}}', 0, "npm test (não pode bloquear)"],
    ['{"tool_input":{"command":"echo \\"rm -rf isso e texto\\""}}', 0, "rm dentro de string (não executa)"],
  ];
  const bashCmd = getBashCommand();
  for (const [payload, esperado, nome] of casos) {
    const r = spawnSync(bashCmd, [join(ROOT, ".claude", "hooks", "guard-red-lines.sh")], {
      input: payload,
      encoding: "utf-8",
    });
    check(r.status === esperado, `guard-red-lines FUNCIONAL: ${nome} → exit ${r.status} (esperado ${esperado})`);
  }
}

// 6b. Providers não podem tratar resposta vazia como sucesso.
// O bug: `|| ""` fazia o router chamar recordSuccess() e o histórico
// receber texto vazio, quebrando o turno SEGUINTE com um 400 sem
// relação aparente com a causa.
for (const p of ["claude", "gemini", "groq", "cerebras"]) {
  const src = readFileSync(join(ROOT, "runtime", "src", "providers", `${p}-provider.js`), "utf-8");
  check(
    /if \(!text\)[\s\S]{0,200}throw new Error/.test(src),
    `${p}-provider.js lança erro em resposta vazia (não devolve string vazia como sucesso)`
  );
}

// 6c. Modelos descontinuados da Cerebras não podem voltar como default.
// Confirmado em inference-docs.cerebras.ai/support/deprecation:
// llama-3.3-70b morreu em 2026-02-16, llama3.1-8b em 2026-05-27.
{
  const cere = readFileSync(join(ROOT, "runtime", "src", "providers", "cerebras-provider.js"), "utf-8");
  const defaults = [...cere.matchAll(/\|\|\s*"([^"]+)"/g)].map((m) => m[1]);
  const mortos = ["llama-3.3-70b", "llama3.1-8b", "qwen-3-32b", "llama3.1-70b"];
  const usaMorto = defaults.filter((d) => mortos.includes(d));
  check(
    usaMorto.length === 0,
    `cerebras-provider.js não usa modelo descontinuado como default${usaMorto.length ? ` (encontrado: ${usaMorto.join(", ")})` : ""}`
  );
}

// 6c-bis. Modelos descontinuados da Groq não podem voltar como default.
// Confirmado em console.groq.com/docs/deprecations: llama-3.3-70b-versatile
// e llama-3.1-8b-instant desligados em 2026-08-16.
{
  const groq = readFileSync(join(ROOT, "runtime", "src", "providers", "groq-provider.js"), "utf-8");
  const defaults = [...groq.matchAll(/\|\|\s*"([^"]+)"/g)].map((m) => m[1]);
  const mortos = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  const usaMorto = defaults.filter((d) => mortos.includes(d));
  check(
    usaMorto.length === 0,
    `groq-provider.js não usa modelo descontinuado como default${usaMorto.length ? ` (encontrado: ${usaMorto.join(", ")})` : ""}`
  );
}

// 6d. Nenhuma regra @import-ada em toda sessão pode citar agente que
// não existe mais. O bug: orchestration.md mandava acionar
// `intake-agent`, deprecado e movido pra docs/_quarentena/.
{
  const agentesReais = new Set(agentFiles.map((f) => f.replace(/\.md$/, "")));
  const regrasSempre = ["orchestration.md", "quality-gates.md"];
  for (const regra of regrasSempre) {
    const src = readFileSync(join(ROOT, ".claude", "rules", regra), "utf-8");
    const citados = [...src.matchAll(/`([a-z-]+-agent|[a-z]+-master|conselho-[a-z-]+)`/g)].map((m) => m[1]);
    const fantasmas = [...new Set(citados)].filter(
      (c) => !agentesReais.has(c) && !src.includes(`${c}\` (deprecado`) && !src.includes("_quarentena")
    );
    check(
      fantasmas.length === 0,
      `.claude/rules/${regra} não cita agente inexistente${fantasmas.length ? ` (fantasmas: ${fantasmas.join(", ")})` : ""}`
    );
  }
}

// 6e. Consistência CLAUDE.md × orchestration.md — pendência aberta
// desde 2026-08-16, era pré-requisito declarado do `gate.js`. Os dois
// arquivos descrevem a MESMA política de aprovação; se um mudar sem o
// outro (já aconteceu), o orquestrador executa a versão desatualizada
// sem ninguém saber.
{
  const claudeMd = readFileSync(join(ROOT, "CLAUDE.md"), "utf-8");
  const orch = readFileSync(join(ROOT, ".claude", "rules", "orchestration.md"), "utf-8");

  // Sinal de que os dois foram atualizados pra mesma política.
  const claudeSemPausa = /sem\s+par(ar|a)\s+pra\s+(pedir\s+)?confirma|roda sem pausa entre etapas/i.test(claudeMd);
  const orchSemPausa = /sem\s+(parar|pausar|pausa)/i.test(orch);
  check(
    claudeSemPausa === orchSemPausa,
    "CLAUDE.md e orchestration.md concordam sobre pausa entre etapas (política de aprovação alinhada)"
  );

  // Nenhum dos dois pode ter sobrado descrevendo o modelo antigo.
  check(
    !/aprovação do diretor \*\*por onda\*\*/.test(orch),
    "orchestration.md não descreve mais 'aprovação por onda' (revogado em 2026-08-16)"
  );
}

// 6e-bis. ORQUESTRADOR.md é CÓPIA MANUAL do CLAUDE.md + orchestration.md
// (pra colar em outro chat quando o Claude Code não estiver
// disponível). Cópia manual diverge — e esta divergiu no primeiro dia:
// tinha 7 regras em vez de 8, 15 papéis em vez de 16, e mandava "pare
// em cada gate", política revogada em 2026-08-16. O próprio arquivo
// promete que este teste existe; sem ele, a promessa seria falsa.
{
  const orqPath = join(ROOT, "ORQUESTRADOR.md");
  const orq = readFileSync(orqPath, "utf-8");

  check(
    /## Os 16 papéis/.test(orq),
    `ORQUESTRADOR.md declara 16 papéis (bate com os ${AGENTES_ESPERADOS} agentes reais)`
  );
  // Ignora blocos de citação (linhas com ">"): o arquivo DOCUMENTA a
  // política antiga de propósito, pra que ninguém a reintroduza por
  // desconhecimento. Procurar a string solta daria falso positivo no
  // próprio aviso — mesmo cuidado aplicado na checagem 6a.
  const orqInstrucoes = orq
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join("\n");
  check(
    !/pare em cada gate|aprovação por etapa|aprovação explícita de etapa/i.test(orqInstrucoes),
    "ORQUESTRADOR.md não INSTRUI mais parar em cada gate (política revogada em 2026-08-16)"
  );
  // Conta as regras de ouro numeradas no bloco de regras.
  const regrasOrq = (orq.match(/^\d+\. /gm) || []).length;
  check(
    regrasOrq >= 8,
    `ORQUESTRADOR.md tem as 8 regras de ouro do CLAUDE.md (encontrado: ${regrasOrq} itens numerados)`
  );
  check(
    /DERIVADO/.test(orq),
    "ORQUESTRADOR.md se declara derivado (avisa quem lê que a fonte de verdade é CLAUDE.md/orchestration.md)"
  );
}

// 6f. Nenhum arquivo carregado sempre pode contradizer a política de
// aprovação vigente. Cobre as skills e o navigator, que ficaram pra
// trás na mudança de 2026-08-16.
{
  const alvos = [
    [".claude/skills/parallel-task/SKILL.md", "parallel-task"],
    [".claude/agents/navigator-agent.md", "navigator-agent"],
  ];
  for (const [rel, nome] of alvos) {
    const src = readFileSync(join(ROOT, rel), "utf-8");
    const contradiz =
      /com aprovação do diretor antes de cada onda/i.test(src) ||
      /quem aciona, após\s+confirmação do diretor/i.test(src);
    check(!contradiz, `${nome} não contradiz a política de aprovação vigente (sem gate por onda/etapa)`);
  }
}

// 6g. O teste do router precisa existir e estar ligado no npm test —
// senão o coração do sistema volta a ficar sem cobertura.
{
  const pkg2 = JSON.parse(readFileSync(join(ROOT, "runtime", "package.json"), "utf-8"));
  check(!!pkg2.scripts?.["test:router"], 'package.json declara script "test:router"');
  check(
    /test-router\.mjs/.test(pkg2.scripts?.test ?? ""),
    'npm test roda o teste do router (não deixa o coração do sistema sem cobertura)'
  );
  try {
    readFileSync(join(ROOT, "runtime", "scripts", "test-router.mjs"), "utf-8");
    check(true, "scripts/test-router.mjs existe");
  } catch {
    check(false, "runtime/scripts/test-router.mjs não existe");
  }
}

// 6h. observability.sh não pode marcar stderr-com-sucesso como ERRO —
// isso alimentava o guard-retry-loop e travava builds legítimos.
{
  const obs = readFileSync(join(ROOT, ".claude", "hooks", "observability.sh"), "utf-8");
  check(/AVISO/.test(obs), "observability.sh separa AVISO (stderr sem falha) de ERRO (falha real)");
  check(/exit_code/.test(obs), "observability.sh usa exit code pra decidir se houve falha, não só stderr não-vazio");
  check(/AKIA|GITHUB_TOKEN_REDIGIDO/.test(obs), "observability.sh redige chave AWS e token GitHub (vazavam no log)");
}

// 6i. trimHistory precisa cortar em fronteira de turno (começar em
// "user"), senão a API da Anthropic recusa com 400.
{
  const { trimHistory } = await import(pathToFileURL(join(ROOT, "runtime", "src", "history.js")));
  const impar = [
    { role: "user", text: "u1" },
    { role: "assistant", text: "a1" },
    { role: "user", text: "u2" },
  ];
  const { trimmed } = trimHistory(impar, 1);
  check(
    trimmed.length === 0 || trimmed[0].role === "user",
    "trimHistory: histórico cortado sempre começa em 'user' (a API recusa se começar em 'assistant')"
  );
}

// 6j. agent-loader precisa validar `model`, não só `model_fallback`.
{
  const loader = readFileSync(join(ROOT, "runtime", "src", "agentloader.js"), "utf-8");
  check(
    /model !== "opus" && model !== "sonnet"/.test(loader),
    "agent-loader.js valida o campo `model` (antes só validava model_fallback — assimetria que mandava agente crítico pro fallback em silêncio)"
  );
}

// ================================================================
// 7. REGRESSÕES DA AUDITORIA DE ARQUITETURA DE AGENTES (2026-08-17)
// ================================================================

// 7a. O bug mais caro achado: o corpo de um agente prometia uma
// ferramenta que o frontmatter não dava. No `fiscal-agent`, isso
// tornava o gate de commit MATEMATICAMENTE INATINGÍVEL — ele é o
// único que pode gerar o marcador `fiscal-*.json` que
// `.githooks/pre-commit` exige, e não tinha Write pra gerar.
{
  for (const file of agentFiles) {
    const raw = readFileSync(join(agentsDir, file), "utf-8");
    const fm = parseFrontmatter(raw);
    if (!fm) continue;
    const tools = (fm.tools || "").split(",").map((t) => t.trim());
    const corpo = raw.split(/^---$/m).slice(2).join("---");

    // Se o corpo diz "você tem `Write`", o frontmatter TEM que dar Write.
    if (/você tem `?Write`?/i.test(corpo)) {
      check(
        tools.includes("Write"),
        `${file}: corpo promete Write e o frontmatter concede (promessa sem permissão = agente travado em runtime)`
      );
    }
    // Se o corpo manda gravar arquivo, precisa de Write.
    if (/\bGrave\b.*\.json|\bGrave\b.*\.md/i.test(corpo)) {
      check(
        tools.includes("Write"),
        `${file}: corpo manda gravar arquivo e o frontmatter concede Write`
      );
    }
  }

  // Checagem específica e não-negociável: o gate de commit depende dela.
  const fiscalFm = parseFrontmatter(readFileSync(join(agentsDir, "fiscal-agent.md"), "utf-8"));
  const fiscalTools = (fiscalFm?.tools || "").split(",").map((t) => t.trim());
  check(
    fiscalTools.includes("Write"),
    "fiscal-agent tem Write — SEM ISSO o marcador fiscal-*.json não é gerado e .githooks/pre-commit bloqueia TODO commit pra sempre"
  );
  check(
    fiscalTools.includes("WebSearch") || fiscalTools.includes("WebFetch"),
    "fiscal-agent tem WebSearch/WebFetch (a Fiscalização 1b exige verificar fonte AO VIVO — sem isso ele não julga alucinação técnica)"
  );
}

// 7b. Só os 3 agentes autorizados podem ter Write/Edit. Se aparecer um
// quarto, é escalada de privilégio silenciosa.
{
  const AUTORIZADOS = new Set(["implementation-agent", "docs-agent", "fiscal-agent"]);
  const comEscrita = [];
  for (const file of agentFiles) {
    const fm = parseFrontmatter(readFileSync(join(agentsDir, file), "utf-8"));
    const tools = (fm?.tools || "").split(",").map((t) => t.trim());
    if (tools.includes("Write") || tools.includes("Edit")) comEscrita.push(file.replace(/\.md$/, ""));
  }
  const naoAutorizados = comEscrita.filter((a) => !AUTORIZADOS.has(a));
  check(
    naoAutorizados.length === 0,
    `só os 3 agentes autorizados têm Write/Edit${naoAutorizados.length ? ` (não autorizado: ${naoAutorizados.join(", ")})` : ` (${comEscrita.join(", ")})`}`
  );
  check(
    comEscrita.length === 3,
    `exatamente 3 agentes com escrita (encontrado ${comEscrita.length}: ${comEscrita.join(", ")})`
  );
}

// 7c. A tabela de roteamento não pode contradizer as regras
// obrigatórias escritas logo abaixo dela. A versão anterior deixava
// security-agent e infra-agent fora da linha Site/landing — e toda
// landing captura lead (dado pessoal) e vai a deploy.
{
  const orch = readFileSync(join(ROOT, ".claude", "rules", "orchestration.md"), "utf-8");
  const secaoRoteamento = orch.split("## Roteamento por linha de produto")[1]?.split("\n## ")[0] ?? "";
  const linhaSite = secaoRoteamento.split("\n").find((l) => /Site \/ landing/.test(l)) ?? "";
  // A linha pode continuar na próxima; pega o bloco do bullet.
  const idxSite = secaoRoteamento.indexOf("**Site / landing page**");
  const blocoSite = idxSite >= 0 ? secaoRoteamento.slice(idxSite, secaoRoteamento.indexOf("- **Sistema")) : linhaSite;

  for (const obrigatorio of ["security", "infra", "fiscal"]) {
    check(
      blocoSite.includes(obrigatorio),
      `roteamento Site/landing inclui \`${obrigatorio}\` (a regra obrigatória logo abaixo exige — contradição anterior)`
    );
  }
  check(
    /Plano|swarm-planner/.test(blocoSite),
    "roteamento Site/landing mostra a Etapa 3 (Plano) — sem ela o implementation-agent trava por falta de critério de aceite"
  );
  const idxMkt = secaoRoteamento.indexOf("**Marketing**");
  const blocoMkt = idxMkt >= 0 ? secaoRoteamento.slice(idxMkt) : "";
  check(
    blocoMkt.includes("fiscal"),
    "roteamento Marketing passa pelo fiscal-agent (obrigatório antes de qualquer entrega sair)"
  );
}

// 7d. Frontmatter e corpo do mesmo agente não podem discordar sobre a
// política de aprovação — o frontmatter é o que o roteador lê.
{
  for (const nome of ["navigator-agent", "implementation-agent"]) {
    const raw = readFileSync(join(agentsDir, `${nome}.md`), "utf-8");
    const fm = parseFrontmatter(raw);
    const desc = fm?.description || "";
    const contradiz =
      /após confirmação(?!.*sem esperar)/i.test(desc) ||
      /SOMENTE depois que o diretor aprovou/i.test(desc) ||
      /aprovou explicitamente uma etapa/i.test(desc);
    check(!contradiz, `${nome}: description (o que o roteador lê) não descreve a política de aprovação revogada`);
  }
}

// ================================================================
// 8. CAMADA DETERMINÍSTICA (construída 2026-08-17) — o que entrega o 80/20
// ================================================================
{
  const dir = join(ROOT, "runtime", "src", "orchestrator");
  for (const m of ["etapas.js", "gate.js", "context-engine.js", "decision-record.js", "ferramentas.js"]) {
    try {
      readFileSync(join(dir, m), "utf-8");
      check(true, `orchestrator/${m} existe`);
    } catch {
      check(false, `orchestrator/${m} NÃO existe — a camada determinística está incompleta`);
    }
  }

  const pkg3 = JSON.parse(readFileSync(join(ROOT, "runtime", "package.json"), "utf-8"));
  check(/test-orchestrator\.mjs/.test(pkg3.scripts?.test ?? ""), "npm test roda o teste da camada determinística");

  // A tabela de roteamento do código TEM que espelhar orchestration.md.
  // Foi assim que CLAUDE.md e orchestration.md divergiram uma vez sem
  // ninguém notar — não repetir com etapas.js.
  const { LINHAS } = await import(pathToFileURL(join(dir, "etapas.js")));
  const orchMd = readFileSync(join(ROOT, ".claude", "rules", "orchestration.md"), "utf-8");
  for (const linha of ["site", "sistema", "marketing"]) {
    const agentesNoCodigo = LINHAS[linha].map((p) => p.agente);
    const fora = agentesNoCodigo.filter((a) => !orchMd.includes(a));
    check(
      fora.length === 0,
      `etapas.js linha "${linha}" espelha orchestration.md${fora.length ? ` (só no código: ${fora.join(", ")})` : ""}`
    );
  }

  // O gate não pode ter default silencioso — é assim que o sistema
  // voltaria pra 100% de IA sem ninguém perceber.
  const gateSrc = readFileSync(join(dir, "gate.js"), "utf-8");
  check(
    /não existe default/i.test(gateSrc) && /throw new Error/.test(gateSrc),
    "gate.js falha alto em tipo não classificado (sem default silencioso pra IA)"
  );

  // Decision Record tem que rejeitar registro incompleto.
  const drSrc = readFileSync(join(dir, "decision-record.js"), "utf-8");
  check(/evidencia. é obrigatória|evidencia` é obrigat/.test(drSrc), "decision-record rejeita decisão sem evidência");
  check(/motivoIa/.test(drSrc), "decision-record exige motivo quando a fonte é IA");
}

// 8b. As 7 sobreposições da auditoria de arquitetura foram resolvidas
{
  const ler = (p) => readFileSync(join(ROOT, p), "utf-8");
  check(/Fronteira de diagnóstico com o `marketing-master`/.test(ler(".claude/agents/business-agent.md")),
    "(a) fronteira de DIAGNÓSTICO business × marketing declarada (a correção de 08-16 só separou recomendação)");
  check(/Fronteira com o `security-agent`/.test(ler(".claude/agents/qa-agent.md")),
    "(b) fronteira permissão (qa) × autorização (security) declarada");
  check(/## O que NÃO é seu/.test(ler(".claude/agents/reviewer-agent.md")),
    "(c) reviewer ganhou fronteira negativa (era o único auditor sem)");
  check(/o fiscal manda/.test(ler(".claude/agents/reviewer-agent.md")),
    "(d) precedência reviewer × fiscal declarada (divergência = escalate)");
  check(/a aplicar pelo diretor/.test(ler(".claude/rules/memory.md")),
    "(e) Etapa 6 pede regra PROPOSTA — antes exigia escrita em .claude/agents/ que nenhum agente pode fazer");
  check(/Faixa comercial — fora do escopo do time/.test(ler(".claude/rules/memory.md")),
    "(f) faixa comercial declarada fora de escopo, com critério de revisão");
  const bus = ler(".claude/agents/business-agent.md");
  check(/ICP: \[/.test(bus) && /Modelo de conversão: \[/.test(bus),
    "(g) business-agent emite ICP e Modelo de conversão — os inputs que o creative declara precisar");
}

// --- Relatório ---
const failures = results.filter((r) => !r.ok);
const fixes = results.filter((r) => r.fixed);

console.log("\n=== Autoteste runtime — missoes-tech-agentes ===\n");
for (const r of results) {
  const icon = r.fixed ? "🔧" : r.ok ? "✅" : "❌";
  console.log(`${icon} ${r.msg}`);
}
console.log(`\n${results.length} checagens · ${failures.length} falha(s) · ${fixes.length} autocorreção(ões)\n`);

if (failures.length > 0) {
  console.error("Autoteste encontrou problema(s) que exigem decisão do Thiago — ver ❌ acima.");
  process.exit(1);
}
console.log("Tudo OK.");
