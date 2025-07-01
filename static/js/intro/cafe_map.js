/**
 * 덕생 - 생카 지도 슬라이드 JavaScript
 * static/js/intro/cafe_map.js
 */

class CafeMapSlide {
    constructor() {
        this.isInitialized = false;
        this.container = null;
        this.searchBox = null;
        this.myLocationBtn = null;
        this.areaCards = null;
        this.markers = null;
        
        // 애니메이션 상태
        this.markerAnimationInterval = null;
        
        // DOM이 준비되면 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    init() {
        if (this.isInitialized) return;
        
        console.log('🗺️ 생카 지도 슬라이드 초기화 시작');
        
        // DOM 요소 선택
        this.container = document.querySelector('.cafe-map-preview-container');
        this.searchBox = document.querySelector('.search-box input');
        this.myLocationBtn = document.querySelector('.my-location-btn');
        this.areaCards = document.querySelectorAll('.area-card');
        this.markers = document.querySelectorAll('.map-marker');
        
        if (!this.container) {
            console.log('🗺️ 생카 지도 슬라이드 DOM 요소를 찾을 수 없음');
            return;
        }
        
        console.log('🗺️ 생카 지도 슬라이드 DOM 요소 발견');
        
        // 이벤트 설정
        this.setupEventListeners();
        this.setupAccessibility();
        this.startMarkerAnimations();
        this.setupScrollAnimation();
        
        this.isInitialized = true;
        console.log('🗺️ 생카 지도 슬라이드 초기화 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 검색창 클릭 이벤트
        if (this.searchBox) {
            this.searchBox.addEventListener('click', () => this.handleSearchClick());
            this.searchBox.addEventListener('focus', () => this.handleSearchFocus());
        }
        
        // 내 위치 버튼 클릭 이벤트
        if (this.myLocationBtn) {
            this.myLocationBtn.addEventListener('click', () => this.handleLocationClick());
        }
        
        // 지역 카드 클릭 이벤트
        this.areaCards.forEach(card => {
            card.addEventListener('click', () => this.handleAreaClick(card));
            card.addEventListener('mouseenter', () => this.handleAreaHover(card));
            card.addEventListener('mouseleave', () => this.handleAreaLeave(card));
        });
        
        // 마커 클릭 이벤트
        this.markers.forEach(marker => {
            marker.addEventListener('click', () => this.handleMarkerClick(marker));
        });
        
        // 지도 컨테이너 호버 이벤트
        const mapContainer = document.querySelector('.mini-map-container');
        if (mapContainer) {
            mapContainer.addEventListener('mouseenter', () => this.handleMapHover());
            mapContainer.addEventListener('mouseleave', () => this.handleMapLeave());
        }
    }
    
    /**
     * 접근성 설정
     */
    setupAccessibility() {
        // 컨테이너에 role과 aria 속성 추가
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', '생카 지도 미리보기');
        
        // 검색창 접근성
        if (this.searchBox) {
            this.searchBox.setAttribute('aria-label', '생카 검색');
            this.searchBox.setAttribute('role', 'searchbox');
        }
        
        // 내 위치 버튼 접근성
        if (this.myLocationBtn) {
            this.myLocationBtn.setAttribute('aria-label', '내 위치 찾기');
            this.myLocationBtn.setAttribute('role', 'button');
            this.myLocationBtn.setAttribute('tabindex', '0');
        }
        
        // 지역 카드 접근성
        this.areaCards.forEach((card, index) => {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            
            const areaName = card.querySelector('.area-name')?.textContent;
            const areaCount = card.querySelector('.area-count')?.textContent;
            
            if (areaName && areaCount) {
                card.setAttribute('aria-label', `${areaName} ${areaCount} 보기`);
            }
        });
        
        // 마커 접근성
        this.markers.forEach((marker, index) => {
            const label = marker.querySelector('.marker-label')?.textContent;
            if (label) {
                marker.setAttribute('aria-label', `${label} 생일카페`);
                marker.setAttribute('role', 'button');
                marker.setAttribute('tabindex', '0');
            }
        });
    }
    
    /**
     * 검색창 클릭 처리
     */
    handleSearchClick() {
        this.showSearchTooltip();
        this.triggerSearchAnimation();
    }
    
    /**
     * 검색창 포커스 처리
     */
    handleSearchFocus() {
        this.searchBox.placeholder = '실제 지도에서 검색해보세요!';
        this.searchBox.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    }
    
    /**
     * 내 위치 버튼 클릭 처리
     */
    handleLocationClick() {
        this.myLocationBtn.style.transform = 'scale(0.9)';
        this.myLocationBtn.style.background = '#1d4ed8';
        
        setTimeout(() => {
            this.myLocationBtn.style.transform = 'scale(1.1)';
            this.myLocationBtn.style.background = '#3b82f6';
        }, 100);
        
        setTimeout(() => {
            this.myLocationBtn.style.transform = 'scale(1)';
        }, 200);
        
        this.showLocationTooltip();
    }
    
    /**
     * 지역 카드 클릭 처리
     */
    handleAreaClick(card) {
        const areaName = card.querySelector('.area-name')?.textContent;
        
        // 클릭 애니메이션
        card.style.transform = 'scale(0.95)';
        card.style.background = 'rgba(59, 130, 246, 0.3)';
        
        setTimeout(() => {
            card.style.transform = 'scale(1.05)';
            card.style.background = 'rgba(255, 255, 255, 0.2)';
        }, 100);
        
        setTimeout(() => {
            card.style.transform = 'scale(1)';
            card.style.background = 'rgba(255, 255, 255, 0.1)';
        }, 200);
        
        this.showAreaTooltip(areaName);
        this.highlightAreaOnMap(areaName);
    }
    
    /**
     * 지역 카드 호버 처리
     */
    handleAreaHover(card) {
        const areaName = card.querySelector('.area-name')?.textContent;
        this.highlightAreaOnMap(areaName);
    }
    
    /**
     * 지역 카드 호버 해제 처리
     */
    handleAreaLeave(card) {
        this.resetMapHighlight();
    }
    
    /**
     * 마커 클릭 처리
     */
    handleMarkerClick(marker) {
        const label = marker.querySelector('.marker-label')?.textContent;
        
        // 마커 클릭 애니메이션
        marker.style.transform = 'translate(-50%, -50%) scale(1.2)';
        marker.style.zIndex = '20';
        
        setTimeout(() => {
            marker.style.transform = 'translate(-50%, -50%) scale(1)';
            marker.style.zIndex = '';
        }, 300);
        
        this.showMarkerTooltip(label);
    }
    
    /**
     * 지도 호버 처리
     */
    handleMapHover() {
        this.pauseMarkerAnimations();
    }
    
    /**
     * 지도 호버 해제 처리
     */
    handleMapLeave() {
        this.resumeMarkerAnimations();
    }
    
    /**
     * 마커 애니메이션 시작
     */
    startMarkerAnimations() {
        this.markers.forEach((marker, index) => {
            const icon = marker.querySelector('.marker-icon');
            if (icon) {
                // 각 마커마다 다른 애니메이션 딜레이
                icon.style.animationDelay = `${index * 0.5}s`;
            }
        });
    }
    
    /**
     * 마커 애니메이션 일시정지
     */
    pauseMarkerAnimations() {
        this.markers.forEach(marker => {
            marker.style.animationPlayState = 'paused';
        });
    }
    
    /**
     * 마커 애니메이션 재개
     */
    resumeMarkerAnimations() {
        this.markers.forEach(marker => {
            marker.style.animationPlayState = 'running';
        });
    }
    
    /**
     * 검색 애니메이션 트리거
     */
    triggerSearchAnimation() {
        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.style.transform = 'scale(1.05)';
            searchBox.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)';
            
            setTimeout(() => {
                searchBox.style.transform = 'scale(1)';
                searchBox.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.1)';
            }, 200);
        }
    }
    
    /**
     * 지도에서 지역 하이라이트
     */
    highlightAreaOnMap(areaName) {
        // 해당 지역과 관련된 마커 찾기
        const relatedMarkers = this.findMarkersForArea(areaName);
        
        // 모든 마커 흐리게
        this.markers.forEach(marker => {
            marker.style.opacity = '0.3';
        });
        
        // 관련 마커만 강조
        relatedMarkers.forEach(marker => {
            marker.style.opacity = '1';
            marker.style.transform = 'translate(-50%, -50%) scale(1.1)';
        });
    }
    
    /**
     * 지도 하이라이트 리셋
     */
    resetMapHighlight() {
        this.markers.forEach(marker => {
            marker.style.opacity = '1';
            marker.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    }
    
    /**
     * 지역에 해당하는 마커 찾기
     */
    findMarkersForArea(areaName) {
        const areaMarkerMap = {
            '강남구': ['.marker-1'],
            '마포구': ['.marker-2'],
            '중구': ['.marker-3'],
            '서대문구': ['.marker-4']
        };
        
        const selectors = areaMarkerMap[areaName] || [];
        return selectors.map(selector => document.querySelector(selector)).filter(Boolean);
    }
    
    /**
     * 검색 툴팁 표시
     */
    showSearchTooltip() {
        this.showTooltip('실제 지도에서 내 위치 기반으로 생카를 검색할 수 있어요!', 'info');
    }
    
    /**
     * 위치 툴팁 표시
     */
    showLocationTooltip() {
        this.showTooltip('실제 지도에서 내 위치를 찾아 주변 생카를 확인할 수 있어요!', 'location');
    }
    
    /**
     * 지역 툴팁 표시
     */
    showAreaTooltip(areaName) {
        this.showTooltip(`${areaName}의 생카들을 실제 지도에서 확인해보세요!`, 'area');
    }
    
    /**
     * 마커 툴팁 표시
     */
    showMarkerTooltip(label) {
        this.showTooltip(`${label}의 상세 정보를 실제 지도에서 확인할 수 있어요!`, 'marker');
    }
    
    /**
     * 범용 툴팁 표시
     */
    showTooltip(message, type = 'info') {
        // 기존 툴팁 제거
        const existingTooltip = document.querySelector('.cafe-map-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // 새 툴팁 생성
        const tooltip = document.createElement('div');
        tooltip.className = 'cafe-map-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-content">
                <div class="tooltip-icon">${this.getTooltipIcon(type)}</div>
                <div class="tooltip-message">${message}</div>
                <button class="tooltip-close">&times;</button>
            </div>
        `;
        
        // 툴팁 스타일
        tooltip.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
            text-align: center;
            font-size: 0.875rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: fadeInScale 0.3s ease;
        `;
        
        document.body.appendChild(tooltip);
        
        // 닫기 버튼 이벤트
        tooltip.querySelector('.tooltip-close').addEventListener('click', () => {
            tooltip.remove();
        });
        
        // 3초 후 자동 제거
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, 3000);
    }
    
    /**
     * 툴팁 아이콘 반환
     */
    getTooltipIcon(type) {
        const icons = {
            info: '💡',
            location: '📍',
            area: '🗺️',
            marker: '🎂'
        };
        return icons[type] || '💡';
    }
    
    /**
     * 스크롤 애니메이션 설정
     */
    setupScrollAnimation() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    this.triggerScrollInAnimation();
                }
            });
        }, {
            threshold: 0.5
        });
        
        observer.observe(this.container);
    }
    
    /**
     * 스크롤 인 애니메이션 트리거
     */
    triggerScrollInAnimation() {
        // 컨테이너 페이드 인
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateY(30px)';
        this.container.style.transition = 'all 0.8s ease';
        
        setTimeout(() => {
            this.container.style.opacity = '1';
            this.container.style.transform = 'translateY(0)';
        }, 100);
        
        // 지역 카드 순차 애니메이션
        this.areaCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 300 + (index * 100));
        });
        
        // 마커 순차 애니메이션
        this.markers.forEach((marker, index) => {
            marker.style.opacity = '0';
            marker.style.transform = 'translate(-50%, -50%) scale(0.5)';
            marker.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                marker.style.opacity = '1';
                marker.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 500 + (index * 150));
        });
    }
    
    /**
     * 현재 상태 정보 반환
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            markerCount: this.markers ? this.markers.length : 0,
            areaCount: this.areaCards ? this.areaCards.length : 0,
            hasSearchBox: !!this.searchBox,
            hasLocationBtn: !!this.myLocationBtn
        };
    }
    
    /**
     * 정리 함수
     */
    destroy() {
        // 애니메이션 정리
        if (this.markerAnimationInterval) {
            clearInterval(this.markerAnimationInterval);
        }
        
        // 툴팁 제거
        const tooltips = document.querySelectorAll('.cafe-map-tooltip');
        tooltips.forEach(tooltip => tooltip.remove());
        
        this.isInitialized = false;
        console.log('🗺️ 생카 지도 슬라이드 정리 완료');
    }
}

