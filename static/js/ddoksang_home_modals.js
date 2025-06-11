// static/js/ddoksang_home_modals.js (정리된 버전 - 120줄)
// 카페 정보 모달 관리 (중복 제거, 간소화)

class DdoksangModals {
    
    /**
     * 카페 정보 모달 표시
     * @param {Object} cafe - 카페 정보 객체
     */
    static showCafeInfo(cafe) {

        
        const modal = document.getElementById('cafeInfoModal');
        const title = document.getElementById('modalCafeTitle');
        const content = document.getElementById('modalCafeContent');
        
        if (!modal || !title || !content) {
  
            return;
        }
        
        // 카페 정보 추출 (다양한 필드명 지원)
        const cafeInfo = this.extractCafeInfo(cafe);
        
        // 제목 설정
        title.textContent = cafeInfo.cafeName;
        
        // 콘텐츠 생성
        content.innerHTML = this.createCafeInfoContent(cafeInfo);
        
        // 모달 표시
        modal.classList.remove('hidden');
        
        // 애니메이션 효과
        setTimeout(() => {
            const modalContent = document.getElementById('cafeInfoContent');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
                modalContent.classList.add('scale-100');
            }
        }, 10);
        

    }

    /**
     * 카페 정보 추출 및 정리
     * @param {Object} cafe 
     * @returns {Object}
     */
    static extractCafeInfo(cafe) {
        return {
            cafeName: cafe.name || cafe.cafe_name || '생일카페',
            artistName: cafe.artist || cafe.artist_name || '',
            memberName: cafe.member || cafe.member_name || '',
            address: cafe.address || '주소 정보 없음',
            mainImage: cafe.main_image || cafe.image,
            startDate: cafe.start_date || '',
            endDate: cafe.end_date || '',
            specialBenefits: cafe.special_benefits || '',
            eventDescription: cafe.event_description || '',
            cafeId: cafe.id || cafe.pk,
            isActive: cafe.is_active || false,
            daysRemaining: cafe.days_remaining || 0,
            daysUntilStart: cafe.days_until_start || 0,
            latitude: cafe.latitude || cafe.lat,
            longitude: cafe.longitude || cafe.lng
        };
    }

    /**
     * 운영 상태 배지 생성
     * @param {Object} cafeInfo 
     * @returns {string}
     */
    static createStatusBadge(cafeInfo) {
        const { isActive, daysRemaining, daysUntilStart } = cafeInfo;
        
        if (isActive) {
            return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✨ 운영중</span>';
        } else if (daysUntilStart > 0) {
            return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🔜 예정</span>';
        } else {
            return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">✅ 종료</span>';
        }
    }

    /**
     * 카페 정보 HTML 콘텐츠 생성
     * @param {Object} cafeInfo - 정리된 카페 정보
     * @returns {string} HTML 문자열
     */
    static createCafeInfoContent(cafeInfo) {
        const {
            cafeName, artistName, memberName, address, mainImage,
            startDate, endDate, specialBenefits, eventDescription,
            cafeId, daysRemaining, daysUntilStart, latitude, longitude
        } = cafeInfo;
        
        const statusBadge = this.createStatusBadge(cafeInfo);
        
        return `
            <div class="space-y-4">
                <!-- 메인 이미지 -->
                ${mainImage ? `
                    <div class="relative overflow-hidden rounded-lg">
                        <img src="${mainImage}" alt="${cafeName}" class="w-full h-48 object-cover">
                        <div class="absolute top-3 left-3">${statusBadge}</div>
                    </div>
                ` : `
                    <div class="w-full h-48 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center relative">
                        <span class="text-pink-400 text-6xl mb-2">🎂</span>
                        <div class="absolute top-3 left-3">${statusBadge}</div>
                    </div>
                `}

                <!-- 기본 정보 -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h4 class="font-bold text-lg text-gray-900 mb-1">${cafeName}</h4>
                            <p class="text-gray-600">${artistName}${memberName ? ` - ${memberName}` : ''}</p>
                        </div>
                    </div>
                    
                    ${this.createDateSection(startDate, endDate, daysRemaining, daysUntilStart)}
                </div>

                <!-- 위치 정보 -->
                <div class="border border-gray-200 rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-2 flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        위치
                    </h5>
                    <p class="text-gray-600 text-sm leading-relaxed">${address}</p>
                </div>

                ${this.createOptionalSection('특전 정보', specialBenefits, 'purple')}
                ${this.createOptionalSection('이벤트 설명', eventDescription, 'blue')}

                <!-- 액션 버튼들 -->
                <div class="flex space-x-2 pt-4 border-t border-gray-200">
                    ${cafeId ? `
                    <a href="/ddoksang/cafe/${cafeId}/" 
                       class="flex-1 bg-gray-900 text-white py-3 text-center rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                        자세히 보기
                    </a>
                    ` : ''}
                    <button onclick="DdoksangModals.moveToLocationAndClose(${latitude}, ${longitude})" 
                            class="px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center justify-center">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        </svg>
                        위치 보기
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 운영 기간 섹션 생성
     * @param {string} startDate 
     * @param {string} endDate 
     * @param {number} daysRemaining 
     * @param {number} daysUntilStart 
     * @returns {string}
     */
    static createDateSection(startDate, endDate, daysRemaining, daysUntilStart) {
        if (!startDate || !endDate) return '';
        
        let urgencyBadge = '';
        if (daysRemaining > 0 && daysRemaining <= 7) {
            urgencyBadge = `<span class="ml-2 text-red-600 font-medium text-xs bg-red-50 px-2 py-1 rounded-full">${daysRemaining}일 남음</span>`;
        } else if (daysUntilStart > 0 && daysUntilStart <= 7) {
            urgencyBadge = `<span class="ml-2 text-blue-600 font-medium text-xs bg-blue-50 px-2 py-1 rounded-full">${daysUntilStart}일 후 시작</span>`;
        }
        
        return `
            <div class="flex items-center text-sm text-gray-600 mb-2">
                <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span class="font-medium">${startDate} ~ ${endDate}</span>
                ${urgencyBadge}
            </div>
        `;
    }

    /**
     * 선택적 섹션 생성 (특전, 이벤트 설명 등)
     * @param {string} title 
     * @param {string} content 
     * @param {string} color 
     * @returns {string}
     */
    static createOptionalSection(title, content, color = 'gray') {
        if (!content) return '';
        
        const colorClasses = {
            purple: 'bg-purple-50',
            blue: 'bg-blue-50',
            gray: 'bg-gray-50'
        };
        
        return `
            <div class="border border-gray-200 rounded-lg p-4">
                <h5 class="font-semibold text-gray-800 mb-2 flex items-center">
                    <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
                    </svg>
                    ${title}
                </h5>
                <div class="${colorClasses[color]} p-3 rounded-lg">
                    <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-line">${content}</p>
                </div>
            </div>
        `;
    }

    /**
     * 카페 정보 모달 닫기
     * @param {Event} event - 이벤트 객체 (선택사항)
     */
    static closeCafeInfo(event) {
        if (event && event.target !== event.currentTarget && !event.target.closest('[onclick*="closeCafeInfo"]')) {
            return;
        }

        
        const modal = document.getElementById('cafeInfoModal');
        const modalContent = document.getElementById('cafeInfoContent');
        
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }
        
        setTimeout(() => {
            if (modal) modal.classList.add('hidden');
        }, 200);
    }

    /**
     * 위치로 이동하고 모달 닫기
     * @param {number} lat - 위도
     * @param {number} lng - 경도
     */
    static moveToLocationAndClose(lat, lng) {
 
        
        // 지도 이동
        if (window.ddoksangHome?.mapManager) {
            window.ddoksangHome.mapManager.moveToLocation(lat, lng, 5);
        } else if (typeof moveToLocationHome === 'function') {
            moveToLocationHome(lat, lng);
        } else if (typeof window.map !== 'undefined' && window.map) {
            const position = new kakao.maps.LatLng(lat, lng);
            window.map.setCenter(position);
            window.map.setLevel(5);
        }
        
        // 모달 닫기
        this.closeCafeInfo();
    }

    /**
     * 모든 모달 닫기 (유틸리티 함수)
     */
    static closeAllModals() {

        const cafeModal = document.getElementById('cafeInfoModal');
        if (cafeModal && !cafeModal.classList.contains('hidden')) {
            this.closeCafeInfo();
        }
        
        if (typeof DdoksangLocation !== 'undefined' && DdoksangLocation.hideLocationModal) {
            DdoksangLocation.hideLocationModal();
        }
    }

    /**
     * 모달 초기화
     */
    static init() {
        console.log('📱 모달 시스템 초기화');
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

    }
}

// 전역 함수로 노출 (하위 호환성)
window.DdoksangModals = DdoksangModals;
window.showCafeInfoModal = DdoksangModals.showCafeInfo;
window.closeCafeInfoModal = DdoksangModals.closeCafeInfo;
window.moveToLocationAndClose = DdoksangModals.moveToLocationAndClose;
