export const meta = {
  name: 'deliver',
  description: 'Tupatro: a requirement becomes a specced, tested, verified pull request',
  whenToUse: 'Invoked by /req and /rework. Takes one requirement and delivers a PR to main.',
  phases: [
    { title: 'Spec', detail: 'write docs/specs/<date>-<slug>.md — criteria, assumptions, touch points' },
    { title: 'Recon', detail: 'read-only: touch points, i18n impact, test plan' },
    { title: 'Build', detail: 'implement to green typecheck and tests' },
    { title: 'Verify', detail: 'gates, adversarial audit, balance, the screen, a full run' },
    { title: 'Mutation', detail: 'break the rule on purpose, prove a test bites' },
    { title: 'Fix', detail: 'repair what verify reported' },
    { title: 'Deliver', detail: 'branch, commit, push, open the PR' },
  ],
}

// Each role's stance, tools and effort live in .claude/agents/tupatro-*.md — one file per role,
// so a prompt change is a readable diff and the role is reusable outside this workflow.
//
// LAW is the cross-cutting part, and it lives here rather than in the role files so there is one
// copy to update. It goes to every role EXCEPT tupatro-audit: handing the auditor the same
// checklist the builder worked from turns verification into agreement, so it derives its own from
// CLAUDE.md. Keep that asymmetry.
const LAW = `Project: Tupatro — the Finnish trick-taking game tuppi in a Balatro roguelike
structure. React 19 + TypeScript + Vite. One useReducer store over a pure, framework-free core.

FIRST: read CLAUDE.md at the repo root and obey it literally. It is dense and non-negotiable.
Read README.md too if the work touches rules or balance.

The laws below are the ones broken silently — CLAUDE.md is still the authority, and it holds more:
- The pure core stays pure. game/{cards,constants,content,rng,rules,scoring,ai,shop,schedule,
  types,actions} take state as a parameter and never import React, the DOM, the reducer, a
  component, or i18n. invariants.test.ts enforces this.
- The reducer is pure. RNG state (g.rngState) and the uid counter (g.uidSeq) live in the state,
  never in module variables. There is no module-level \`let\` anywhere in src/.
- No player-facing string outside src/i18n/. Add the key to fi.ts first; en.ts then fails to
  compile until it has the key too. Placeholder sets must match across both locales. Numbers go
  through fmt(). Strings carrying <b>/<i> render through <Rich>.
- Card identity is uid, never id. currentWinner compares with a strict \`>\` — do not relax it.
- Math.random has exactly one legal call site: makeSeed() in rng.ts.
- useGameLoop is the only setTimeout call site in the project.
- The scoring order in scoreTrick is locked: card additions, joker additions, card multipliers,
  joker multipliers, then retriggers and money. scoreTrick returns ctx.payout and never mutates
  g.money.
- A new phase has four touch points: nextTick, Panels, Hint, and SPREAD_PHASES in Hand.tsx.
- A new enhancement has four touch points: legalCards, currentWinner, evalTrick, and
  chipValue/scoreTrick.
- Tuppi's rules are never invented. Verify against the Oulunsalo senior tuppi club rule sheet
  (Antti Auer, 9 September 2022) or https://korttipeliopas.fi/tuppi. Where a rule is open to
  interpretation, write the chosen reading into a comment. A rule change must also update the
  rules panel (components/screens/Rules.tsx) and README.md.
- Balance is measured headlessly with src/test/bot.ts and game/drive.ts, never guessed.
- Everything written for developers is English. Finnish appears in src/ only as data in fi.ts.
- Guard clauses over nesting. Comments say why, not what. Formatting is Prettier's job.

Gates: npm run lint, npm run typecheck, npx prettier --check "**/*.{ts,tsx,json,md,html}",
npm test, npm run build.`

