# 어덕해 (Oddoke) - 팬들을 위한 종합 플랫폼

> **어디에서 덕질 해? 어디서든 덕질 해!**  
> 팬들을 위한 특별한 공간에서 굿즈 거래부터 덕질 기록까지

## 프로젝트 소개

어덕해는 아이돌 팬들을 위한 종합 플랫폼으로, 기존 트위터 기반 거래의 불편함을 해소하고 덕질에 필요한 모든 정보를 한 곳에 모은 서비스입니다.

### 기획 배경

현재 아이돌 굿즈 거래, 대여, 생일카페 정보 등이 대부분 트위터(X) 기반으로 이루어지고 있지만, 다음과 같은 문제점들이 존재합니다:

- **정보 검색의 어려움**: 판매자마다 형식이 달라 정보 검색이 어렵고, 사기 위험도 상존
- **원하는 정보 탐색 어려움**: 포카/굿즈 관련 키워드 검색 시 원하는 정보를 찾기 힘듦
- **플랫폼 분산**: 굿즈 거래, 생일카페 정보 등을 여러 플랫폼을 돌아다니며 확인해야 하는 불편함

### 프로젝트 목표

- 트위터 거래에서 발생하는 불편함을 줄이고, 아이돌 덕질에 필요한 정보들을 한 곳에 모으는 플랫폼 제공
- 통합된 플랫폼 제공을 통해 덕질의 접근성과 편의성 향상
- 사용자 간 안전 거래 도모 (1:1 채팅, 공식 인증 뱃지 등 도입)

## 팀 정보

| 역할 | 이름 | 담당 업무 |
|------|------|-----------|
| 팀장 | 이유진 | 풀스택 개발 |
| 팀원 | 박수현 | 풀스택 개발 |
| 팀원 | 장윤서 | 풀스택 개발 |

## 시스템 아키텍처

### 기술 스택

**Backend**
- Django 5.1.7
- SQLite3
- django-widget-tweaks
- django-import-export

**Frontend**
- TailwindCSS
- Vanilla JavaScript
- FullCalendar (캘린더 기능)

**협업 도구**
- GitHub
- Notion

## ERD (Entity Relationship Diagram)

프로젝트의 데이터베이스 구조는 아래 링크에서 확인할 수 있습니다.

