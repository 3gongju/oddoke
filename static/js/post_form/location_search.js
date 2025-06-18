// static/js/post_form/location_search.js - 덕담용 위치 검색 모듈

window.DdokdamLocationSearch = {
    map: null,
    ps: null,
    marker: null,
    isInitialized: false,

    // 초기화
    init: function() {
        // 카카오맵 API 확인
        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.error('카카오맵 API가 로드되지 않았습니다');
            this.showLocationError('카카오맵 API를 불러올 수 없습니다');
            return false;
        }

        this.setupEventListeners();
        this.ps = new kakao.maps.services.Places();
        this.isInitialized = true;
        
        // 기존 위치 정보가 있는지 확인 (수정 모드)
        this.loadExistingLocation();
        
        return true;
    },

    // 기존 위치 정보 로드 (수정 모드에서 사용)
    loadExistingLocation: function() {
        const locationInput = document.getElementById('id_location');
        const latitudeInput = document.getElementById('location_latitude');
        const longitudeInput = document.getElementById('location_longitude');
        
        if (!locationInput || !locationInput.value.trim()) {
            return; // 기존 위치 정보가 없음
        }

        const locationValue = locationInput.value.trim();

        // 위치명에서 주소 부분 추출 (괄호 안의 주소)
        const addressMatch = locationValue.match(/\(([^)]+)\)$/);
        const placeName = addressMatch ? locationValue.replace(/\s*\([^)]+\)$/, '') : locationValue;
        const address = addressMatch ? addressMatch[1] : locationValue;

        // 선택된 장소 UI 표시
        const fakePlace = {
            place_name: placeName,
            road_address_name: address,
            address_name: address,
            y: latitudeInput?.value || '',
            x: longitudeInput?.value || '',
            id: ''
        };

        this.showSelectedLocation(fakePlace);
        
        // 검색 입력창에도 표시
        const searchInput = document.getElementById('location-search');
        if (searchInput) {
            searchInput.value = placeName;
        }
        
        // 좌표가 있으면 지도 표시 옵션 활성화
        if (fakePlace.y && fakePlace.x) {
            this.selectedPlace = fakePlace;
            this.showMapOption(fakePlace);
        }
    },

    // 이벤트 리스너 설정
    setupEventListeners: function() {
        const searchBtn = document.getElementById('locationSearchBtn');
        const searchInput = document.getElementById('location-search');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.searchLocation());
        }

        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.searchLocation();
                }
            });

            // 입력값 변경 시 선택된 장소 초기화
            searchInput.addEventListener('input', () => {
                this.clearSelection();
            });
        }

        // 외부 클릭 시 검색 결과 숨기기
        document.addEventListener('click', (e) => {
            const resultsContainer = document.getElementById('location-results');
            const searchInput = document.getElementById('location-search');
            const searchBtn = document.getElementById('locationSearchBtn');
            
            if (resultsContainer && 
                !resultsContainer.contains(e.target) && 
                e.target !== searchInput && 
                e.target !== searchBtn) {
                resultsContainer.classList.add('hidden');
            }
        });
    },

    // 위치 검색 실행
    searchLocation: function() {
        const keyword = document.getElementById('location-search')?.value?.trim();
        
        if (!keyword) {
            this.showToast('검색할 장소명을 입력해주세요', 'warning');
            return;
        }

        if (!this.ps) {
            this.showLocationError('검색 서비스를 사용할 수 없습니다');
            return;
        }
        
        // 검색 실행
        this.ps.keywordSearch(keyword, (data, status) => {
            this.handleSearchResults(data, status);
        });
    },

    // 검색 결과 처리
    handleSearchResults: function(data, status) {
        const resultsContainer = document.getElementById('location-results');
        if (!resultsContainer) return;

        if (status === kakao.maps.services.Status.OK && data.length > 0) {
            this.displaySearchResults(data);
        } else {
            resultsContainer.innerHTML = '<li class="px-4 py-3 text-red-500 text-sm">검색 결과가 없습니다.</li>';
            resultsContainer.classList.remove('hidden');
        }
    },

    // 검색 결과 표시
    displaySearchResults: function(places) {
        const resultsContainer = document.getElementById('location-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');

        places.forEach((place, index) => {
            const li = document.createElement('li');
            li.className = 'px-4 py-3 cursor-pointer hover:bg-gray-100 border-b last:border-none';
            
            li.innerHTML = `
                <div class="text-sm">
                    <p class="font-medium text-gray-900">${place.place_name}</p>
                    <p class="text-gray-600 text-xs mt-1">${place.road_address_name || place.address_name}</p>
                    ${place.category_name ? `<p class="text-gray-500 text-xs">${place.category_name}</p>` : ''}
                </div>
            `;
            
            li.addEventListener('click', () => this.selectLocation(place));
            resultsContainer.appendChild(li);
        });
    },

    // 위치 선택
    selectLocation: function(place) {
        // 폼 필드 업데이트
        const locationInput = document.getElementById('id_location');
        const latitudeInput = document.getElementById('location_latitude');
        const longitudeInput = document.getElementById('location_longitude');
        const placeIdInput = document.getElementById('location_place_id');

        if (locationInput) {
            locationInput.value = place.place_name + (place.road_address_name ? ` (${place.road_address_name})` : ` (${place.address_name})`);
        }
        if (latitudeInput) latitudeInput.value = place.y;
        if (longitudeInput) longitudeInput.value = place.x;
        if (placeIdInput) placeIdInput.value = place.id || '';

        // 선택된 장소 UI 업데이트
        this.showSelectedLocation(place);
        
        // 검색 결과 숨기기
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }

        // 지도 표시 옵션 활성화
        this.showMapOption(place);
        
        this.showToast('위치가 선택되었습니다', 'success');
    },

    // 선택된 장소 표시
    showSelectedLocation: function(place) {
        const selectedContainer = document.getElementById('selected-location');
        const nameElement = document.getElementById('selected-location-name');
        const addressElement = document.getElementById('selected-location-address');

        if (selectedContainer && nameElement && addressElement) {
            nameElement.textContent = place.place_name;
            addressElement.textContent = place.road_address_name || place.address_name;
            selectedContainer.classList.remove('hidden');
        }
    },

    // 지도 표시 옵션 활성화
    showMapOption: function(place) {
        const mapBtnContainer = document.getElementById('show-map-btn-container');
        if (mapBtnContainer) {
            mapBtnContainer.style.display = 'block';
            
            // 선택된 장소 정보를 저장 (지도 표시용)
            this.selectedPlace = place;
        }
    },

    // 지도 토글
    toggleLocationMap: function() {
        const mapContainer = document.getElementById('location-map-container');
        const mapBtnContainer = document.getElementById('show-map-btn-container');
        
        if (!mapContainer) return;

        if (mapContainer.style.display === 'none') {
            // 지도 표시
            mapContainer.style.display = 'block';
            if (mapBtnContainer) mapBtnContainer.style.display = 'none';
            
            // 지도 초기화 및 표시
            this.initMap();
        } else {
            // 지도 숨기기
            mapContainer.style.display = 'none';
            if (mapBtnContainer) mapBtnContainer.style.display = 'block';
        }
    },

    // 지도 초기화
    initMap: function() {
        if (!this.selectedPlace) return;

        const mapContainer = document.getElementById('location-map');
        if (!mapContainer) return;

        try {
            const position = new kakao.maps.LatLng(this.selectedPlace.y, this.selectedPlace.x);
            
            const mapOptions = {
                center: position,
                level: 3
            };

            this.map = new kakao.maps.Map(mapContainer, mapOptions);
            
            // 마커만 표시 (정보창 없음)
            this.marker = new kakao.maps.Marker({
                position: position,
                map: this.map
            });

        } catch (error) {
            console.error('지도 초기화 오류:', error);
            this.showLocationError('지도를 불러올 수 없습니다');
        }
    },

    // 선택 초기화
    clearSelection: function() {
        const selectedContainer = document.getElementById('selected-location');
        const mapContainer = document.getElementById('location-map-container');
        const mapBtnContainer = document.getElementById('show-map-btn-container');
        
        if (selectedContainer) selectedContainer.classList.add('hidden');
        if (mapContainer) mapContainer.style.display = 'none';
        if (mapBtnContainer) mapBtnContainer.style.display = 'none';
        
        // 폼 필드 초기화
        const locationInput = document.getElementById('id_location');
        const latitudeInput = document.getElementById('location_latitude');
        const longitudeInput = document.getElementById('location_longitude');
        const placeIdInput = document.getElementById('location_place_id');
        
        if (locationInput) locationInput.value = '';
        if (latitudeInput) latitudeInput.value = '';
        if (longitudeInput) longitudeInput.value = '';
        if (placeIdInput) placeIdInput.value = '';
        
        this.selectedPlace = null;
    },

    // 오류 표시
    showLocationError: function(message) {
        const searchInput = document.getElementById('location-search');
        if (searchInput) {
            searchInput.placeholder = message;
            searchInput.classList.add('border-red-300', 'bg-red-50');
            
            setTimeout(() => {
                searchInput.placeholder = '주소명을 입력하세요';
                searchInput.classList.remove('border-red-300', 'bg-red-50');
            }, 3000);
        }
    },

    // 토스트 메시지
    showToast: function(message, type = 'info') {
        if (window.DdoksangFormUtils?.showToast) {
            window.DdoksangFormUtils.showToast(message, type);
        }
    }
};

// 전역 함수들 (HTML onclick용)
window.clearSelectedLocation = function() {
    window.DdokdamLocationSearch.clearSelection();
};

window.toggleLocationMap = function() {
    window.DdokdamLocationSearch.toggleLocationMap();
};

// 자동 초기화 (DOM 로드 후)
document.addEventListener('DOMContentLoaded', function() {
    // manner 카테고리인지 확인
    const categoryElement = document.getElementById('selected-category');
    const currentCategory = categoryElement?.value;
    
    if (currentCategory === 'manner') {
        // 카카오맵 API가 로드된 후 초기화
        if (typeof kakao !== 'undefined' && kakao.maps) {
            window.DdokdamLocationSearch.init();
        } else {
            // 카카오맵 API 로드 대기
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                if (typeof kakao !== 'undefined' && kakao.maps) {
                    clearInterval(checkInterval);
                    window.DdokdamLocationSearch.init();
                } else if (checkCount++ > 10) {
                    clearInterval(checkInterval);
                    console.error('카카오맵 API 로드 타임아웃');
                }
            }, 500);
        }
    }
});