const SPEC_SCHEMA = {
  type: 'object',
  required: ['specPath', 'slug', 'kind', 'title', 'summary', 'acceptanceCriteria', 'assumptions', 'touchPoints', 'outOfScope'],
  properties: {
    specPath: { type: 'string', description: 'docs/specs/<date>-<slug>.md, the file you wrote' },
    slug: { type: 'string' },
    kind: { type: 'string', enum: ['rule', 'scoring', 'balance', 'ui', 'i18n', 'infra'] },
    title: { type: 'string' },
    summary: { type: 'string' },
    acceptanceCriteria: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    assumptions: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    touchPoints: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    outOfScope: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    source: { type: 'string', description: 'Rule citation, empty when kind is not rule or scoring' },
  },
}

const RECON_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: { type: 'array', items: { type: 'string' }, maxItems: 30, description: 'Concrete, file:line where possible' },
    unforeseen: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'What the spec did not anticipate' },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 10 },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  required: ['filesChanged', 'summary', 'testsAdded', 'localGatesPass'],
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' }, maxItems: 40 },
    summary: { type: 'string' },
    testsAdded: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    localGatesPass: { type: 'boolean' },
    omitted: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'Acceptance criteria not met, and why' },
    notes: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['pass', 'failures'],
  properties: {
    pass: { type: 'boolean' },
    checked: { type: 'array', items: { type: 'string' }, maxItems: 25, description: 'What you examined, and why each is clean' },
    failures: {
      type: 'array',
      maxItems: 20,
      description: 'Most severe first — the cap truncates the tail, so order matters',
      items: {
        type: 'object',
        required: ['what', 'detail'],
        properties: { what: { type: 'string' }, detail: { type: 'string' }, file: { type: 'string' } },
      },
    },
    notes: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  },
}

const DELIVER_SCHEMA = {
  type: 'object',
  required: ['branch', 'prUrl', 'committed'],
  properties: {
    branch: { type: 'string' },
    prUrl: { type: 'string' },
    committed: { type: 'boolean' },
    commitSubject: { type: 'string' },
    problems: { type: 'array', items: { type: 'string' }, maxItems: 10 },
  },
}

const a = args || {}
const date = a.date
if (!date) throw new Error('args.date is required (scripts cannot read the clock); pass YYYY-MM-DD')

const isRework = Boolean(a.reviewNotes)

// ---------------------------------------------------------------- Spec
let spec
if (isRework) {
  if (!a.specPath) throw new Error('rework needs args.specPath')
  spec = {
    specPath: a.specPath,
    slug: a.slug || 'rework',
    kind: a.kind || 'rule',
    title: a.title || 'rework',
    summary: 'Rework of an existing spec after review.',
    acceptanceCriteria: [],
    assumptions: [],
    touchPoints: [],
    outOfScope: [],
    source: '',
  }
  log('Rework: skipping Spec and Recon, entering Build from review notes.')
} else {
  phase('Spec')
  spec = await agent(
    `${LAW}

Write the requirement below as a versioned spec at docs/specs/${date}-<slug>.md, following
docs/specs/TEMPLATE.md exactly.

REQUIREMENT (from the user, verbatim):
${a.requirement}`,
    { label: 'spec', agentType: 'tupatro-spec', schema: SPEC_SCHEMA },
  )
  if (!spec) throw new Error('Spec stage produced nothing; aborting')
  log(`Spec: ${spec.specPath} (kind=${spec.kind})`)
}

// ---------------------------------------------------------------- Recon
const RECON_TASKS = [
  {
    key: 'touch points',
    label: 'recon:touchpoints',
    task: `Locate every place the spec must touch, with file:line.

Be exhaustive about the documented touch-point sets: a new phase needs nextTick, Panels, Hint and
SPREAD_PHASES; a new enhancement needs legalCards, currentWinner, evalTrick and
chipValue/scoreTrick.`,
  },
  {
    key: 'i18n',
    label: 'recon:i18n',
    task: `Work out the i18n impact of the spec.

Report every new catalogue key needed (dotted and flat, e.g. area.thing), the Finnish and English
wording you propose for each, and which file and component each t()/tList()/nameOf()/descOf() call
lands in. Flag anything needing <Rich> (carries <b>/<i>), <Interpolate> (a formatted value inside a
sentence), fmt() (a number), or suitPart.* (a suit inside a Finnish partitive sentence).`,
  },
  {
    key: 'tests',
    label: 'recon:tests',
    task: `Design the test plan for the spec.

Report which existing tests already constrain this area and would fail, naming file and test; which
new assertions are needed and in which existing co-located test file each belongs; and — the
important part — for each new assertion, the exact one-line mutation to source that would prove it
bites. An assertion using a card that would not have won anyway proves nothing; pick inputs where
the rule is load-bearing.`,
  },
]