// 전역 인스턴스 생성
let cafeMapSlide = null;

// 슬라이드 초기화 함수 (외부에서 호출 가능)
function initCafeMapSlide() {
    if (!cafeMapSlide) {
        cafeMapSlide = new CafeMapSlide();
    }
    return cafeMapSlide;
}

// 슬라이드 정리 함수
function destroyCafeMapSlide() {
    if (cafeMapSlide) {
        cafeMapSlide.destroy();
        cafeMapSlide = null;
    }
}

// 슬라이드 상태 확인 함수
function getCafeMapSlideStatus() {
    if (cafeMapSlide) {
        return cafeMapSlide.getStatus();
    }
    return null;
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInScale {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }
    
    .tooltip-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .tooltip-icon {
        font-size: 1.25rem;
    }
    
    .tooltip-message {
        flex: 1;
        line-height: 1.4;
    }
    
    .tooltip-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0;
        margin-left: 0.5rem;
    }
    
    .tooltip-close:hover {
        opacity: 0.7;
    }
`;
document.head.appendChild(style);

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
    initCafeMapSlide();
});

// 전역 함수로 내보내기
window.CafeMapSlide = CafeMapSlide;
window.initCafeMapSlide = initCafeMapSlide;
window.destroyCafeMapSlide = destroyCafeMapSlide;
window.getCafeMapSlideStatus = getCafeMapSlideStatus;