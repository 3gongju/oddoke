// static/js/ddoksang_home_main.js
// 홈페이지 메인 로직 - 마커 클릭과 사이드바 연동 수정

class DdoksangHome {
    constructor() {
        this.currentLocation = null;
        this.nearbyCafes = [];
        this.isLocationRequesting = false;
        this.mapManager = null;
        this.cafesData = [];
    }

    async init() {
        try {
            console.log('🚀 덕생 홈페이지 초기화 시작');
            await this.waitForKakaoMaps();
            const mapInitialized = await this.initializeMap();
            if (!mapInitialized) throw new Error('지도 초기화 실패');
            await this.loadCafesData();
            this.initializeUI();
            this.setupEventListeners();
            this.setupSidebarEvents(); // 사이드바 이벤트 추가
            console.log('✅ 덕생 홈페이지 초기화 완료');
        } catch (error) {
            console.error('❌ 홈페이지 초기화 실패:', error);
            this.showError('페이지 로드 중 오류가 발생했습니다.');
        }
    }

    async waitForKakaoMaps() {
        let attempts = 0;
        const maxAttempts = 50;
        while (typeof kakao === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (typeof kakao === 'undefined') throw new Error('카카오맵 API 로드 실패');
        console.log('✅ 카카오맵 API 로드 완료');
    }

    async initializeMap() {
        try {
            console.log('🗺️ 지도 초기화 시작');
            if (!window.DdoksangMap) throw new Error('DdoksangMap 모듈이 로드되지 않았습니다.');
            this.mapManager = new window.DdoksangMap.MapManager('mapContainer');
            const mapReady = await this.mapManager.init();
            if (!mapReady) throw new Error('지도 초기화 실패');
            console.log('✅ 지도 초기화 완료');
            return true;
        } catch (error) {
            console.error('❌ 지도 초기화 실패:', error);
            return false;
        }
    }

    async loadCafesData() {
        try {
            console.log('📊 카페 데이터 로드 시작');
            const cafesDataElement = document.getElementById('cafes-data');
            if (cafesDataElement) {
                try {
                    const parsed = JSON.parse(cafesDataElement.textContent);
                    this.cafesData = Array.isArray(parsed) ? parsed : parsed?.cafes || [];
                    console.log(`✅ DOM에서 카페 데이터 로드: ${this.cafesData.length}개`);
                } catch (e) {
                    console.warn('⚠️ DOM 데이터 파싱 실패:', e);
                    this.cafesData = [];
                }
            }
            if (!this.cafesData || this.cafesData.length === 0) {
                console.log('📡 API에서 카페 데이터 가져오기...');
                const response = await fetch('/ddoksang/api/map-data/');
                if (!response.ok) throw new Error('카페 데이터 API 호출 실패');
                const data = await response.json();
                if (data.success && Array.isArray(data.cafes)) {
                    this.cafesData = data.cafes;
                } else {
                    throw new Error(`Invalid API format. Expected .cafes[], got: ${JSON.stringify(data)}`);
                }
            }
            if (this.mapManager && this.cafesData.length > 0) {
                // ✅ 마커 클릭 시 모달 표시하도록 수정
                await this.mapManager.loadCafes(this.cafesData, (cafe) => {
                    this.handleMarkerClick(cafe);
                });
            }
            this.updateCafeCount();
        } catch (error) {
            console.error('❌ 카페 데이터 로드 실패:', error);
            this.showError('카페 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    // ✅ 마커 클릭 핸들러 - 모달 표시
    handleMarkerClick(cafe) {
        console.log('🎯 마커 클릭:', cafe.name || cafe.cafe_name);
        
        // 모달 표시
        if (window.DdoksangModals && window.DdoksangModals.showCafeInfo) {
            window.DdoksangModals.showCafeInfo(cafe);
        } else {
            // fallback - 상세 페이지로 이동
            this.handleCafeClick(cafe);
        }
    }

    // ✅ 사이드바 카드 클릭 핸들러 - 지도 이동
    handleSidebarCardClick(cafe) {
        console.log('📌 사이드바 카드 클릭:', cafe.name || cafe.cafe_name);
        
        const lat = parseFloat(cafe.latitude || cafe.lat);
        const lng = parseFloat(cafe.longitude || cafe.lng);
        
        if (!isNaN(lat) && !isNaN(lng) && this.mapManager) {
            // 지도 이동
            this.mapManager.moveToLocation(lat, lng, 5);
            
            // 시각적 피드백
            this.highlightCafeCard(cafe.id);
            
            // 토스트 메시지
            this.showSuccess(`${cafe.name || cafe.cafe_name} 위치로 이동했습니다.`);
        } else {
            console.error('❌ 잘못된 좌표:', { lat, lng, cafe });
            this.showError('위치 정보가 올바르지 않습니다.');
        }
    }

    // ✅ 카페 카드 하이라이트 효과
    highlightCafeCard(cafeId) {
        const card = document.querySelector(`[data-cafe-id="${cafeId}"]`);
        if (card) {
            card.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-75');
            setTimeout(() => {
                card.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-75');
            }, 2000);
        }
    }

    // ✅ 사이드바 이벤트 설정
    setupSidebarEvents() {
        console.log('🔗 사이드바 이벤트 설정');
        
        // 사이드바 카드 클릭 이벤트 (이벤트 위임 방식)
        document.addEventListener('click', (e) => {
            const cafeCard = e.target.closest('.cafe-card-mini');
            if (cafeCard) {
                e.preventDefault();
                e.stopPropagation();
                
                // 상세보기 버튼이 아닌 경우에만 지도 이동
                if (!e.target.closest('a[href*="/ddoksang/detail/"]')) {
                    const lat = parseFloat(cafeCard.dataset.cafeLat);
                    const lng = parseFloat(cafeCard.dataset.cafeLng);
                    const cafeId = cafeCard.dataset.cafeId;
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        this.mapManager.moveToLocation(lat, lng, 5);
                        this.highlightCafeCard(cafeId);
                        
                        // 해당 카페 데이터 찾아서 모달 표시 (선택사항)
                        const cafeData = this.cafesData.find(c => c.id == cafeId);
                        if (cafeData && window.DdoksangModals) {
                            setTimeout(() => {
                                window.DdoksangModals.showCafeInfo(cafeData);
                            }, 500); // 지도 이동 후 모달 표시
                        }
                    }
                }
            }
        });
        
        console.log('✅ 사이드바 이벤트 설정 완료');
    }

    initializeUI() {
        console.log('🎨 UI 컴포넌트 초기화');
        this.initializeAutocomplete();
    }

    initializeAutocomplete() {
        const searchInput = document.querySelector('#ddok-search');
        if (searchInput && typeof kakao !== 'undefined' && kakao.maps.services) {
            try {
                const places = new kakao.maps.services.Places();
                let suggestionsContainer = document.querySelector('#ddok-autocomplete-list');
                if (!suggestionsContainer) {
                    suggestionsContainer = document.createElement('div');
                    suggestionsContainer.id = 'ddok-autocomplete-list';
                    suggestionsContainer.className = 'absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-lg shadow-lg z-10 hidden';
                    searchInput.parentNode.style.position = 'relative';
                    searchInput.parentNode.appendChild(suggestionsContainer);
                }
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    const keyword = e.target.value.trim();
                    clearTimeout(searchTimeout);
                    if (keyword.length >= 2) {
                        searchTimeout = setTimeout(() => {
                            this.searchPlaces(keyword, suggestionsContainer, places);
                        }, 300);
                    } else {
                        suggestionsContainer.classList.add('hidden');
                    }
                });
                document.addEventListener('click', (e) => {
                    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                        suggestionsContainer.classList.add('hidden');
                    }
                });
                console.log('✅ 자동완성 초기화 완료');
            } catch (error) {
                console.warn('⚠️ 자동완성 초기화 실패:', error);
            }
        }
    }

