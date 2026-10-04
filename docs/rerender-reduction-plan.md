# ITEMX 재렌더 요소 감축 계획 (2026-10-04, 기준: 라이브 2.4.0)

기준 소스는 `itemx24-fix`이고, `dist/itemx2.plugin.js`의 MD5 89b54a73…가 라이브 파일과 같다.
호스트 동작은 해적 b7437 소스(`build/haejeok-b7437/src`)를 읽어서 확인했다. 브라우저 실측은 아직 하지 않았다.

## 1. 스트리밍 중 호스트가 하는 일

설정 `스트리밍 표시 최적화`(`streamingDisplayOptimizationMode`)에 따라 경로가 달라진다.
기존 DB를 정규화하면 기본값이 `off`이고, 새 DB의 기본값은 `strong`이다. 라이브 사용자가 어떤 값을 쓰는지는 아직 확인하지 않았다.

| 모드 | 청크당 editoutput (ITEMX `output`) | 메시지 다시 그리기 | 그릴 때 editdisplay (ITEMX `display`) |
|---|---|---|---|
| off | 매 청크 | 매 청크마다 시그니처 `data`가 바뀌어 **Chat 컴포넌트를 unmount 후 mount** | 매 청크 |
| balanced | 125ms 타이머 + rAF로 묶어서 1회 | `updateStreamingDisplay` → ChatBody `{@html}` 교체 | 매 flush |
| strong | **스트림이 끝난 뒤 1회** | 원문 텍스트를 그대로 표시(파싱 없음) | 끝난 뒤 |

근거: `streamingDisplay.svelte.ts` `writeDisplayResult`/`scheduleDisplayFlush`, `Chats.svelte` `sameRenderSignature`, `Chat.svelte` `renderRawStreaming`.

- `afterRequest` replacer는 `chatRequestOrchestrator.ts`에서 `response.type === "success"`(비스트리밍)일 때만 돈다. 스트리밍에서는 ITEMX `output` 스크립트 핸들러(`outputFallback` → `processOutput`)만 실행된다.
- 매 flush마다 메시지 **전체 텍스트**가 editoutput → editdisplay를 다시 지나간다. 앞부분에 이미 나온 카드도 매번 HTML이 새로 삽입된다.

## 2. 출력이 화면에 나오는 시점

### balanced / off
1. 모델이 전송 태그(`<itemPatch …>` 등)를 닫으면 바로 다음 flush에서 `processOutput`이 앵커로 바꾸고 기록을 pending에 넣는다(`addPending`). `markers`와 `markers-armed`가 발생한다.
2. 같은 flush의 display에서 pending 기록으로 **카드가 스트리밍 중에 나타난다**. 최신 응답 카드는 `motion: lite`이다.
3. 이후 125ms마다 카드 DOM이 통째로 교체되므로 lite 애니메이션이 매번 처음부터 다시 시작된다.
4. 스트림이 끝나면 `isStreaming=false`가 되고 `reloadKeys`가 증가한다. `activeStreaming` 시그니처가 바뀌어 **remount 1회**가 일어난다.
5. 출력 트리거와 인레이를 적용한다. 데이터가 바뀌면 **remount 1회**가 더 일어난다.
6. `runChatOutputListeners` → ITEMX listener가 `commitEventBursts`와 `scheduleCommittedOutputSync`를 실행한다.
   → `commitLatestOutput`가 원장을 씀(`setChatToIndex`로 채팅 통째 교체). 원시 태그를 복구해 본문이 바뀐 경우에만 해당 메시지 **remount 1회**.
   → `syncAfterCommit`: `rebuildCurrent`를 돌리고 `chat-synced` → `ensureRootInventory`로 이어진다.
7. 버스트 효과는 0 / 350 / 1000ms에 실행된다. 보조 복구는 본문이 1.5초(`ITEMX_AUX_SETTLE_MS`) 동안 그대로일 때 시작한다. 쓰기가 발생하면 **remount가 또 1회** 일어난다.

### strong
- 스트리밍 중에는 원문만 보인다. 코드상으로는 **원시 전송 태그가 글자 그대로 보일 수 있다**(editoutput/display를 거치지 않음). 실측으로 확인해야 한다.
- 카드는 스트림이 끝난 뒤 위 4번 단계부터 처음 나타난다.

## 3. ITEMX가 스트리밍 중에 일으키는 재렌더·브리지 비용

