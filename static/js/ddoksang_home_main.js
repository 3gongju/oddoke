// 메인 초기화 및 제어

// 덕생 홈페이지 메인 초기화 및 제어

class DdoksangHome {
    constructor() {
        this.mapManager = null;
        this.cafesData = [];
        this.currentSelectedCafe = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log(' 덕생 홈페이지 초기화 시작');
        
        try {
            // 1. 카페 데이터 로드
            this.cafesData = this.loadCafeData();
            console.log(' 카페 데이터 로드 완료:', this.cafesData.length, '개');
            
            // 2. 지도 초기화
            await this.initializeMap();
            
            // 3. UI 컴포넌트 초기화
            this.initializeComponents();
            
            // 4. 이벤트 리스너 설정
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log(' 홈페이지 초기화 완료');
            
        } catch (error) {
            console.error('❌ 홈페이지 초기화 실패:', error);
            this.handleInitError(error);
        }
    }

    loadCafeData() {
        console.log(' 카페 데이터 로드 시작');
        
        const cafesJsonElement = document.getElementById('cafes-data');
        if (!cafesJsonElement) {
            console.warn('⚠️ cafes-data 엘리먼트를 찾을 수 없음');
            return [];
        }
        
        try {
            let rawData = cafesJsonElement.textContent;
            if (!rawData || rawData.trim() === '') {
                console.warn('⚠️ 카페 데이터가 비어있음');
                return [];
            }
            
            // Django의 json_script는 때때로 이중 인코딩할 수 있음
            if (rawData.startsWith('"') && rawData.endsWith('"')) {
                console.log(' 이중 인코딩 감지, 재파싱 시도');
                rawData = JSON.parse(rawData);
            }
            
            const parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            
            if (!Array.isArray(parsedData)) {
                console.error('❌ 파싱된 데이터가 배열이 아님:', typeof parsedData);
                return [];
            }
            
            console.log(' 카페 데이터 로드 성공:', parsedData.length, '개');
            return parsedData;
            
        } catch (error) {
            console.error('❌ 카페 데이터 파싱 실패:', error);
            return [];
        }
    }

    async initializeMap() {
        console.log(' 지도 초기화 시작');
        
        // DdoksangMap 모듈이 로드되었는지 확인
        if (typeof DdoksangMap === 'undefined') {
            throw new Error('DdoksangMap 모듈이 로드되지 않았습니다');
        }
        
        this.mapManager = new DdoksangMap.MapManager('mapContainer');
        const success = await this.mapManager.init();
        
        if (!success) {
            throw new Error('지도 초기화 실패');
        }
        
        // 카페 마커 로드
        if (this.cafesData.length > 0) {
            const markers = this.mapManager.loadCafes(this.cafesData, (cafe) => {
                console.log(' 마커 클릭:', cafe.name || cafe.cafe_name);
                if (typeof DdoksangModals !== 'undefined') {
                    DdoksangModals.showCafeInfo(cafe);
                }
            });
            
            // 카페 수 업데이트
            this.updateCafeCount(markers.length);
            console.log(' 지도 초기화 및 마커 로드 완료');
        }
    }

    initializeComponents() {
        console.log(' UI 컴포넌트 초기화');
        
        // 자동완성 초기화
        if (typeof initAutocomplete === 'function') {
            try {
                initAutocomplete('ddok-search', 'ddok-autocomplete-list', {
                    showBirthday: false,
                    showArtistTag: true,
                    submitOnSelect: true,
                    artistOnly: false
                });
                console.log(' 자동완성 초기화 완료');
            } catch (error) {
                console.error('❌ 자동완성 초기화 실패:', error);
            }
        }

        // 생일 슬라이더 초기화
        if (typeof initBirthdayNavigation === 'function') {
            try {
                initBirthdayNavigation();
                console.log(' 생일 슬라이더 초기화 완료');
            } catch (error) {
                console.error('❌ 생일 슬라이더 초기화 실패:', error);
            }
        }
    }

