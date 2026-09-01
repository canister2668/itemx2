# ITEMX CODEX

> World Inventory & Encounter Archive

현재 공개 베타는 `1.9.0-beta.10`이다. 제품명을 `ITEMX CODEX`로 확장하고 부제를 `World Inventory & Encounter Archive`로 통일했다. 본문 근거에 비해 공격력·강화·특수효과가 빠진 보조 감정은 안전한 partial 상태로 보존한 뒤, 메시지당 한 번의 일괄 보완으로 복구한다. 한 아이템의 보완 실패가 다른 아이템을 지우지 않으며, 실패한 partial은 자동으로 무한 재시도하지 않는다.

모델이 고른 정상 이모지는 그대로 보존하고, 누락·오류·`❔` 아이콘만 아이템·스킬·조우 유형에 맞는 결정론적 폴백으로 교체한다. 기존 SafeDOM 클릭 라우터, 설정 선로딩, 시각 이펙트 토글, 지연 상세 로딩과 스크롤 최적화도 그대로 포함한다.

RisuAI API v3용 ITEMX 플러그인이다. 기존 ITEMX 모듈과의 상태 호환성은 제공하지 않는다.

## 설계

- 모델 응답의 ITEMX 전송 블록을 저장 전에 불투명 HTML 주석 마커로 변환한다.
- 아이템·스킬·조우 도감 사건을 각각 독립 마커로 보존하고 채팅에서 결정론적으로 재생한다.
- 원시 태그와 미완성 태그는 채팅 본문에 남기지 않는다.
- 마커의 사건 로그를 채팅 전체에서 결정론적으로 재생하여 인벤토리를 만든다.
- 파생 스냅숏은 각 채팅의 `scriptstate.$__itemx2_state`에 저장한다.
- 플러그인 설정만 `pluginStorage`에 저장한다.
- 본문 카드와 인벤토리 상세는 `ITEMXRenderer.renderCard()` 하나를 공유한다.
- 인벤토리 열림/탭/선택 상태는 저장하지 않는다. 열기·닫기 애니메이션도 iframe 런타임에서만 실행하며 스트리밍·본문 재처리는 컨테이너를 열지 않는다.
- 본문 스타일은 플러그인이 메인 문서에 상시 소유하고, 권한이 없으면 메시지별 스타일로 폴백한다.
- 플러그인 로드 직후 권한 처리보다 먼저 화면 측면의 `CODEX` 배지를 등록한다.
- 배지 패널은 `인벤 / 스킬 / 조우 도감 / 설정` 네 탭을 제공하며, 현재 봇은 명시적으로 끄지 않는 한 기본 활성이다.
- 네 탭은 선택할 때마다 해당 화면만 생성한다. 다른 탭의 카드·상세 페이지·초상화는 미리 만들지 않는다.
- 패널은 메인 문서의 제한된 플로팅 서랍으로 열려 바깥 화면을 가리지 않는다. 메인 문서 권한을 얻지 못한 호스트에는 동일한 네 탭의 iframe 폴백을 제공한다.
- 스킬 재사용 시간은 턴이 아니라 초·분·시간·일·횟수·조건으로 기록하며, 소모 자원은 각 세계관의 명칭과 단위를 보존한다.
- 조우 도감은 실제 적대·전투 또는 합의된 대련만 등록하고, 비활성 미등장 개체를 모델 문맥에 계속 누적하지 않는다.
- 배지는 처음부터 48×176px인 단일 SVG 이미지로 등록한다. 메인 DOM 스타일 적용 전에도 글자 노드가 펼쳐지지 않으며 설정 탭에서 좌하·좌중·좌상·우하·우중·우상을 선택한다.

## 빌드와 테스트

```bash
git clone https://github.com/canister2668/itemx2.git
cd itemx2
npm run build
npm test
node --check dist/itemx2.plugin.js
```

배포 파일은 `dist/itemx2.plugin.js`, 브라우저 시안은 `dist/itemx2-preview.html`이다.

## 저장소와 업데이트

이 디렉터리가 ITEMX CODEX 소스 저장소다. 내부 플러그인 ID와 저장 키, 전송 규약은 호환성을 위해 `itemx2`와 `ITEMX2`를 유지한다. 다른 제품 저장소의 파일을 빌드 입력으로 사용하지 않는다.

공개 저장소는 [`canister2668/itemx2`](https://github.com/canister2668/itemx2)다. 설치 파일은
[`dist/itemx2.plugin.js`](https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js)에서 직접 받을 수 있다.

RisuAI 표준 업데이트는 빌드 파일 상단의 `//@version`과 `//@update-url`을 사용한다. 현재 업데이트 주소는
다음 공개 파일로 고정하며 비공개 토큰이나 인증 URL을 플러그인에 넣지 않는다.

```text
https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js
```

`1.9.0-beta.*`는 공개 저장소와 자동 업데이트 검증 계보다. 관리자가 아카라이브 게시글 공개를 명시한 시점부터만
`2.0.0-beta.*`로 승격한다.

라이브 NAS 배포는 다음 환경변수로 대상을 명시할 수 있다.

```bash
ITEMX_RISU_DB=/path/to/risu.db \
ITEMX_BACKUP_DIR=/path/to/itemx-backups \
python3 scripts/deploy-live.py
```
