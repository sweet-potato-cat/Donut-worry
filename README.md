# 🍩 Donut worry 🍩
> "강의 자료 관리, 과제 확인, 공지사항 체크까지? 이젠 Donut worry! 저에게 맡기세요."
> 대학생들의 스마트한 e-Campus 학업 관리를 위한 단축키 기반 휠(Wheel) UI 대시보드 토이 프로젝트입니다.

---

## ✨ 핵심 철학 (Core Philosophy)
* **Minimal & Fast UX**: 복잡한 웹사이트 클릭 없이, 단 한 번의 단축키와 마우스 호버(Hover)만으로 대학 생활에 필요한 모든 학업 정보에 접근합니다.
* **Context-Driven UI**: 도넛 형태의 간결한 UI 인터페이스를 통해 화면을 크게 차지하지 않으면서도 강력한 위젯 기능을 제공합니다.

---

## 🛠️ 주요 기능 (Key Features)

### 1. 강의 자료 자동 정제 및 다운로드
* e-Campus 웹사이트에서 강의 자료를 주기적으로 스크래핑합니다.
* 의미 없는 파일명(ex: `20260124.pdf`)을 분석하여 지정된 규칙(`[과목명] X강 X월X일.pdf`)으로 변환 후 과목별 디렉토리에 자동 분류 저장합니다.

### 2. 지능형 공지사항 및 과제 요약 (LLM 기반)
* 새로 올라온 공지사항 및 과제 상세 내용을 자연어 처리(NLP)를 통해 **핵심 3줄 요약**으로 제공합니다.
* 과제 정보(마감일, 배점, 중요도)를 추출하여 마감 임박 순으로 정렬합니다.

### 3. 미시청 콘텐츠 트래커
* 아직 수강 완료하지 않은 동영상 강의 목록을 실시간으로 추적하여 유저에게 리마인드합니다.

### 4. 성적 시뮬레이터
* 과목별 성적 반영 비율(출석, 과제, 중간, 기말 등)을 입력하고 현재 점수를 기록하면 최종 예상 총점 및 학점 달성을 위한 목표 점수를 자동 계산합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

프로젝트의 경량화와 빠른 반응 속도, 그리고 안전한 로컬 데이터 관리를 위해 다음과 같은 기술 스택을 활용하여 개발되었습니다.

### 💻 Technologies & Libraries

<div id="badges">
  <img src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white"/>
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white"/>
</div>

| 분류 | 기술 스택 | 선택 이유 (Rethinking) |
| :--- | :--- | :--- |
| **App Framework** | Electron + React | 웹 기술(HTML/CSS/JS)을 활용하여 독창적인 도넛 형태의 UI를 크로스플랫폼(Mac/Windows) 환경에서 유연하게 구현하기 위해 채택 |
| **Scraper** | Playwright | e-Campus의 세션 유지 및 강의 자료/동영상 트래킹을 가장 안정적으로 자동화할 수 있는 강력한 브라우저 자동화 도구 |
| **Local Database**| SQLite (`better-sqlite3`) | 별도의 서버 없이 유저의 컴퓨터 내에 학업 스케줄, 과제 데이터, 다운로드 이력을 가볍고 빠르게 저장·관리하기 위한 로컬 DB |
| **AI Summarizer** | Anthropic Claude API (`claude-haiku-4-5`) | 공지사항 및 과제 정보를 빠르고 정확하게 핵심 3줄 요약하기 위해 가성비와 속도가 뛰어난 경량 LLM 모델 활용 |
| **Global Shortcut**| Electron `globalShortcut` | 어떤 작업 중에도 `Option` 키 2회, `Cmd+1~4` 단축키를 눌렀을 때 백그라운드에서 즉시 도넛 UI를 팝업하기 위한 모듈 |
| **Security** | `keytar` (OS 키체인) | 유저의 e-Campus 계정 자격 증명(ID/PW) 정보를 로컬에 평문으로 저장하지 않고, OS 보안 키체인(Keychain/Credential)에 안전하게 암호화 보관 |
| **Build & Deploy** | `electron-builder` | 최종 사용자가 쉽게 다운로드하여 설치할 수 있도록 `.dmg` (Mac) 및 `.exe` (Windows) 설치 파일 빌드 자동화 |

---

## 🎨 UI & 인터페이스 구조 (UX/UI Specification)

### 🔴 디자인 테마
* **메인 배경색**: `#fe748a` (도넛 핑크)
* **인터랙션 (Hover)**: 마우스가 섹터 위에 올라가면 섹터가 강조 표시되며 배경색이 `#ffffff`로 반전됩니다.

### ⌨️ 도넛 UI 제어 (Shortcuts)

* **Main 도넛 (`Option` / `Window` 키 2회 입력)**
  * 화면 중앙에 4개의 메인 섹터(강의자료, 공지, 과제, 동영상)를 가진 도넛 UI가 등장합니다. 
  * 마우스 호버 시 각 기능의 퀵 뷰(Quick View)가 활성화됩니다.
* **Sub 도넛 (`Cmd(Ctrl) + 1 ~ 4`)**
  * 각 단축키에 따라 동적으로 도넛의 요소가 변경됩니다.
  * **`Cmd + 1` (강의자료)**: 등록된 수강 과목(최대 7개)이 도넛 섹터가 되며, 호버 시 해당 과목의 로컬 디렉토리 구조를 시각화합니다.
  * **`Cmd + 2` (과제)** / **`Cmd + 3` (미시청 동영상)** / **`Cmd + 4` (공지 요약)** 으로 매끄럽게 전환됩니다.