let recon = []
if (!isRework) {
  phase('Recon')
  recon = (await parallel(
    RECON_TASKS.map((t) => () =>
      agent(`${LAW}\n\nSPEC: ${spec.specPath}\n\n${t.task}`, {
        label: t.label,
        phase: 'Recon',
        agentType: 'tupatro-recon',
        schema: RECON_SCHEMA,
      }),
    ),
  )).filter(Boolean)
  log(`Recon: ${recon.reduce((n, r) => n + r.findings.length, 0)} findings`)
}

function reconBlock(r, i) {
  const head = `[${(RECON_TASKS[i] && RECON_TASKS[i].key) || `recon ${i}`}]`
  const lines = r.findings.map((f) => `- ${f}`)
  const extra = (r.unforeseen || []).map((f) => `- (not in the spec) ${f}`)
  const risks = (r.risks || []).map((x) => `- risk: ${x}`)
  return [head, ...lines, ...extra, ...risks].join('\n')
}

const brief = isRework
  ? `You are reworking an existing change after human review.

SPEC: ${a.specPath}
BRANCH: ${a.branch}

REVIEW FEEDBACK TO ADDRESS (verbatim):
${a.reviewNotes}`
  : `SPEC: ${spec.specPath} (kind=${spec.kind})

RECON FINDINGS:
${recon.map(reconBlock).join('\n\n')}`

// ---------------------------------------------------------------- Build
phase('Build')
const build = await agent(`${LAW}\n\nImplement the change.\n\n${brief}`, {
  label: 'build',
  agentType: 'tupatro-build',
  schema: BUILD_SCHEMA,
})
if (!build) throw new Error('Build stage produced nothing; aborting before delivery')
log(`Build: ${build.filesChanged.length} files, local gates ${build.localGatesPass ? 'green' : 'RED'}`)
if (build.omitted && build.omitted.length) log(`Build omitted ${build.omitted.length} criteria — see the result`)

// ---------------------------------------------------------------- Verify
const wantsBalance = ['balance', 'rule', 'scoring'].includes(spec.kind)
const wantsMutation = ['rule', 'scoring'].includes(spec.kind)
// Text length changes layout, so i18n gets the screen check too — a button that fits in English
// overflows in Finnish more often than the reverse.
const wantsScreen = ['ui', 'i18n'].includes(spec.kind)
// Anything touching gameplay can make a run unfinishable. infra and i18n cannot.
const wantsPlaytest = ['rule', 'scoring', 'balance', 'ui'].includes(spec.kind)

// One entry per verification stage, so a re-verify after a fix can re-run just the stages that
// failed instead of the whole fan-out. A clean run costs 4 agents here; only a failing one pays
// for more. `gates` always re-runs — a fix can break anything.
function verifyRegistry(round) {
  const reg = {
    gates: () =>
      agent(`${LAW}\n\nRun every gate against the current working tree and report exactly what failed.`, {
        label: `verify:gates r${round}`,
        phase: 'Verify',
        agentType: 'tupatro-gates',
        schema: VERDICT_SCHEMA,
      }),
    // No LAW here, deliberately — see the comment on LAW above.
    audit: () =>
      agent(
        `Audit the uncommitted diff in this repository.

SPEC: ${spec.specPath} — its acceptance criteria are part of what you check.

Derive the rules you enforce from CLAUDE.md yourself. You have not been given a checklist, and that
is on purpose.`,
        { label: `verify:audit r${round}`, phase: 'Verify', agentType: 'tupatro-audit', schema: VERDICT_SCHEMA },
      ),
  }
  if (wantsPlaytest) {
    reg.playtest = () =>
      agent(
        `${LAW}\n\nDrive a full run headlessly and report how far it gets.

SPEC: ${spec.specPath} (kind=${spec.kind})`,
        { label: `verify:playtest r${round}`, phase: 'Verify', agentType: 'tupatro-playtest', schema: VERDICT_SCHEMA },
      )
  }
  if (wantsBalance) {
    reg.balance = () =>
      agent(
        `${LAW}\n\nMeasure the balance effect of the current uncommitted change, headlessly.

SPEC: ${spec.specPath} (kind=${spec.kind})`,
        { label: `verify:balance r${round}`, phase: 'Verify', agentType: 'tupatro-balance', schema: VERDICT_SCHEMA },
      )
  }
  if (wantsScreen) {
    reg.screen = () =>
      agent(
        `${LAW}\n\nLook at the running game in the browser and report what you see.

SPEC: ${spec.specPath} (kind=${spec.kind})

Reach the phases and screens the spec touches. Check the panel-scroll law at a window height of
about 500 px, both locales, and the console.`,
        { label: `verify:screen r${round}`, phase: 'Verify', agentType: 'tupatro-screen', schema: VERDICT_SCHEMA },
      )
  }
  return reg
}

