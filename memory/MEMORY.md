# vibemon-agent Project Memory

## Project Overview
- Next.js 14+ App Router 기반 자율 AI Agent 런타임
- SQLite (better-sqlite3) + sqlite-vec + OpenAI/Anthropic (LLM_PROVIDER 선택)
- 4개 런타임 루프: Interactive (agentic loop), Job Runner, Scheduler, Maintenance
- Agentic Loop: think → tool_call → observe → repeat (max 10 iterations)

## Key Files
- `src/lib/db/index.ts` — getDb() 싱글톤
- `src/lib/db/schema.sql` + `index.ts` 인라인 (둘 다 수정 필요)
- `src/lib/jobs/runner.ts` — Tool side-effect import 위치
- `src/lib/tools/registry.ts` — Tool 인터페이스 정의 (Job Runner용)
- `src/lib/llm/client.ts` — getClient() LLM 팩토리 (동기 함수)
- `src/lib/agent/loop.ts` — runAgentLoop() 핵심 agentic loop
- `src/lib/agent/tools.ts` — 8개 에이전트 도구 정의
- `src/lib/memory/conversations.ts` — 다중 턴 대화 히스토리
- `src/lib/agent/context.ts` — buildAgentContext() soul→rule→summary 우선순위

## Critical Invariants
- `getDb()`로만 DB 접근 (new Database() 금지)
- JSON 컬럼: tags, tools, preferences, evidence 등은 JSON.parse/stringify 필수
- Tool 등록: runner.ts 상단 import로 side-effect 등록 (Job Runner 도구)
- runJob()은 절대 await 금지 (fire-and-forget)
- Next.js 15+ 동적 params: `const { id } = await params`
- schema.sql과 index.ts 인라인 스키마 동시 수정 필수
- NoteKind 타입: `'log' | 'summary' | 'rule' | 'soul'` (notes.ts에서 export)
- soul 노트: supersededBy 필터 필수 (context.ts 참조)
- Agent 도구의 LLMTool.inputSchema: `type: 'object'` 필드 반드시 포함

## Autonomous Agent Architecture (2026-02-25 추가)
- `memory_notes.kind`: log/summary/rule/**soul** (soul = 에이전트 정체성, permanent)
- `conversations` 테이블: 다중 턴 대화 히스토리 (user/assistant/assistant_tool_calls/tool_results)
- LLM Provider: LLM_PROVIDER=openai|anthropic 환경변수로 선택 (미설정 시 자동)
- SSRF 방어: fetch_url.ts에서 private IP 차단 적용
- Cron 제한: create_schedule.ts에서 패턴 화이트리스트 + 최소 5분 간격

## Documentation
- `docs/README.md` — 인덱스 + Critical Invariants
- `docs/architecture/` — overview, data-model, runtime-loops, memory-system
- `docs/guides/` — add-tool, add-api-route, modify-schema
- `docs/plans/2026-02-25-autonomous-agent-design.md` — 자율 에이전트 설계 결정
- AI 기여자 대상, MUST/NEVER 명시어, 코드 템플릿 포함

## Completed Work
- CLAUDE.md 생성 (루트)
- docs/ 전체 아키텍처 문서 세트 작성 (2026-02-25)
- 자율 AI Agent 전환 완료 (2026-02-25): Tasks 1-15 모두 완료
