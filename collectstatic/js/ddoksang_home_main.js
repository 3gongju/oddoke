
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
            console.log('🎯 DdoksangHome 초기화 시작...');
            
            // 1. 카카오맵 API 확인
            await this.waitForKakaoMaps();
            
            // 2. 지도 초기화
            const mapInitialized = await this.initializeMap();
            if (!mapInitialized) {
                throw new Error('지도 초기화 실패');
            }
            
            // 3. 카페 데이터 로드
            await this.loadCafesData();
            
            // 4. UI 초기화
            this.initializeUI();
            
            // 5. 이벤트 리스너 설정
            this.setupEventListeners();
            this.setupSidebarEvents();
            
            console.log('✅ DdoksangHome 초기화 완료');
            
        } catch (error) {
            console.error('❌ DdoksangHome 초기화 실패:', error);
            this.showError('페이지 로드 중 오류가 발생했습니다.');
            throw error;
        }
    }

    async waitForKakaoMaps() {
        let attempts = 0;
        while (typeof kakao === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (typeof kakao === 'undefined') {
            throw new Error('카카오맵 API 로드 실패');
        }
        console.log('✅ 카카오맵 API 대기 완료');
    }

    async initializeMap() {
        try {
            if (!window.DdoksangMap) {
                throw new Error('DdoksangMap 모듈이 로드되지 않았습니다.');
            }
            
            this.mapManager = new window.DdoksangMap.MapManager('mapContainer');
            const mapReady = await this.mapManager.init();
            
            if (!mapReady) {
                throw new Error('지도 초기화 실패');
            }
            
            console.log('✅ 지도 초기화 완료');
            return true;
            
        } catch (error) {
            console.error('❌ 지도 초기화 오류:', error);
            return false;
        }
    }

    async loadCafesData() {
        try {
            console.log('📊 카페 데이터 로드 시작...');
            
            // 1. DOM에서 데이터 읽기 시도
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
            
            // 2. DOM 데이터가 없으면 API 호출
            if (!this.cafesData || this.cafesData.length === 0) {
                console.log('📡 API에서 카페 데이터 로드 시도...');
                const response = await fetch('/ddoksang/api/map-data/');
                
                if (!response.ok) {
                    throw new Error(`API 응답 오류: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.success && Array.isArray(data.cafes)) {
                    this.cafesData = data.cafes;
                    console.log(`✅ API에서 카페 데이터 로드: ${this.cafesData.length}개`);
                } else {
                    throw new Error('유효하지 않은 API 응답 형식');
                }
            }
            
            // 3. 지도에 마커 로드
            if (this.mapManager && this.cafesData.length > 0) {
                await this.mapManager.loadCafes(this.cafesData, (cafe) => {
                    this.handleMarkerClick(cafe);
                });
                console.log('✅ 지도 마커 로드 완료');
            }
            
            // 4. 카페 수 업데이트
            this.updateCafeCount();
            
        } catch (error) {
            console.error('❌ 카페 데이터 로드 실패:', error);
            this.showError('카페 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    handleMarkerClick(cafe) {
        console.log('🖱️ 마커 클릭:', cafe.cafe_name || cafe.name);
        
        if (window.DdoksangModals && window.DdoksangModals.showCafeInfo) {
            window.DdoksangModals.showCafeInfo(cafe);
        } else {
            // 폴백: 상세 페이지로 이동
            this.handleCafeClick(cafe);
        }
    }

    highlightCafeCard(cafeId) {
        const card = document.querySelector(`[data-cafe-id="${cafeId}"]`);
        if (card) {
            card.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-75');
            setTimeout(() => {
                card.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-75');
            }, 2000);
        }
    }

    setupSidebarEvents() {
        document.addEventListener('click', (e) => {
            const cafeCard = e.target.closest('.cafe-card-mini');
            if (cafeCard) {
                e.preventDefault();
                e.stopPropagation();
                
                // 상세 페이지 링크가 아닌 경우에만 지도 이동
                if (!e.target.closest('a[href*="/ddoksang/cafe/"]')) {
                    const lat = parseFloat(cafeCard.dataset.cafeLat);
                    const lng = parseFloat(cafeCard.dataset.cafeLng);
                    const cafeId = cafeCard.dataset.cafeId;
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        this.mapManager.moveToLocation(lat, lng, 5);
                        this.highlightCafeCard(cafeId);
                        
                        // 해당 카페 데이터 찾아서 모달 표시
                        const cafeData = this.cafesData.find(c => c.id == cafeId);
                        if (cafeData) {
                            this.handleMarkerClick(cafeData);
                        }
                    }
                }
            }
        });
    }

    initializeUI() {
        // UI 관련 초기화 작업들
        console.log('🎨 UI 초기화 완료');
    }

    setupEventListeners() {
        // 내 위치 버튼
        const myLocationBtn = document.querySelector('#myLocationBtn');
        if (myLocationBtn) {
            myLocationBtn.addEventListener('click', () => this.handleMyLocationClick());
        }

        // 클러스터링 토글 버튼
        const clusterToggle = document.querySelector('#clusterToggle');
        if (clusterToggle) {
            clusterToggle.addEventListener('click', () => {
                if (this.mapManager) {
                    const enabled = this.mapManager.toggleClustering();
                    const buttonText = enabled ? '클러스터링 ON' : '클러스터링 OFF';
                    clusterToggle.innerHTML = `<span class="hidden sm:inline">${buttonText}</span><span class="sm:hidden">클러스터</span>`;
                    
                    this.showToast(
                        enabled ? '클러스터링이 활성화되었습니다.' : '클러스터링이 비활성화되었습니다.',
                        'info'
                    );
                }
            });
        }

        // 주변 카페 패널 닫기
        const closeNearbyPanel = document.querySelector('#closeNearbyPanel');
        if (closeNearbyPanel) {
            closeNearbyPanel.addEventListener('click', () => {
                const panel = document.querySelector('#nearbyPanel');
                if (panel) panel.classList.add('hidden');
            });
        }

        // 검색
        const searchInput = document.querySelector('#ddok-search');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
    }

    async handleMyLocationClick() {
        if (this.isLocationRequesting) return;
        
        this.isLocationRequesting = true;
        const myLocationBtn = document.querySelector('#myLocationBtn');
        
        // 버튼 로딩 상태
        if (myLocationBtn) {
            const originalContent = myLocationBtn.innerHTML;
            myLocationBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <span class="hidden sm:inline ml-1">위치 찾는 중...</span>
            `;
            
            setTimeout(() => {
                myLocationBtn.innerHTML = originalContent;
            }, 5000);
        }
        
        try {
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
            this.showToast('내 위치로 이동했습니다.', 'success');
            
        } catch (error) {
            console.error('❌ 위치 정보 오류:', error);
            this.showError('위치 정보를 가져올 수 없습니다.');
        } finally {
            this.isLocationRequesting = false;
            
            // 버튼 상태 복원
            if (myLocationBtn) {
                myLocationBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    </svg>
                    <span class="hidden sm:inline ml-1">내 위치</span>
                `;
            }
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
            if (!this.cafesData || this.cafesData.length === 0) {
                await this.loadCafesData();
            }

            this.nearbyCafes = window.DdoksangMap.Utils.findNearbyCafes(
                userLocation.lat,
                userLocation.lng,
                this.cafesData,
                3
            );

            this.displayNearbyCafesList(this.nearbyCafes);

            const nearbyPanel = document.querySelector('#nearbyPanel');
            if (nearbyPanel) nearbyPanel.classList.remove('hidden');

        } catch (error) {
            console.error('❌ 주변 카페 검색 오류:', error);
            this.showError('주변 카페를 찾는 중 오류가 발생했습니다.');
        }
    }

    displayNearbyCafesList(cafes) {
        const listContainer = document.querySelector('#nearbyList');
        if (!listContainer) return;

        if (cafes.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <p class="text-sm">주변 3km 이내에 운영중인 카페가 없습니다.</p>
                </div>
            `;
            return;
        }

        window.DdoksangMap.displayNearbyCafes(cafes, 'nearbyList', (cafe) => {
            this.handleMarkerClick(cafe);
        });
    }

    handleCafeClick(cafe) {
        if (cafe.id) {
            window.location.href = `/ddoksang/cafe/${cafe.id}/`;
        }
    }

    async handleSearch() {
        const searchInput = document.querySelector('#ddok-search');
        const query = searchInput?.value.trim();
        
        if (!query) {
            this.showToast('검색어를 입력해주세요.', 'warning');
            return;
        }

        try {
            window.location.href = `/ddoksang/search/?q=${encodeURIComponent(query)}`;
        } catch (error) {
            console.error('❌ 검색 오류:', error);
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
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'info') {
        // 간단한 토스트 구현
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300`;
        
        const bgColors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        toast.classList.add(bgColors[type] || bgColors.info);
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // 애니메이션
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        // 자동 제거
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// 전역 인스턴스 생성
window.ddoksangHome = new DdoksangHome();

// 전역 함수들
window.showCafeModal = function(cafe) {
    if (window.DdoksangModals && window.DdoksangModals.showCafeInfo) {
        window.DdoksangModals.showCafeInfo(cafe);
    } else {
        window.ddoksangHome.handleCafeClick(cafe);
    }
};

window.moveToLocationHome = function(lat, lng) {
    if (window.ddoksangHome && window.ddoksangHome.mapManager) {
        window.ddoksangHome.mapManager.moveToLocation(lat, lng, 5);
    }
};

