
window.DdokdamDetailMap = {
    map: null,
    marker: null,
    locationData: null,
    isInitialized: false,

    // 초기화
    init: function() {
        // 카카오맵 API 확인
        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.error('카카오맵 API가 로드되지 않았습니다');
            return false;
        }

        // 위치 데이터 로드
        this.loadLocationData();
        this.isInitialized = true;
        
        return true;
    },

    // 위치 데이터 로드
    loadLocationData: function() {
        const dataElement = document.getElementById('manner-location-data');
        if (!dataElement) return;

        try {
            this.locationData = JSON.parse(dataElement.textContent);
            console.log('위치 데이터 로드:', this.locationData);
        } catch (error) {
            console.error('위치 데이터 파싱 오류:', error);
        }
    },

    // 지도 토글
    toggleMap: function() {
        const mapRow = document.getElementById('detail-map-row');
        const showBtn = document.getElementById('show-detail-map-btn');
        
        if (!mapRow) return;

        if (mapRow.style.display === 'none') {
            // 지도 표시
            mapRow.style.display = 'table-row';
            if (showBtn) showBtn.style.display = 'none';
            
            // 지도 초기화
            setTimeout(() => this.initMap(), 100);
        } else {
            // 지도 숨기기
            mapRow.style.display = 'none';
            if (showBtn) showBtn.style.display = 'inline';
        }
    },

    // 지도 초기화
    initMap: function() {
        if (!this.locationData || !this.locationData.location) return;

        const mapContainer = document.getElementById('detail-location-map');
        if (!mapContainer) return;

        const locationText = this.locationData.location;
        
        // 위치에서 좌표 추출 시도
        if (this.locationData.hasCoordinates) {
            // 카카오맵 Places API로 장소 검색
            const ps = new kakao.maps.services.Places();
            
            // 괄호 안의 주소 추출
            const addressMatch = locationText.match(/\(([^)]+)\)$/);
            const placeName = addressMatch ? locationText.replace(/\s*\([^)]+\)$/, '') : locationText;
            
            ps.keywordSearch(placeName, (data, status) => {
                if (status === kakao.maps.services.Status.OK && data.length > 0) {
                    this.displayMapWithCoordinates(data[0].y, data[0].x, placeName);
                } else {
                    this.displayMapError('위치를 찾을 수 없습니다');
                }
            });
        } else {
            // 좌표 정보가 없는 경우 기본 위치 표시
            this.displayMapError('정확한 위치 정보가 없습니다');
        }
    },

    // 좌표로 지도 표시
    displayMapWithCoordinates: function(lat, lng, placeName) {
        const mapContainer = document.getElementById('detail-location-map');
        if (!mapContainer) return;

        try {
            const position = new kakao.maps.LatLng(lat, lng);
            
            const mapOptions = {
                center: position,
                level: 3
            };

            this.map = new kakao.maps.Map(mapContainer, mapOptions);
            
            // 마커 표시
            this.marker = new kakao.maps.Marker({
                position: position,
                map: this.map
            });

            // 지도 크기 재조정 (필요시)
            setTimeout(() => {
                if (this.map) {
                    kakao.maps.event.trigger(this.map, 'resize');
                    this.map.setCenter(position);
                }
            }, 100);

        } catch (error) {
            console.error('지도 표시 오류:', error);
            this.displayMapError('지도를 불러올 수 없습니다');
        }
    },

    // 지도 오류 표시
    displayMapError: function(message) {
        const mapContainer = document.getElementById('detail-location-map');
        if (!mapContainer) return;

        mapContainer.innerHTML = `
            <div class="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500">
                <div class="text-center">
                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        `;
    },

    // 카카오맵 외부 링크 열기
    openKakaoMap: function() {
        if (!this.locationData || !this.locationData.location) return;

        const locationText = this.locationData.location;
        
        // 장소명 추출
        const addressMatch = locationText.match(/\(([^)]+)\)$/);
        const placeName = addressMatch ? locationText.replace(/\s*\([^)]+\)$/, '') : locationText;
        const address = addressMatch ? addressMatch[1] : locationText;
        
        // 카카오맵 URL 생성
        const query = encodeURIComponent(placeName + ' ' + address);
        const kakaoMapUrl = `https://map.kakao.com/link/search/${query}`;
        
        // 새 창에서 열기
        window.open(kakaoMapUrl, '_blank');
    }
};

// 전역 함수들 (HTML onclick용)
window.toggleDetailLocationMap = function() {
    if (window.DdokdamDetailMap.isInitialized) {
        window.DdokdamDetailMap.toggleMap();
    }
};

window.openKakaoMap = function() {
    if (window.DdokdamDetailMap.isInitialized) {
        window.DdokdamDetailMap.openKakaoMap();
    }
};

// 자동 초기화 (DOM 로드 후)
document.addEventListener('DOMContentLoaded', function() {
    // manner 카테고리이고 위치 데이터가 있는지 확인
    const locationDataElement = document.getElementById('manner-location-data');
    
    if (locationDataElement) {
        // 카카오맵 API가 로드된 후 초기화
        if (typeof kakao !== 'undefined' && kakao.maps) {
            window.DdokdamDetailMap.init();
        } else {
            // 카카오맵 API 로드 대기
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                if (typeof kakao !== 'undefined' && kakao.maps) {
                    clearInterval(checkInterval);
                    window.DdokdamDetailMap.init();
                } else if (checkCount++ > 10) {
                    clearInterval(checkInterval);
                    console.error('카카오맵 API 로드 타임아웃');
                }
            }, 500);
        }
    }
});