async function runVerify(round, only) {
  phase('Verify')
  const reg = verifyRegistry(round)
  const keys = affordable(Object.keys(reg).filter((k) => !only || k === 'gates' || only.includes(k)))
  if (only) log(`Verify round ${round}: re-running ${keys.join(', ')}`)
  const out = await parallel(keys.map((k) => reg[k]))
  return keys.map((k, i) => ({ stage: k, v: out[i] })).filter((r) => r.v)
}

function failuresOf(results) {
  return results.flatMap(({ stage, v }) => (v.pass ? [] : v.failures.map((f) => ({ ...f, stage }))))
}

// A clean run is about eleven agents. If the user set a token target, spend it on the two stages
// that always matter and drop the optional ones rather than starting a fan-out that dies halfway.
// Nothing here is a silent cap: every drop is logged.
const OPTIONAL = ['playtest', 'balance', 'screen']
function affordable(keys) {
  if (!budget.total) return keys
  const left = budget.remaining()
  if (left > 150_000) return keys
  const kept = keys.filter((k) => !OPTIONAL.includes(k))
  const dropped = keys.filter((k) => OPTIONAL.includes(k))
  if (dropped.length) log(`Budget: ${Math.round(left / 1000)}k left — dropping ${dropped.join(', ')}`)
  return kept
}

let verify = await runVerify(1)
let failures = failuresOf(verify)
log(`Verify round 1: ${failures.length} failures`)

// ---------------------------------------------------------------- Fix loop
for (let round = 1; round <= 2 && failures.length; round++) {
  if (budget.total && budget.remaining() < 80_000) {
    log(`Budget: ${Math.round(budget.remaining() / 1000)}k left — stopping after ${round - 1} fix rounds with ${failures.length} failures outstanding`)
    break
  }
  phase('Fix')
  const stages = [...new Set(failures.map((f) => f.stage))]
  const fixed = await agent(
    `${LAW}

Verification failed. Fix every failure below in the working tree, then loop the gates to green.

SPEC: ${spec.specPath}

FAILURES:
${failures.map((f) => `- [${f.stage}/${f.what}]${f.file ? ' ' + f.file : ''}: ${f.detail}`).join('\n')}

If a failure is a false positive, say so in notes with the evidence rather than changing anything.`,
    { label: `fix r${round}`, phase: 'Fix', agentType: 'tupatro-build', schema: BUILD_SCHEMA },
  )
  log(`Fix round ${round}: ${fixed ? fixed.filesChanged.length + ' files' : 'agent returned nothing'}`)
  verify = await runVerify(round + 1, stages)
  failures = failuresOf(verify)
  log(`Verify round ${round + 1}: ${failures.length} failures`)
}
if (failures.length) {
  log(`Giving up after 2 fix rounds with ${failures.length} failures outstanding — the PR will say so.`)
}