[oddoke ERD 상세 링크](https://www.notion.so/oddoke-ERD-22270a83488280d9a7c3f1667b574cc2)

## 어덕해(Oddoke) URL 구조

### 메인 페이지 (oddoke/urls.py)

| URL | 뷰 | 설명 |
|-----|-----|------|
| `/` | views.main | 메인 페이지 (home.html) |
| `/intro/` | views.intro_view | 인트로 슬라이드 랜딩 페이지 |
| `/admin/` | admin.site.urls | Django 관리자 페이지 |
| `/oddmin/` | include('oddmin.urls') | 커스텀 관리자 패널 |

## 프론트엔드 (React + TypeScript + Vite)
```
프론트엔드/
├── .eslintrc.cjs
├── .gitignore
├── index.html
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
│
├── .vscode/
│   └── settings.json
│
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── vite-env.d.ts
    │
    ├── apis/                              # API 관련 설정 및 DTO
    │   ├── index.ts
    │   ├── request/                       # 요청 DTO
    │   │   ├── auth/                      # 인증 관련
    │   │   │   ├── check-certification.request.dto.ts
    │   │   │   ├── email-certification.request.dto.ts
    │   │   │   ├── index.ts
    │   │   │   ├── sign-in.request.dto.ts
    │   │   │   └── sign-up.request.dto.ts
    │   │   ├── board/                     # 게시판 관련
    │   │   │   ├── index.ts
    │   │   │   ├── patch-board.request.dto.ts
    │   │   │   └── post-board.request.dto.ts
    │   │   ├── chat/                      # 채팅 관련
    │   │   │   └── post-chat-room.request.dto.ts
    │   │   └── user/                      # 사용자 관련
    │   │       ├── index.ts
    │   │       ├── patch-profile-image.request.dto.ts
    │   │       └── patch-profile.request.dto.ts
    │   └── response/                      # 응답 DTO
    │       ├── index.ts
    │       ├── response.dto.ts
    │       ├── auth/                      # 인증 응답
    │       │   ├── check-certification.response.dto.ts
    │       │   ├── email-certification.response.dto.ts
    │       │   ├── email-check.response.dto.ts
    │       │   ├── index.ts
    │       │   ├── sign-in.response.dto.ts
    │       │   └── sign-up.response.dto.ts
    │       ├── board/                     # 게시판 응답
    │       │   ├── delete-board.response.dto.ts
    │       │   ├── get-board-list.response.dto.ts
    │       │   ├── get-board.response.dto.ts
    │       │   ├── get-favorite-board-list.response.dto.ts
    │       │   ├── get-favorite.response.dto.ts
    │       │   ├── get-search-board-list.response.dto.ts
    │       │   ├── get-user-board-list.response.dto.ts
    │       │   ├── index.ts
    │       │   ├── patch-board.response.dto.ts
    │       │   ├── post-board.response.dto.ts
    │       │   └── put-favorite.response.dto.ts
    │       ├── chat/                      # 채팅 응답
    │       │   ├── get-chatroom-list.response.dto.ts
    │       │   ├── get-message.response.dto.ts
    │       │   ├── index.ts
    │       │   └── post-chat.response.dto.ts
    │       ├── search/                    # 검색 응답
    │       │   ├── get-popular-list.response.dto.ts
    │       │   ├── get-relation-list.response.ts
    │       │   └── index.ts
    │       └── user/                      # 사용자 응답
    │           ├── get-sign-in-user.response.dto.ts
    │           ├── get-user.response.dto.ts
    │           ├── index.ts
    │           ├── patch-profile-image.response.dto.ts
    │           └── patch-profile.response.dto.ts
    │
    ├── assets/                            # 정적 자원
    │   ├── icon/                          # 아이콘
    │   │   ├── back.png
    │   │   ├── check.png
    │   │   └── ...
    │   ├── idol/                          # 아이돌 관련 이미지
    │   │   ├── cover/                     # 커버 이미지
    │   │   │   ├── 8TURN.jpg
    │   │   │   ├── AB6IX.jpg
    │   │   │   └── ...
    │   │   └── logo/                      # 로고 이미지
    │   │       ├── 8TURN.jpg
    │   │       ├── AB6IX.jpg
    │   │       └── ...
    │   ├── logo/                          # 서비스 로고
    │   │   ├── logo.png
    │   │   └── logoWhite.png
    │   └── member/                        # 멤버 이미지
    │       └── default.png
    │
    ├── components/                        # 재사용 가능한 컴포넌트
    │   ├── auth-components.ts
    │   ├── board-item.tsx
    │   ├── idolList.ts
    │   ├── loading-screen.tsx
    │   ├── navigation-bar.tsx
    │   ├── pagination.tsx
    │   ├── product-item.tsx
    │   └── protected-route.tsx
    │
    ├── hooks/                             # 커스텀 훅
    │   ├── index.ts
    │   └── pagination.hook.ts
    │
    ├── mocks/                             # 모킹 데이터
    │   ├── board-list.mock.ts
    │   ├── board.mock.ts
    │   ├── index.ts
    │   └── product-list.mock.ts
    │
    ├── routes/                            # 페이지 컴포넌트
    │   ├── board.tsx                      # 게시판
    │   ├── boardUpdate.tsx               # 게시판 수정
    │   ├── cart.tsx                      # 장바구니
    │   ├── chat.tsx                      # 채팅
    │   ├── chatRoom.tsx                  # 채팅방
    │   ├── detail.tsx                    # 상세페이지
    │   ├── home.tsx                      # 홈
    │   ├── idol.tsx                      # 아이돌
    │   ├── join.tsx                      # 회원가입
    │   ├── login.tsx                     # 로그인
    │   ├── oauth.tsx                     # OAuth
    │   ├── register.tsx                  # 등록
    │   ├── search.tsx                    # 검색
    │   ├── searchWord.tsx                # 검색어
    │   ├── upload.tsx                    # 업로드
    │   ├── userPage.tsx                  # 사용자 페이지
    │   └── userUpdate.tsx                # 사용자 정보 수정
    │
    ├── services/                          # 비즈니스 로직 서비스
    │   └── ChatService.ts
    │
    ├── stores/                            # 상태 관리
    │   └── login-user.store.ts
    │
    ├── types/                             # 타입 정의
    │   ├── enum/                          # 열거형
    │   │   ├── index.ts
    │   │   └── response-code.enum.ts
    │   └── interface/                     # 인터페이스
    │       ├── board-list-item.interface.ts
    │       ├── board.interface.ts
    │       ├── chatroom-list-item.interface.ts
    │       ├── favorite-list-item.interface.ts
    │       ├── favorite.interface.ts
    │       ├── index.ts
    │       ├── product-list-item.interface.ts
    │       └── user.interface.ts
    │
    └── utils/                             # 유틸리티 함수
        └── index.ts
```

## 백엔드 (Django)
```
백엔드/
├── .config/                               # 설정 파일
│   └── uwsgi/
│
├── accounts/                              # 계정 관리 앱
│   ├── management/
│   │   └── commands/
│   ├── migrations/
│   ├── services/
│   ├── templates/
│   │   ├── accounts/
│   │   └── emails/
│   └── templatetags/
│
├── artist/                                # 아티스트 관리 앱
│   ├── bday_crawling/                     # 생일 크롤링
│   ├── management/
│   │   └── commands/
│   ├── migrations/
│   ├── templates/
│   │   ├── artist/
│   │   └── components/
│   └── templatetags/
│
├── bday_calendar/                         # 생일 캘린더 앱
│   ├── migrations/
│   └── templates/
│       └── bday_calendar/
│
├── ddokchat/                              # 채팅 앱
│   ├── migrations/
│   ├── services/
│   ├── templates/
│   │   └── ddokchat/
│   └── templatetags/
│
├── ddokdam/                               # 딸기담 앱
│   ├── image/
│   ├── images/
│   ├── migrations/
│   └── templates/
│       └── ddokdam/
│
├── ddokfarm/                              # 딸기팜 앱
│   ├── images/
│   ├── migrations/
│   ├── templates/
│   │   └── ddokfarm/
│   └── templatetags/
│
├── ddoksang/                              # 딸기상 앱
│   ├── migrations/
│   ├── templates/
│   │   ├── admin/
│   │   └── ddoksang/
│   ├── templatetags/
│   ├── utils/
│   └── views/
│
├── faq/                                   # FAQ 앱
│   ├── migrations/
│   └── templates/
│       └── faq/
│
├── notifications/                         # 알림 앱
│   ├── migrations/
│   └── templates/
│       └── notifications/
│
├── oddmin/                                # 관리자 앱
│   ├── migrations/
│   └── templates/
│       └── oddmin/
│
├── media/                                 # 미디어 파일
│   ├── accounts/
│   │   └── profile/
│   ├── bday_cafes/
│   │   └── images/
│   ├── chat_images/
│   ├── ddokdam/
│   │   ├── image/
│   │   └── images/
│   ├── ddokfarm/
│   │   ├── image/
│   │   └── images/
│   ├── fandom_cards/
│   ├── image/
│   ├── profile/
│   └── user_banners/
│
├── static/                                # 정적 파일
│   ├── css/
│   │   ├── ddokchat/
│   │   └── intro/
│   ├── image/
│   │   ├── artist_logo/
│   │   ├── banner/
│   │   ├── member_namu_images/
│   │   └── slide/
│   └── js/
│       ├── ddokchat/
│       ├── intro/
│       └── post_form/
│
├── collectstatic/                         # 수집된 정적 파일
│   ├── admin/
│   │   ├── css/
│   │   ├── img/
│   │   └── js/
│   ├── css/
│   │   ├── ddokchat/
│   │   └── intro/
│   ├── django-browser-reload/
│   ├── image/
│   │   ├── artist_logo/
│   │   ├── banner/
│   │   ├── member_namu_images/
│   │   └── slide/
│   ├── import_export/
│   └── js/
│       ├── ddokchat/
│       ├── intro/
│       └── post_form/
│
├── templates/                             # 전역 템플릿
│   ├── components/
│   │   ├── index/
│   │   ├── post_detail/
│   │   └── post_form/
│   ├── includes/
│   └── main/
│       ├── components/
│       └── intro/
│
├── logs/                                  # 로그 파일
├── test/                                  # 테스트 파일
├── test_uploads/                          # 테스트 업로드
├── tmp/                                   # 임시 파일
├── utils/                                 # 유틸리티
├── venv/                                  # 가상환경
│   ├── etc/
│   ├── Include/
│   ├── Lib/
│   ├── Scripts/
│   └── share/
└── oddoke/                                # 메인 프로젝트 설정
```
## Accounts - 사용자 인증 및 계정 관리 시스템

### 주요 기능

#### 1. 다중 인증 시스템
- **일반 회원가입**: 이메일 기반 회원가입 및 이메일 인증
- **소셜 로그인**: 카카오, 네이버, 구글 OAuth 연동
- **통합 인증**: 일반 계정과 소셜 계정 통합 관리
- **프로필 완성**: 소셜 로그인 후 추가 정보 입력 단계

#### 2. 보안 강화 시스템
- **이메일 인증**: HTML 이메일 템플릿을 통한 계정 활성화
- **비밀번호 재설정**: 안전한 토큰 기반 비밀번호 재설정
- **데이터 암호화**: 계좌번호, 주소, 연락처 정보 암호화 저장
- **제재 관리**: 자동화된 사용자 제재 및 해제 시스템

#### 3. 프로필 관리
- **기본 프로필**: 닉네임, 프로필 이미지, 소개글 관리
- **팬덤 인증**: 공식 팬클럽 카드를 통한 팬덤 인증 시스템
- **계좌 정보**: 암호화된 은행 계좌 정보 등록 및 관리
- **배송 정보**: 암호화된 주소 및 연락처 정보 관리

#### 4. 소셜 기능
- **팔로우 시스템**: 사용자 간 팔로우/언팔로우 기능
- **신뢰덕 점수**: 거래 후기 기반 신뢰도 평가 시스템
- **매너 리뷰**: 거래 상대방에 대한 다면 평가 시스템
- **활동 기록**: 게시글, 댓글, 찜 목록 통합 관리
---
### 인증 및 로그인

#### 소셜 로그인 아키텍처
- **모듈화된 서비스**: 각 OAuth 제공자별 전용 서비스 클래스
- **공통 인터페이스**: BaseSocialAuthService 추상 클래스
- **통합 콜백**: 단일 엔드포인트에서 모든 소셜 로그인 처리
- **상태 관리**: SocialAccount 모델로 소셜 계정 정보 분리 관리

#### 보안 기능
- **CSRF 보호**: 모든 폼 요청에 CSRF 토큰 적용
- **State 검증**: OAuth 요청의 state 파라미터 검증
- **세션 관리**: 안전한 세션 생성 및 무효화
- **제재 미들웨어**: 제재된 사용자의 활동 실시간 차단
---
### 데이터 보안

#### 암호화 시스템
- **대칭 암호화**: Fernet 알고리즘 기반 민감 정보 암호화
- **분리 저장**: 암호화된 데이터와 검색용 데이터 분리
- **마스킹 표시**: 개인정보 조회 시 마스킹 처리
- **안전한 키 관리**: 환경변수를 통한 암호화 키 관리

#### 개인정보 보호
- **최소 수집**: 필요한 정보만 수집하는 원칙
- **동의 기반**: 사용자 동의하에 정보 수집 및 활용
- **접근 제한**: 본인만 접근 가능한 개인정보 관리
- **삭제 권한**: 사용자가 직접 정보 삭제 가능
---
### 관리자 기능

#### 사용자 관리
- **계정 현황**: 가입 방식, 제재 상태, 활동 통계 한눈에 확인
- **제재 관리**: 일괄 제재, 해제, 영구정지 처리
- **소셜 계정**: 소셜 로그인 연동 상태 및 ID 관리
- **팬덤 인증**: 팬덤 카드 승인/거절 일괄 처리

#### 신고 처리
- **신고 대시보드**: 모든 신고 내역 통합 관리
- **게시글 미리보기**: 신고된 게시글 내용 및 이미지 확인
- **일괄 처리**: 경고, 일시정지, 영구정지 일괄 적용
- **자동 삭제**: 신고 처리 시 해당 게시글 자동 삭제
---
### API 및 연동
- **다음 주소 API**: 주소 검색 및 좌표 변환
- **OAuth API**: 카카오, 네이버, 구글 소셜 로그인
- **이메일 API**: SMTP 기반 인증 메일 발송
- **파일 스토리지**: AWS S3 연동 이미지 업로드
---
### 성능 최적화

#### 쿼리 최적화
- **관계 최적화**: select_related, prefetch_related 적극 활용
- **인덱스 설정**: 자주 검색되는 필드에 데이터베이스 인덱스
- **쿼리 캐싱**: 자주 조회되는 통계 데이터 캐싱
- **N+1 방지**: 관련 객체 일괄 로드로 쿼리 수 최소화

#### 미들웨어 최적화
- **조건부 실행**: 필요한 경우에만 제재 확인 수행
- **캐시 활용**: 사용자 상태 정보 메모리 캐싱
- **예외 처리**: 오류 발생 시에도 서비스 중단 방지
- **로깅 최적화**: 디버깅을 위한 상세 로그 기록
---
### 기술적 특징

#### 모듈화된 아키텍처
- **서비스 레이어**: 비즈니스 로직을 서비스 클래스로 분리
- **유틸리티 분리**: 암호화, 포인트 관리 등 공통 기능 모듈화
- **믹스인 패턴**: 공통 기능을 믹스인으로 재사용
- **의존성 주입**: 설정값을 통한 유연한 기능 제어

#### 확장 가능한 설계
- **추상 클래스**: 소셜 로그인 확장을 위한 추상 기반 클래스
- **제네릭 관계**: ContentType을 활용한 범용 신고 시스템
- **설정 기반**: 포인트 비용, 제재 기간 등 설정으로 제어
- **이벤트 기반**: 사용자 활동에 따른 자동 포인트 적립

#### 보안 및 안정성
- **방어적 프로그래밍**: 모든 사용자 입력에 대한 검증
- **트랜잭션 관리**: 중요한 작업의 원자성 보장
- **롤백 지원**: 오류 발생 시 안전한 상태로 복구
- **감사 로그**: 중요한 작업의 추적 가능한 로그 기록
## 덕팜 (DdokFarm) - 굿즈 거래 플랫폼

### 주요 기능

#### 1. 거래 방식별 분류
- **양도 (판매/구매/교환)**: 포카, MD, 응원봉, 앨범 등의 중고 거래
- **대여**: 응원봉 등 용품의 단기 대여
- **분철**: 포토북이나 굿즈를 여러 명이 나누어 구매

#### 2. 상세한 상품 정보 관리
- **개별 가격 설정**: 여러 상품을 한 번에 올릴 때 각각 다른 가격 설정 가능
- **가격 미정 옵션**: 문의를 통한 협의 가능
- **상품 상태**: 미개봉, 거의 새것, 사용감 있음, 하자 있음
- **배송 방법**: 우체국 택배, 준등기, 반택, 끼택 등 다양한 옵션

#### 3. 교환 시스템
- **교환 정보 입력**: "내가 주는 것"과 "받고 싶은 것" 명시
- **교환 전용 게시글**: 교환해요 카테고리로 명확한 구분

#### 4. 분철 관리 시스템
- **멤버별 가격 설정**: 각 멤버마다 다른 가격 책정 가능
- **참여 신청 관리**: 총대가 참여자 승인/반려 관리
- **마감 멤버 표시**: 이미 선택된 멤버 시각적 구분
- **1:1 채팅**: 총대와 참여자 간 개별 소통
---
### 필터링 및 검색

#### 고급 필터 시스템
- **배송 방법**: 택배, 직거래 선택
- **상품 종류**: 포토카드, MD, 응원봉, 앨범, 기타
- **상품 상태**: 미개봉부터 하자 있음까지
- **가격 범위**: 최소/최대 가격 설정
- **거래 방식**: 팝니다/삽니다/교환해요 구분

#### 정렬 옵션
- 최신순
- 낮은 가격순
- 높은 가격순
- 찜 많은 순
---

### 안전 거래 시스템

#### 사용자 신뢰도
- **팬덤 인증**: 공식 팬클럽 인증 뱃지
- **매너 리뷰**: 거래 후 상호 평가 시스템
- **팔로우 기능**: 신뢰할 수 있는 거래자 관리

#### 신고 시스템
- **부적절한 게시물 신고**: 욕설, 혐오 발언, 불법 콘텐츠 등
- **사기 신고**: 거래 위반, 허위 정보 등
- **빠른 신고 처리**: 관리자 검토 후 조치

## 덕담 (DdokDam) - 아이돌 팬 커뮤니티

### 주요 기능

#### 1. 커뮤니티 카테고리
- **덕담 한마디**: 아이돌 관련 자유로운 이야기와 정보 공유
- **예절 차리기**: 여행지, 맛집 소식을 공유하며 덕질템 자랑
- **생카 후기**: 생일카페 방문 후기 및 정보 공유

#### 2. 위치 기반 서비스 (예절 차리기)
- **카카오맵 연동**: 실시간 주소 검색 및 지도 표시
- **위치 정보 관리**: 좌표와 함께 정확한 위치 저장
- **지도 미리보기**: 게시글 작성 시 선택한 위치의 지도 확인 가능
- **상세 페이지 지도**: 게시글 조회 시 위치 정보를 지도로 시각화
- **외부 지도 연동**: 카카오맵 앱으로 바로 이동 가능

#### 3. 덕생 카페 연동 (생카 후기)
- **자동완성 검색**: 덕생 앱에 등록된 카페 정보 실시간 검색
- **카페 정보 연동**: 덕생의 카페 상세 정보 자동 삽입
- **운영 상태 표시**: 카페 운영 여부 실시간 확인
- **원클릭 이동**: 덕생 앱의 카페 상세 페이지로 바로 이동
- **유사도 기반 검색**: 카페명 유사도로 정확한 매칭

#### 4. 아티스트 및 멤버 관리
- **찜한 아티스트 필터**: 관심 있는 아티스트의 게시글만 선별 조회
- **멤버별 태그**: 특정 멤버 관련 게시글 분류 및 검색
- **아티스트 검색**: 한글/영문명 및 별명으로 아티스트 검색 지원
- **동적 멤버 로딩**: 아티스트 선택 시 해당 멤버 자동 로드
---
### 기술적 특징

#### 모듈화된 구조
- **카테고리별 모델 분리**: 각 커뮤니티 유형에 특화된 데이터 구조
- **공통 베이스 모델**: 중복 코드 최소화를 위한 추상 모델 활용
- **Generic Foreign Key**: 댓글 시스템의 다형성 구현

#### 외부 API 연동
- **카카오맵 API**: 위치 검색 및 지도 표시
- **ddoksang 앱 연동**: 생일카페 정보 실시간 동기화
- **순환 참조 방지**: 동적 import로 앱 간 의존성 관리

## 덕생 (DdokSang) - 생일카페 정보 플랫폼

### 주요 기능

#### 1. 생일카페 등록 및 관리
- **중복 확인 시스템**: 카페명, 아티스트, 멤버, 운영 기간을 기반으로 중복 카페 사전 검증
- **이미지 갤러리**: JSON 기반의 다중 이미지 업로드 및 관리 시스템
- **위치 정보**: 카카오맵 API 연동으로 정확한 위치 등록
- **승인 관리**: 관리자 승인 후 공개되는 3단계 상태 관리 (대기→승인→거절)

#### 2. 상세한 카페 정보 시스템
- **운영 정보**: 시작일/종료일 기반 운영 상태 자동 판별
- **특전 관리**: 일반 특전, 선착순 특전, 기타 특전 카테고리별 분류
- **이벤트 설명**: 카페별 상세 이벤트 내용 및 참여 방법
- **출처 정보**: 트위터 계정 연동으로 원본 정보 추적

#### 3. 지도 기반 서비스
- **실시간 지도**: 현재 운영중인 카페 위치 실시간 표시
- **투어맵**: 운영중인 카페들의 통합 지도 뷰
- **주변 카페 검색**: 반경 기반 근처 카페 자동 검색
- **위치별 필터링**: 지역별 카페 분류 및 검색

#### 4. 찜하기 및 개인화
- **카페 찜하기**: ManyToManyField 기반의 찜 목록 관리
- **개인 대시보드**: 등록한 카페 및 찜한 카페 통합 관리
- **최근 본 카페**: 쿠키 기반 최근 조회 카페 추적 (최대 10개)
- **상태별 필터링**: 운영중/예정/종료 카페별 분류 조회

---
### API 및 데이터 처리

#### RESTful API
- **카페 목록 API**: 운영중인 카페 목록 JSON 제공
- **지도 데이터 API**: 지도 표시용 카페 데이터 최적화
- **빠른 조회 API**: 모달창용 카페 상세 정보
- **주변 카페 API**: 위치 기반 근처 카페 검색

#### 중복 검증 API
- **실시간 중복 확인**: 카페 등록 전 중복 여부 사전 검증
- **유사도 알고리즘**: 한글 문자열 정규화 및 유사도 계산
- **날짜 겹침 검증**: 운영 기간 기반 중복 카페 판별
- **자모 분해 비교**: 한글 특성을 고려한 정확한 유사도 측정
---
### 성능 최적화

#### 데이터베이스 최적화
- **인덱스 설정**: 위도/경도, 날짜 범위, 상태별 인덱스 최적화
- **쿼리 최적화**: select_related, prefetch_related 활용
- **JSON 필드**: PostgreSQL JSON 필드를 활용한 이미지 갤러리

#### 캐싱 전략
- **페이지 캐싱**: 자주 접근되는 지도 페이지 5분 캐싱
- **쿼리 캐싱**: 관리자 통계 데이터 5분 캐싱
- **사용자별 캐싱**: 개인 찜 목록 캐싱 및 무효화

---
### 외부 서비스 연동

#### 카카오맵 API
- **주소 검색**: 실시간 주소 자동완성 및 좌표 변환
- **지도 표시**: 카페 위치 정확한 지도 마커 표시
- **길찾기**: 카카오맵 앱과 연동한 네비게이션 지원

#### 소셜 미디어 연동
- **트위터 연동**: 카페 정보 출처 링크 및 계정 연결
- **URL 자동 변환**: @아이디 입력 시 자동 URL 변환
- **외부 링크**: 원본 소스로의 안전한 외부 링크 제공
---
### 기술적 특징

#### 모듈화된 아키텍처
- **유틸리티 분리**: map_utils, cafe_utils, favorite_utils 모듈화
- **뷰 분리**: base_views, cafe_views, api_views, admin_views 기능별 분리
- **메시지 중앙화**: messages.py를 통한 모든 사용자 메시지 중앙 관리

#### 확장 가능한 설계
- **JSON 기반 데이터**: 이미지 갤러리 JSON 필드로 유연한 확장
- **추상 모델**: 공통 기능 추상화로 코드 재사용성 향상
- **설정 중앙화**: settings를 통한 페이지 크기, 반경 등 설정 관리


---
## 연락처
```
프로젝트 링크: https://github.com/3gongju/oddoke
이슈 리포트: GitHub Issues
공식 트위터: @oddoke_official
```
