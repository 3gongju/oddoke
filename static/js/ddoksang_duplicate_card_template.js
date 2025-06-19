//  중복 카페 카드 템플릿 및 스타일 관리

/**
 * 중복 카페 카드 템플릿 관리자
 */
window.DuplicateCardTemplate = {
    
    /**
     * 🎨 카드 스타일 설정 (여기서 모든 스타일을 조정)
     */
    styles: {
        // 카드 전체 스타일
        card: {
            container: "bg-white border-2 border-red-200 rounded-xl p-4 hover:border-red-300 transition-colors shadow-sm hover:shadow-md",
            header: "flex items-start justify-between mb-3",
            content: "space-y-3"
        },
        
        // 배지 스타일
        badges: {
            artist: "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800",
            member: "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800",
            status: {
                ongoing: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800",
                upcoming: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800",
                ended: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
            }
        },
        
        // 아이콘 스타일
        icons: {
            warning: "w-6 h-6 text-red-500",
            calendar: "w-4 h-4 text-gray-400",
            location: "w-4 h-4 text-gray-400",
            external: "w-3 h-3"
        },
        
        // 버튼 스타일
        buttons: {
            detail: "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
        },
        
        // 텍스트 스타일
        text: {
            title: "font-bold text-lg text-gray-900",
            subtitle: "text-sm text-gray-600",
            info: "text-sm text-gray-600",
            artist: "font-medium"
        }
    },

    /**
     * 🏷️ 상태 배지 생성
     */
    createStatusBadge(status) {
        const statusConfig = {
            'ongoing': {
                text: '진행중',
                class: this.styles.badges.status.ongoing
            },
            'upcoming': {
                text: '예정',
                class: this.styles.badges.status.upcoming
            },
            'ended': {
                text: '종료',
                class: this.styles.badges.status.ended
            }
        };
        
        const config = statusConfig[status] || statusConfig['ended'];
        return `<span class="${config.class}">${config.text}</span>`;
    },

    /**
     * 🎨 아티스트/멤버 배지 생성
     */
    createArtistBadge(cafe) {
        const isArtist = cafe.artist_type === 'artist' || !cafe.member_name;
        const badgeClass = isArtist ? this.styles.badges.artist : this.styles.badges.member;
        const badgeText = isArtist ? '아티스트' : '멤버';
        
        return `<span class="${badgeClass}">${badgeText}</span>`;
    },

    /**
     * 📅 기간 정보 HTML 생성
     */
    createDateInfo(cafe) {
        return `
            <div class="flex items-center gap-1">
                <svg class="${this.styles.icons.calendar}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002 2z"></path>
                </svg>
                <span class="${this.styles.text.info}">${cafe.formatted_start_date} ~ ${cafe.formatted_end_date}</span>
            </div>
        `;
    },

    /**
     * 📍 위치 정보 HTML 생성
     */
    createLocationInfo(cafe) {
        if (!cafe.location) return '';
        
        return `
            <div class="flex items-center gap-1">
                <svg class="${this.styles.icons.location}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span class="${this.styles.text.info}">${cafe.location}</span>
            </div>
        `;
    },

    /**
     * 🔗 상세보기 버튼 HTML 생성
     */
    createDetailButton(cafe) {
        return `
            <a href="/ddoksang/cafe/${cafe.id}/" 
               target="_blank"
               class="${this.styles.buttons.detail}">
                <span>상세보기</span>
                <svg class="${this.styles.icons.external}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
            </a>
        `;
    },

    /**
     * 🃏 단일 카페 카드 HTML 생성
     */
    createCard(cafe) {
        return `
            <div class="${this.styles.card.container}">
                <!-- 카드 헤더 -->
                <div class="${this.styles.card.header}">
                    <div class="flex items-center gap-2">
                        ${this.createArtistBadge(cafe)}
                        <h3 class="${this.styles.text.title}">${cafe.cafe_name}</h3>
                    </div>
                    
                    <!-- 경고 아이콘 -->
                    <div class="flex-shrink-0">
                        <svg class="${this.styles.icons.warning}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                    </div>
                </div>
                
                <!-- 아티스트/멤버 정보 -->
                <div class="mb-3">
                    <p class="${this.styles.text.subtitle}">
                        <span class="${this.styles.text.artist}">${cafe.artist_name}</span>
                        ${cafe.member_name ? ` - ${cafe.member_name}` : ''}
                    </p>
                </div>
                
                <!-- 기간 정보 -->
                <div class="mb-3">
                    ${this.createDateInfo(cafe)}
                </div>
                
                <!-- 위치 정보 -->
                ${cafe.location ? `<div class="mb-3">${this.createLocationInfo(cafe)}</div>` : ''}
                
                <!-- 하단: 상태 배지와 상세보기 버튼 -->
                <div class="flex items-center justify-between">
                    <div>
                        ${this.createStatusBadge(cafe.status)}
                    </div>
                    ${this.createDetailButton(cafe)}
                </div>
            </div>
        `;
    },

    /**
     * 🗂️ 여러 카페 카드들 HTML 생성
     */
    createCards(cafes) {
        if (!Array.isArray(cafes) || cafes.length === 0) {
            return '<p class="text-gray-500 text-center py-4">표시할 카페가 없습니다.</p>';
        }
        
        return cafes.map(cafe => this.createCard(cafe)).join('');
    },

    /**
     * ⚙️ 스타일 커스터마이징 (런타임에서 스타일 변경 가능)
     */
    updateStyles(customStyles) {
        // 깊은 병합으로 사용자 정의 스타일 적용
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
        console.log('🎨 중복 카드 스타일이 업데이트되었습니다:', customStyles);
    }
};

// 전역 함수로 노출 (하위 호환성)
window.getStatusBadge = function(status) {
    return window.DuplicateCardTemplate.createStatusBadge(status);
};

console.log('📄 DuplicateCardTemplate 로드 완료');