| # | 요소 | 위치 | 비용 |
|---|---|---|---|
| A | 카드 HTML 재삽입 | `ui/presentation.js` `displayHandler` | flush마다 카드 1장당 요소 약 40개(`tests/fixtures/render-snapshots.json` 기준 32–45개) + lite 파티클을 새로 만들고, 애니메이션이 처음부터 다시 시작된다 |
| B | MutationObserver | `ui/panel.js` `installHostObserver` | body 전체 `subtree`를 관찰한다. flush마다 콜백이 오고, 콜백마다 `unwarpSafeArray`·`getTarget`·`matches` 브리지 왕복이 최대 5회 일어난다 |
| C | 호스트 동기화 | `scheduleHostDomSync(320)` → `ensureRootInventoryNow` | 디바운스가 걸려 있어 flush 간격이 320ms를 넘을 때(느린 모델·정지 구간)만 실행된다. 실행되면 `getCharacter()`(캐릭터 전체 스냅샷)와 `getChatFromIndex()`(채팅 전체 스냅샷)를 iframe으로 복사한다. **스트리밍 여부를 확인하지 않는다** |
| D | `processOutput` | `pipeline.js` | flush마다 전체 본문에 `anchorize`, `prepareInlinePortraits`, emit 2회를 실행한다. 본문이 길수록 비용이 선형으로 늘어난다 |
| E | 배지 갱신 | `syncBadgeDelta` | HTML이 같으면 건너뛴다. 변화가 있을 때만 `setInnerHTML` 1회. 현재도 비용이 낮다 |
| F | 종료 후 remount 연쇄 | 호스트 + ITEMX 커밋/보조 쓰기 | 2–4회. 매번 메시지 전체 `{@html}`과 카드 재생성이 일어난다 |

## 4-0. 구현 결과 (2026-10-04, 2.5.0에 포함, 미배포)

- 1번은 카드 HTML을 바꾸지 않는 방식으로 구현했다. 스트리밍 중에는 body에 `x-risu-itemx-body-streaming` 클래스를 붙여 애니메이션만 멈춘다. 기존 스크롤 일시정지 CSS를 그대로 복제했다.
  pending 카드를 motion off로 그리는 원안은 쓰지 않았다. 커밋 때 본문이 그대로면 호스트가 다시 그리지 않으므로, 카드가 효과 없는 상태로 남는다.
- 출력 구간은 `src/activity.js`에 있다. output 훅이 호출될 때마다 열리고, 다음 중 하나가 일어나면 닫힌다: chat listener 호출, 1.5초 동안 flush 없음, 채팅 전환, 브라우저 복귀, 언로드.
- 3번은 출력 구간 동안 observer 분류와 호스트 동기화를 보류한다. 채팅 인덱스 두 값만 읽어서 채팅 전환 여부를 판단하고, 전환됐으면 즉시 동기화한다.
- 4번은 메모 대신 `positionMarkersByNarrative`에서 문단 정규화를 한 번만 하도록 바꿨다(순수 함수 재배치). 측정값은 4.3ms에서 3.3ms로 줄었다.
- 테스트: `streaming-equivalence`(2.4.0 기준선 고정), `output-window` 6건. 전체 312/312 통과, lint와 prettier도 통과.

## 4. 감축안 (ITEMX만 수정, 효과 순)

원칙: 호스트(해적 코어)·nginx·DB는 건드리지 않는다. 바꾸는 것은 `itemx24-fix/src`뿐이다.
각 항목은 **"언제 하느냐"만 바꾸고 "무엇을 하느냐"는 그대로 둔다.** 스트림이 끝난 뒤의 최종 결과(본문 텍스트, 원장, 화면 카드)는 지금과 바이트 단위로 같아야 한다.

| 순서 | 항목 | 바뀌는 것 | 최종 결과 영향 | 위험 |
|---|---|---|---|---|
| 1 | 미커밋(pending) 카드 정적 표시 | 스트리밍 중 카드 motion `lite`를 `off`로 | 없음. 커밋 후 remount 때 지금과 같은 lite 카드 | 낮음 |
| 2 | 스킬·조우 인라인 카드 HTML 캐시 | 문자열을 다시 만들지 않음 | 없음. 캐시 키에 key·motion·초상·스킨을 모두 포함 | 낮음 |
| 3 | 스트리밍 중 observer 분류·호스트 동기화 보류 | 브리지 왕복 시점 | 없음. 끝난 뒤 1회 동기화 보장 | 중간(보류 해제 누락 시 드로어 갱신이 멈춤) |
| 4 | `processOutput` 증분 재사용 | 같은 원시 구간이면 이전 결과 반환 | 없음. 입력 문자열이 같을 때만 재사용 | 중간(캐시 키 실수 시 카드 누락) |

