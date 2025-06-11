// 덕생 홈페이지 모달 관련 로직

class DdoksangModals {
    
    /**
     * 카페 정보 모달 표시
     * @param {Object} cafe - 카페 정보 객체
     */
    static showCafeInfo(cafe) {
        console.log('카페 정보 모달 표시:', cafe.name || cafe.cafe_name);
        
        const modal = document.getElementById('cafeInfoModal');
        const title = document.getElementById('modalCafeTitle');
        const content = document.getElementById('modalCafeContent');
        
        if (!modal || !title || !content) {
            console.error('❌ 모달 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 카페 정보 추출 (다양한 필드명 지원)
        const cafeName = cafe.name || cafe.cafe_name || '생일카페';
        const artistName = cafe.artist || cafe.artist_name || '';
        const memberName = cafe.member || cafe.member_name || '';
        const address = cafe.address || '주소 정보 없음';
        const mainImage = cafe.main_image || cafe.image;
        const startDate = cafe.start_date || '';
        const endDate = cafe.end_date || '';
        const specialBenefits = cafe.special_benefits || '';
        const eventDescription = cafe.event_description || '';
        const cafeId = cafe.id || cafe.pk;
        const isActive = cafe.is_active || false;
        const daysRemaining = cafe.days_remaining || 0;
        const daysUntilStart = cafe.days_until_start || 0;
        
        // 제목 설정
        title.textContent = cafeName;
        
        // 콘텐츠 생성
        content.innerHTML = this.createCafeInfoContent({
            cafeName,
            artistName,
            memberName,
            address,
            mainImage,
            startDate,
            endDate,
            specialBenefits,
            eventDescription,
            cafeId,
            isActive,
            daysRemaining,
            daysUntilStart,
            latitude: cafe.latitude || cafe.lat,
            longitude: cafe.longitude || cafe.lng
        });
        
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
        
        console.log('카페 정보 모달 표시 완료');
    }

    /**
     * 카페 정보 HTML 콘텐츠 생성
     * @param {Object} data - 카페 정보 데이터
     * @returns {string} HTML 문자열
     */
    static createCafeInfoContent(data) {
        const {
            cafeName, artistName, memberName, address, mainImage,
            startDate, endDate, specialBenefits, eventDescription,
            cafeId, isActive, daysRemaining, daysUntilStart,
            latitude, longitude
        } = data;
        
        // 운영 상태 계산
        let statusBadge = '';
        if (isActive) {
            statusBadge = '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✨ 운영중</span>';
        } else if (daysUntilStart > 0) {
            statusBadge = '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🔜 예정</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">✅ 종료</span>';
        }
        
        return `
            <div class="space-y-4">
                <!-- 메인 이미지 -->
                ${mainImage ? `
                    <div class="relative overflow-hidden rounded-lg">
                        <img src="${mainImage}" alt="${cafeName}" class="w-full h-48 object-cover">
                        <div class="absolute top-3 left-3">
                            ${statusBadge}
                        </div>
                    </div>
                ` : `
                    <div class="w-full h-48 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center relative">
                        <span class="text-pink-400 text-6xl mb-2">🎂</span>
                        <div class="absolute top-3 left-3">
                            ${statusBadge}
                        </div>
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
                    
                    <!-- 운영 기간 -->
                    ${startDate && endDate ? `
                    <div class="flex items-center text-sm text-gray-600 mb-2">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span class="font-medium">${startDate} ~ ${endDate}</span>
                        ${daysRemaining > 0 && daysRemaining <= 7 ? `<span class="ml-2 text-red-600 font-medium text-xs bg-red-50 px-2 py-1 rounded-full">${daysRemaining}일 남음</span>` : ''}
                        ${daysUntilStart > 0 && daysUntilStart <= 7 ? `<span class="ml-2 text-blue-600 font-medium text-xs bg-blue-50 px-2 py-1 rounded-full">${daysUntilStart}일 후 시작</span>` : ''}
                    </div>
                    ` : ''}
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

                <!-- 특전 정보 -->
                ${specialBenefits ? `
                <div class="border border-gray-200 rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-2 flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
                        </svg>
                        특전 정보
                    </h5>
                    <div class="bg-purple-50 p-3 rounded-lg">
                        <p class="text-gray-700 text-sm leading-relaxed">${specialBenefits}</p>
                    </div>
                </div>
                ` : ''}

                <!-- 이벤트 설명 -->
                ${eventDescription ? `
                <div class="border border-gray-200 rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-2 flex items-center">
                        <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        이벤트 설명
                    </h5>
                    <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-line">${eventDescription}</p>
                </div>
                ` : ''}

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
     * 카페 정보 모달 닫기
     * @param {Event} event - 이벤트 객체 (선택사항)
     */
    static closeCafeInfo(event) {
        // 오버레이 클릭이나 닫기 버튼 클릭 시에만 닫기
        if (event && event.target !== event.currentTarget && !event.target.closest('[onclick*="closeCafeInfo"]')) {
            return;
        }
        
        console.log('❌ 카페 정보 모달 닫기');
        
        const modal = document.getElementById('cafeInfoModal');
        const modalContent = document.getElementById('cafeInfoContent');
        
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }
        
        setTimeout(() => {
            if (modal) {
                modal.classList.add('hidden');
            }
        }, 200);
    }

    /**
     * 위치로 이동하고 모달 닫기
     * @param {number} lat - 위도
     * @param {number} lng - 경도
     */
    static moveToLocationAndClose(lat, lng) {
        console.log('위치로 이동 및 모달 닫기:', lat, lng);
        
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
        console.log('🚪 모든 모달 닫기');
        
        // 카페 정보 모달 닫기
        const cafeModal = document.getElementById('cafeInfoModal');
        if (cafeModal && !cafeModal.classList.contains('hidden')) {
            this.closeCafeInfo();
        }
        
        // 위치 모달 닫기 (DdoksangLocation에서 처리)
        if (typeof DdoksangLocation !== 'undefined' && DdoksangLocation.hideLocationModal) {
            DdoksangLocation.hideLocationModal();
        }
    }

    /**
     * 모달 초기화 (필요시 호출)
     */
    static init() {
        console.log('모달 시스템 초기화');
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        
        console.log('모달 시스템 초기화 완료');
    }
}

// 전역 함수로 노출 (하위 호환성)
window.DdoksangModals = DdoksangModals;
window.showCafeInfoModal = DdoksangModals.showCafeInfo;
window.closeCafeInfoModal = DdoksangModals.closeCafeInfo;
window.moveToLocationAndClose = DdoksangModals.moveToLocationAndClose;

console.log(' DdoksangModals 클래스 로드 완료');