    searchPlaces(keyword, container, places) {
        places.keywordSearch(keyword, (result, status) => {
            if (status === kakao.maps.services.Status.OK) {
                this.displaySearchSuggestions(result.slice(0, 5), container);
            } else {
                container.classList.add('hidden');
            }
        }, {
            location: this.mapManager ? this.mapManager.map.getCenter() : new kakao.maps.LatLng(37.5665, 126.9780),
            radius: 10000
        });
    }

    displaySearchSuggestions(places, container) {
        const suggestionsHTML = places.map(place => `
            <div class="search-suggestion p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0" 
                 data-lat="${place.y}" data-lng="${place.x}" data-name="${place.place_name}">
                <div class="font-medium text-sm">${place.place_name}</div>
                <div class="text-xs text-gray-600">${place.address_name}</div>
            </div>
        `).join('');
        container.innerHTML = suggestionsHTML;
        container.classList.remove('hidden');
        container.querySelectorAll('.search-suggestion').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                const name = item.dataset.name;
                if (this.mapManager) {
                    this.mapManager.moveToLocation(lat, lng, 5);
                }
                document.querySelector('#ddok-search').value = name;
                container.classList.add('hidden');
            });
        });
    }

    setupEventListeners() {
        const myLocationBtn = document.querySelector('#myLocationBtn');
        if (myLocationBtn) {
            myLocationBtn.addEventListener('click', () => this.handleMyLocationClick());
        }
        const clusterToggle = document.querySelector('#clusterToggle');
        if (clusterToggle) {
            clusterToggle.addEventListener('click', () => {
                if (this.mapManager) {
                    const enabled = this.mapManager.toggleClustering();
                    window.DdoksangMap.showToast(
                        enabled ? '클러스터링이 활성화되었습니다.' : '클러스터링이 비활성화되었습니다.',
                        'info'
                    );
                }
            });
        }
        const closeNearbyPanel = document.querySelector('#closeNearbyPanel');
        if (closeNearbyPanel) {
            closeNearbyPanel.addEventListener('click', () => {
                const panel = document.querySelector('#nearbyPanel');
                if (panel) {
                    panel.classList.add('hidden');
                }
            });
        }
        const searchInput = document.querySelector('#ddok-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        }
    }

    async handleMyLocationClick() {
        if (this.isLocationRequesting) return;
        this.isLocationRequesting = true;
        try {
            const btn = document.querySelector('#myLocationBtn');
            if (btn) {
                btn.disabled = true;
                const originalHtml = btn.innerHTML;
                btn.innerHTML = btn.innerHTML.replace('내 위치', '확인중...');
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }, 3000);
            }
            const position = await this.getCurrentPosition();
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            this.currentLocation = userLocation;
            if (this.mapManager) {
                this.mapManager.moveToLocation(userLocation.lat, userLocation.lng, 6);
                this.mapManager.addUserLocationMarker(userLocation.lat, userLocation.lng);
            }
            await this.findAndDisplayNearbyCafes(userLocation);
            window.DdoksangMap.showToast('내 위치로 이동했습니다.', 'success');
        } catch (error) {
            console.error('❌ 위치 정보 가져오기 실패:', error);
            this.showError('위치 정보를 가져올 수 없습니다.');
        } finally {
            this.isLocationRequesting = false;
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('이 브라우저는 위치 서비스를 지원하지 않습니다.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });
    }

    async findAndDisplayNearbyCafes(userLocation) {
        try {
            console.log('🔍 주변 카페 검색 시작');
            if (!this.cafesData || this.cafesData.length === 0) {
                await this.loadCafesData();
            }
            this.nearbyCafes = window.DdoksangMap.Utils.findNearbyCafes(
                userLocation.lat,
                userLocation.lng,
                this.cafesData,
                3
            );
            console.log(`✅ 주변 카페 ${this.nearbyCafes.length}개 발견`);
            this.displayNearbyCafesList(this.nearbyCafes);
            const nearbyPanel = document.querySelector('#nearbyPanel');
            if (nearbyPanel) {
                nearbyPanel.classList.remove('hidden');
            }
        } catch (error) {
            console.error('❌ 주변 카페 검색 실패:', error);
            this.showError('주변 카페를 찾는 중 오류가 발생했습니다.');
        }
    }

    displayNearbyCafesList(cafes) {
        const listContainer = document.querySelector('#nearbyList');
        if (!listContainer) return;
        if (cafes.length === 0) {
            listContainer.innerHTML = '<div class="text-center text-gray-500 py-4">주변 3km 이내에 운영중인 카페가 없습니다.</div>';
            return;
        }
        window.DdoksangMap.displayNearbyCafes(cafes, 'nearbyList', (cafe) => {
            this.handleMarkerClick(cafe); // 마커 클릭과 동일하게 모달 표시
        });
    }

    // ✅ 페이지 이동용 (상세보기 버튼 등)
    handleCafeClick(cafe) {
        if (cafe.id) {
            window.location.href = `/ddoksang/cafe/${cafe.id}/`;
        }
    }

    async handleSearch() {
        const searchInput = document.querySelector('#ddok-search');
        const query = searchInput?.value.trim();
        if (!query) {
            window.DdoksangMap.showToast('검색어를 입력해주세요.', 'warning');
            return;
        }
        try {
            window.location.href = `/ddoksang/search/?q=${encodeURIComponent(query)}`;
        } catch (error) {
            console.error('❌ 검색 실패:', error);
            this.showError('검색 중 오류가 발생했습니다.');
        }
    }

    updateCafeCount() {
        const operatingCafes = this.cafesData.filter(cafe => 
            window.DdoksangMap.Utils.isCafeOperating(cafe)
        );
        const countElements = document.querySelectorAll('#cafeCountDisplay');
        countElements.forEach(element => {
            if (element) {
                element.textContent = `${operatingCafes.length}개 운영중`;
            }
        });
    }

    showError(message) {
        console.error('❌ 오류:', message);
        if (window.DdoksangMap) {
            window.DdoksangMap.showToast(message, 'error');
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        console.log('✅ 성공:', message);
        if (window.DdoksangMap) {
            window.DdoksangMap.showToast(message, 'success');
        }
    }
}

window.ddoksangHome = new DdoksangHome();

// ✅ 전역 함수들 (하위 호환성)
window.showCafeModal = function(cafe) {
    console.log('📱 카페 모달 호출:', cafe);
    if (window.DdoksangModals && window.DdoksangModals.showCafeInfo) {
        window.DdoksangModals.showCafeInfo(cafe);
    } else {
        window.ddoksangHome.handleCafeClick(cafe);
    }
};

// ✅ 지도 이동 함수 (사이드바에서 사용)
window.moveToLocationHome = function(lat, lng) {
    console.log('🗺️ 지도 이동 요청:', lat, lng);
    if (window.ddoksangHome && window.ddoksangHome.mapManager) {
        window.ddoksangHome.mapManager.moveToLocation(lat, lng, 5);
    }
};

console.log('✅ DdoksangHome 클래스 로드 완료 (마커/사이드바 연동 수정)');