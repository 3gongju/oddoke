// 중복 생일카페 카드 템플릿 및 스타일 관리자
window.DuplicateCardTemplate = {
    // 카드 전체에 적용되는 클래스 스타일 정의
    styles: {
        card: {
            container: "relative bg-white border-2 border-red-200 rounded-xl p-4 hover:border-red-300 transition-colors shadow-sm hover:shadow-md",
            header: "flex items-start justify-between mb-3",
            content: "space-y-3",
            overlay: "absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 backdrop-blur-sm rounded-xl z-10",
            overlayText: "text-xl font-bold text-gray-600"
        },
        badges: {
            status: {
                ongoing: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800",
                upcoming: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800",
                ended: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
            }
        },
        icons: {
            warning: "w-6 h-6 text-red-500",
            calendar: "w-5 h-5 text-gray-400",
            location: "w-5 h-5 text-gray-400",
            external: "w-4 h-4"
        },
        buttons: {
            detail: "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
        },
        text: {
            title: "font-bold text-lg text-gray-900",
            subtitle: "text-sm text-gray-600",
            info: "text-sm text-gray-600",
            artist: "font-medium"
        }
    },

    // 긴 텍스트를 일정 길이로 자르고 "…" 표시
    truncate(text, max = 20) {
        return (text || '').length > max ? text.slice(0, max) + '…' : text;
    },

    // 상태에 따라 상태 배지 HTML을 반환 (진행중 / 예정 / 종료)
    createStatusBadge(status) {
        if (status === 'approved') return '';  // 승인됨 뱃지는 제거
        const statusConfig = {
            'ongoing': { text: '진행중', class: this.styles.badges.status.ongoing },
            'upcoming': { text: '예정', class: this.styles.badges.status.upcoming },
            'ended': { text: '종료', class: this.styles.badges.status.ended }
        };
        const config = statusConfig[status] || statusConfig['ended'];
        return `<span class="${config.class}">${config.text}</span>`;
    },

    // 아티스트/멤버 뱃지 (지금은 멤버 출력 없음으로 제거됨)
    createArtistBadge(cafe) {
        return '';
    },

    // 날짜 정보 출력 (달력 아이콘 포함)
    createDateInfo(cafe) {
        return `
            <div class="flex items-center gap-1">
                <svg class="${this.styles.icons.calendar}" xmlns="http://www.w3.org/2000/svg" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M8 7V3m8 4V3m-9 8h10m-6 8h10a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span class="${this.styles.text.info}">${cafe.start_date} ~ ${cafe.end_date}</span>
            </div>
        `;
    },

    // 장소명 정보 출력 (주소가 길 경우 truncate, Heroicons 위치 아이콘 사용)
    createLocationInfo(cafe) {
        const placeRaw = cafe.place_name || cafe.address || '';
        if (!placeRaw) return '';

        const maxLength = 24;
        const placeDisplay = placeRaw.length > maxLength ? placeRaw.slice(0, maxLength) + '…' : placeRaw;

        return `
            <div class="flex items-center gap-1">
                <svg class="${this.styles.icons.location}" xmlns="http://www.w3.org/2000/svg" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span class="${this.styles.text.info}" title="${placeRaw}">${placeDisplay}</span>
            </div>
        `;
    },

    // 상세 보기 버튼 (Heroicons 외부 링크 아이콘 포함)
    createDetailButton(cafe) {
        return `
            <a href="/ddoksang/cafe/${cafe.id}/" target="_blank" class="${this.styles.buttons.detail}">
                <span>상세보기</span>
                <svg class="${this.styles.icons.external}" xmlns="http://www.w3.org/2000/svg" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M14 3h7v7m0-7L10 14"/>
                </svg>
            </a>
        `;
    },

    // 단일 카드 생성 함수
    createCard(cafe) {
        const isEnded = cafe.status === 'ended';

        return `
            <div class="duplicate-cafe-card ${this.styles.card.container}" data-cafe-id="${cafe.id}">
                <!-- 3:4 비율 이미지 및 블러 처리 -->
                <div class="w-full aspect-[3/4] overflow-hidden rounded-lg mb-4 bg-gray-100">
                    <img src="${cafe.main_image || '/static/image/default_card.png'}"
                         alt="${cafe.cafe_name}"
                         class="w-full h-full object-cover ${isEnded ? 'blur-sm opacity-80' : ''}" />
                </div>

                <!-- 제목 + 경고 아이콘 -->
                <div class="${this.styles.card.header}">
                    <h3 class="${this.styles.text.title}" title="${cafe.cafe_name}">
                        ${this.truncate(cafe.cafe_name)}
                    </h3>
                    <div class="flex-shrink-0">
                        <svg class="${this.styles.icons.warning}" xmlns="http://www.w3.org/2000/svg" fill="none"
                             viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M12 9v2m0 4h.01M5.93 19h12.14c1.5 0 2.4-1.6 1.7-2.5L13.7 4.5c-.7-.9-1.7-.9-2.5 0L4.3 16.5c-.7.9.2 2.5 1.6 2.5z"/>
                        </svg>
                    </div>
                </div>

                <!-- 아티스트 이름만 출력 (멤버 제거됨) -->
                <div class="mb-3">
                    <p class="${this.styles.text.subtitle}">
                        <span class="${this.styles.text.artist}">${cafe.artist_name}</span>
                    </p>
                </div>

                <!-- 날짜 -->
                <div class="mb-3">
                    ${this.createDateInfo(cafe)}
                </div>

                <!-- 장소명 (place_name 또는 address) -->
                ${(cafe.place_name || cafe.address) ? `<div class="mb-3">${this.createLocationInfo(cafe)}</div>` : ''}

                <!-- 상태 배지와 상세 버튼 -->
                <div class="flex items-center justify-between">
                    <div>${this.createStatusBadge(cafe.status)}</div>
                    ${this.createDetailButton(cafe)}
                </div>

                <!-- 종료 상태일 경우 카드 위에 오버레이 -->
                ${isEnded ? `
                    <div class="${this.styles.card.overlay}">
                        <span class="${this.styles.card.overlayText}">CLOSED</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // 여러 개 카드 한 번에 생성
    createCards(cafes) {
        if (!Array.isArray(cafes) || cafes.length === 0) {
            return '<p class="text-gray-500 text-center py-4">표시할 카페가 없습니다.</p>';
        }
        return cafes.map(cafe => this.createCard(cafe)).join('');
    },

    // 외부에서 커스텀 스타일을 덮어씌우기 위한 메서드
    updateStyles(customStyles) {
        function deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        deepMerge(this.styles, customStyles);
    }
};

// 전역에서 상태 뱃지 HTML을 쉽게 호출할 수 있도록 등록
window.getStatusBadge = function(status) {
    return window.DuplicateCardTemplate.createStatusBadge(status);
};