    setupEventListeners() {
        console.log(' 이벤트 리스너 설정');
        
        // 내 위치 버튼
        const myLocationBtn = document.getElementById('myLocationBtn');
        if (myLocationBtn) {
            // 기존 이벤트 제거 후 새로 등록
            const newBtn = myLocationBtn.cloneNode(true);
            myLocationBtn.parentNode.replaceChild(newBtn, myLocationBtn);
            newBtn.addEventListener('click', () => this.handleMyLocationClick());
            console.log(' 내 위치 버튼 이벤트 등록');
        }

        // 클러스터링 토글
        const clusterToggle = document.getElementById('clusterToggle');
        if (clusterToggle) {
            clusterToggle.addEventListener('click', () => this.toggleClustering());
            console.log(' 클러스터링 토글 이벤트 등록');
        }

        // 주변 카페 패널 닫기
        const closeNearbyPanel = document.getElementById('closeNearbyPanel');
        if (closeNearbyPanel) {
            closeNearbyPanel.addEventListener('click', () => {
                const panel = document.getElementById('nearbyPanel');
                if (panel) panel.classList.add('hidden');
            });
        }
    }

    async handleMyLocationClick() {
        console.log(' 내 위치 버튼 클릭');
        
        if (!this.mapManager) {
            console.error('❌ 지도 매니저가 초기화되지 않음');
            return;
        }

        try {
            const position = await this.mapManager.moveToUserLocation();
            console.log(' 사용자 위치 이동 완료:', position);
            
            // 주변 카페 표시
            if (DdoksangMap && DdoksangMap.findNearbyCafes) {
                const nearby = DdoksangMap.findNearbyCafes(
                    position.lat, position.lng, this.cafesData, 3 // 3km 반경
                );
                
                console.log('주변 카페 찾기 완료:', nearby.length, '개');
                
                DdoksangMap.displayNearbyCafes(nearby, 'nearbyList', (cafe) => {
                    console.log(' 주변 카페 클릭:', cafe.name || cafe.cafe_name);
                    if (typeof DdoksangModals !== 'undefined') {
                        DdoksangModals.showCafeInfo(cafe);
                    }
                });

                // 주변 카페 패널 표시
                const panel = document.getElementById('nearbyPanel');
                if (panel) panel.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('❌ 위치 정보 가져오기 실패:', error);
            if (DdoksangMap && DdoksangMap.showToast) {
                DdoksangMap.showToast('위치 정보를 가져올 수 없습니다.', 'error');
            }
        }
    }

    toggleClustering() {
        console.log('클러스터링 토글');
        
        if (!this.mapManager) {
            console.error('❌ 지도 매니저가 초기화되지 않음');
            return;
        }

        const isEnabled = this.mapManager.toggleClustering();
        const btn = document.getElementById('clusterToggle');
        
        if (btn) {
            if (isEnabled) {
                btn.innerHTML = '<span class="hidden sm:inline">클러스터링 ON</span><span class="sm:hidden">클러스터</span>';
                btn.classList.remove('bg-red-600', 'hover:bg-red-700');
                btn.classList.add('bg-gray-600', 'hover:bg-gray-700');
            } else {
                btn.innerHTML = '<span class="hidden sm:inline">클러스터링 OFF</span><span class="sm:hidden">클러스터</span>';
                btn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
                btn.classList.add('bg-red-600', 'hover:bg-red-700');
            }
        }
        
        console.log('클러스터링 상태 변경:', isEnabled ? 'ON' : 'OFF');
    }

    updateCafeCount(count) {
        const countDisplay = document.getElementById('cafeCountDisplay');
        if (countDisplay) {
            countDisplay.textContent = `${count}개 운영중`;
        }
    }

    handleInitError(error) {
        console.error('초기화 오류 처리:', error);
        
        const loadingDiv = document.getElementById('mapLoading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <div class="text-center">
                    <div class="text-red-500 text-4xl mb-4">⚠️</div>
                    <p class="text-red-600 text-sm mb-2">${error.message}</p>
                    <button onclick="location.reload()" class="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                        새로고침
                    </button>
                </div>
            `;
        }
    }

    // 외부에서 접근 가능한 메소드들
    getMapManager() {
        return this.mapManager;
    }

    getCafesData() {
        return this.cafesData;
    }

    isReady() {
        return this.isInitialized;
    }
}

// 전역 인스턴스 생성
console.log(' DdoksangHome 클래스 로드 완료');
window.ddoksangHome = new DdoksangHome();

// 하위 호환성을 위한 전역 함수들
window.moveToLocationHome = function(lat, lng) {
    if (window.ddoksangHome?.mapManager) {
        window.ddoksangHome.mapManager.moveToLocation(lat, lng);
    }
};

window.findUserLocationHome = function() {
    if (window.ddoksangHome) {
        window.ddoksangHome.handleMyLocationClick();
    }
};

window.toggleClustering = function() {
    if (window.ddoksangHome) {
        window.ddoksangHome.toggleClustering();
    }
};