// ---------------------------------------------------------------- Mutation
let mutation = null
if (wantsMutation && !failures.length && budget.total && budget.remaining() < 60_000) {
  log(`Budget: ${Math.round(budget.remaining() / 1000)}k left — skipping the mutation stage; the PR will not claim the new tests were proven`)
}
if (wantsMutation && !failures.length && !(budget.total && budget.remaining() < 60_000)) {
  phase('Mutation')
  mutation = await agent(
    `${LAW}

Prove the new tests actually bite.

SPEC: ${spec.specPath}
New tests in this change: ${build.testsAdded.join(', ') || '(see git diff)'}`,
    { label: 'mutation', agentType: 'tupatro-mutation', schema: VERDICT_SCHEMA },
  )
  if (mutation && !mutation.pass) {
    log(`Mutation: ${mutation.failures.length} assertions do not bite`)
    phase('Fix')
    await agent(
      `${LAW}

Mutation testing found assertions that pass even when the rule is broken. Strengthen them.

SPEC: ${spec.specPath}

${mutation.failures.map((f) => `- ${f.what}: ${f.detail}`).join('\n')}

Pick inputs where the rule is load-bearing. Re-run npm test until green.`,
      { label: 'fix:mutation', phase: 'Fix', agentType: 'tupatro-build', schema: BUILD_SCHEMA },
    )
  }
}

// ---------------------------------------------------------------- Deliver
phase('Deliver')
const criteria = spec.acceptanceCriteria.length
  ? spec.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')
  : '- [ ] (see the spec)'
const assumptions = spec.assumptions.length ? spec.assumptions.map((x) => `- ${x}`).join('\n') : '- none recorded'
const verifyNotes = verify.flatMap(({ stage, v }) => (v.notes || []).map((n) => `- ${stage}: ${n}`)).join('\n')
const omitted = (build.omitted || []).map((x) => `- ${x}`).join('\n')
// An audit or screen failure leaves the tree green, so it would otherwise reach the reviewer as
// a clean pull request. Put it in the body.
const outstanding = failures.map((f) => `- **${f.stage}** ${f.what}${f.file ? ` (${f.file})` : ''}: ${f.detail}`).join('\n')

const delivery = await agent(
  `${LAW}

Deliver the finished change as a pull request.

BRANCH: ${isRework ? `${a.branch} — it already exists, check it out rather than creating it` : `spec/${date}-${spec.slug}`}
SPEC FILE to include in the commit: ${spec.specPath}
${isRework ? 'A pull request already exists for this branch: push to it rather than opening a second one.' : ''}

The pull request body must be exactly this shape, because the human reviews against it rather than
against the diff:

## What
${spec.summary}

Spec: \`${spec.specPath}\`

## Acceptance criteria
${criteria}

## Assumptions the agent made
${assumptions}
${omitted ? `\n## Not delivered\n${omitted}\n` : ''}${outstanding ? `\n## Verification still failing\n${outstanding}\n` : ''}
## Verification
State which gates ran and their result, what the audit checked${wantsPlaytest ? ', how far a headless run got' : ''}${wantsScreen ? ', what the screen check found at 500 px and in both locales' : ''}${wantsBalance ? ', the balance numbers measured' : ''}${wantsMutation ? ', and which mutations were confirmed to make a test fail' : ''}.
${verifyNotes ? `\nNotes gathered during verification:\n${verifyNotes}\n` : ''}
---

Tick only the criteria you verified yourself.${outstanding ? `

Two fix rounds did not clear every failure. Open the pull request anyway with the Verification
still failing section intact — the human decides what to do about it — but say so in your problems
field, and still refuse to commit if the tests themselves are red.` : ''}`,
  { label: 'deliver', agentType: 'tupatro-deliver', schema: DELIVER_SCHEMA },
)

return {
  spec: spec.specPath,
  kind: spec.kind,
  filesChanged: build.filesChanged,
  omitted: build.omitted || [],
  outstandingFailures: failures,
  mutation: mutation ? { pass: mutation.pass, notes: mutation.notes || [] } : 'not applicable',
  verifyNotes: verify.flatMap(({ stage, v }) => (v.notes || []).map((n) => `${stage}: ${n}`)),
  branch: delivery && delivery.branch,
  pr: delivery && delivery.prUrl,
  committed: Boolean(delivery && delivery.committed),
  problems: (delivery && delivery.problems) || [],
}