다음 항목은 **제외**한다(버그 위험이 효과보다 큼).
- 커밋 쓰기와 보조 복구 쓰기 합치기: 삭제·리롤 경합 경로를 바꾼다.
- observer 감시 범위 좁히기: 드로어 언마운트 감지 경로를 바꾼다.
- 코어 쪽 문제(off 모드 청크마다 remount, strong 모드 원시 태그 노출): 플러그인 범위 밖이다. 사용자 안내로만 대응한다.

## 4-1. 버그를 만들지 않기 위한 절차

1. **기준선 고정**: 수정 전 `npm test` 305/305 통과(2026-10-04 확인). 빌드 결과 MD5가 라이브와 같다(89b54a73…). 이 두 값을 비교 기준으로 쓴다.
2. **항목당 커밋 1개**: 네 항목을 따로 커밋해서, 문제가 생기면 그 커밋만 되돌린다.
3. **동치 테스트를 먼저 작성**: 고치기 전에 테스트를 추가하고, 현재 코드에서 통과하는 것을 확인한 뒤 수정한다.
   - 같은 스트림 조각열(전송 태그가 중간에 잘리는 경우 포함)을 넣었을 때, 수정 전과 후의 **최종 본문·원장 events·최종 display HTML**이 같아야 한다.
   - 1번: pending 키는 off 카드로, 커밋 후에는 기존과 같은 lite 카드로 그려지는지 확인한다.
   - 3번: 스트리밍 플래그가 어떤 경로(정상 종료·중단·리롤·채팅 전환·언로드·listener 미지원)로 끝나도 반드시 해제되고, 해제 뒤 동기화가 1회 실행되는지 확인한다. 안전장치로 플래그는 일정 시간(예: 60초)이 지나면 자동 해제한다.
   - 4번: 입력이 한 글자라도 다르면 재사용하지 않는지 확인한다.
4. **기존 테스트 전부 통과**: 특히 `aux-delete-inflight`, `chat-concurrency`, `render-snapshot`, `render-parity` 테스트. 렌더 스냅샷(`tests/fixtures/render-snapshots.json`)은 변경되면 안 된다. 바뀌면 실패로 본다.
5. **로컬 실브라우저 확인**: 라이브에 올리기 전에 같은 빌드를 실제 채팅에서 돌린다. 균형·강함·끄기 세 모드에서 카드 2장 이상 응답, 중단, 리롤, 삭제, 채팅 전환을 각각 확인한다.
6. **배포와 롤백**: 2.4.0 dist를 백업해 두고 교체한다. 문제가 생기면 그 파일을 다시 올리는 것으로 즉시 롤백한다. 데이터 형식(원장·앵커)은 바꾸지 않으므로 롤백해도 기록이 깨지지 않는다.

## 5. 확인·측정 절차

1. 라이브 사용자 설정에서 `streamingDisplayOptimizationMode` 값을 확인한다(설정 → 고급 → 스트리밍 표시 최적화).
2. Playwright와 실제 라이브 탭에서, 카드 2장 이상이 나오는 응답으로 모드 3종을 측정한다.
   - 스트리밍 중 `.chattext [x-itemx2-event]`가 처음 나타나는 시각과 스트림 종료 시각을 기록한다.
   - flush별 MutationObserver 레코드 수를 센다(테스트용 observer를 별도로 붙인다).
   - 메시지 컨테이너 교체 횟수: `chat-message-container` 자식 노드의 동일성이 몇 번 바뀌는지 센다.
   - `debugRecord` 타이밍(`host:readChat`)이 스트리밍 중에 찍히는지 확인한다.
   - strong 모드에서 원시 `<itemPatch` 텍스트가 보이는지 확인한다.
3. 1단계 적용 후 같은 시나리오를 다시 측정한다. 목표는 다음과 같다.
   - 스트리밍 중 ITEMX 브리지 호출 0회
   - 카드 애니메이션 재시작 0회
   - 종료 후 remount를 호스트 기본값(2회) + ITEMX 0–1회로 줄이기

## 6. 버전

한 묶음으로 처리해 버전을 한 번만 올린다. 번호는 사용자에게 확인한다.
