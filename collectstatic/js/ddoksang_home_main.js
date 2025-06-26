class DdoksangHome {
    constructor() {
        this.currentLocation = null;
        this.nearbyCafes = [];
        this.isLocationRequesting = false;
        this.mapManager = null;
        this.cafesData = [];
        this.defaultCenter = { lat: 37.5665, lng: 126.9780 };
        this.defaultZoom = 8;
    }

    async init() {
        try {
            await this.waitForKakaoMaps();
            
            const mapInitialized = await this.initializeMap();
            if (!mapInitialized) {
                throw new Error('지도 초기화 실패');
            }
            
            await this.loadCafesData();
            this.initializeUI();
            this.setupEventListeners();
            this.setupSidebarEvents();
            
        } catch (error) {
            console.error('DdoksangHome 초기화 실패:', error);
            this.showError('페이지 로드 중 오류가 발생했습니다.');
            throw error;
        }
    }

    async waitForKakaoMaps() {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            if (typeof window.kakao !== 'undefined' && 
                window.kakao && 
                typeof window.kakao.maps !== 'undefined' && 
                window.kakao.maps && 
                typeof window.kakao.maps.Map !== 'undefined') {
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('카카오맵 API 로드 실패');
    }

    async initializeMap() {
        try {
            if (!window.DdoksangMap) {
                throw new Error('DdoksangMap 모듈이 로드되지 않았습니다.');
            }
            
            this.mapManager = new window.DdoksangMap.MapManager('mapContainer', {
                center: this.defaultCenter,
                zoom: this.defaultZoom
            });
            const mapReady = await this.mapManager.init();
            
            if (!mapReady) {
                throw new Error('지도 초기화 실패');
            }
            
            return true;
            
        } catch (error) {
            console.error('지도 초기화 오류:', error);
            return false;
        }
    }

    async loadCafesData() {
        try {
            const cafesDataElement = document.getElementById('cafes-data');
            if (cafesDataElement) {
                try {
                    const parsed = JSON.parse(cafesDataElement.textContent);
                    this.cafesData = Array.isArray(parsed) ? parsed : parsed?.cafes || [];
                } catch (e) {
                    this.cafesData = [];
                }
            }
            
            if (!this.cafesData || this.cafesData.length === 0) {
                const response = await fetch('/ddoksang/api/map-data/');
                
                if (!response.ok) {
                    throw new Error(`API 응답 오류: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.success && Array.isArray(data.cafes)) {
                    this.cafesData = data.cafes;
                } else {
                    throw new Error('유효하지 않은 API 응답 형식');
                }
            }
            
            if (this.mapManager && this.cafesData.length > 0) {
                await this.mapManager.loadCafes(this.cafesData, (cafe) => {
                    this.handleMarkerClick(cafe);
                }, false);
                
                this.mapManager.setCenter(this.defaultCenter.lat, this.defaultCenter.lng, this.defaultZoom);
            }
            
            this.updateCafeCount();
            
        } catch (error) {
            console.error('카페 데이터 로드 실패:', error);
            this.showError('카페 정보를 불러오는 중 오류가 발생했습니다.');
        }
    }

    handleMarkerClick(cafe) {
        if (window.DdoksangModals && window.DdoksangModals.showCafeInfo) {
            window.DdoksangModals.showCafeInfo(cafe);
        } else {
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
                if (e.target.closest('.detail-link')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                const lat = parseFloat(cafeCard.dataset.cafeLat);
                const lng = parseFloat(cafeCard.dataset.cafeLng);
                const cafeId = cafeCard.dataset.cafeId;
                
                if (!isNaN(lat) && !isNaN(lng)) {
                    this.mapManager.moveToLocation(lat, lng, 5);
                    this.highlightCafeCard(cafeId);
                    
                    this.showToast(`${cafeCard.querySelector('h4')?.textContent} 위치로 이동했습니다`, 'success');
                }
            }
        });
    }

    initializeUI() {
        // UI 관련 초기화 작업들
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
                    const buttonText = enabled ? '클러스터링 ON' : '클러스터링 OFF';
                    clusterToggle.innerHTML = `<span class="hidden sm:inline">${buttonText}</span><span class="sm:hidden">클러스터</span>`;
                    
                    this.showToast(
                        enabled ? '클러스터링이 활성화되었습니다.' : '클러스터링이 비활성화되었습니다.',
                        'info'
                    );
                }
            });
        }

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
            
            this.showToast('내 위치로 이동했습니다.', 'success');
            
        } catch (error) {
            console.error('위치 정보 오류:', error);
            this.showError('위치 정보를 가져올 수 없습니다.');
        } finally {
            this.isLocationRequesting = false;
            
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
            console.error('검색 오류:', error);
            this.showError('검색 중 오류가 발생했습니다.');
        }
    }

    updateCafeCount() {
        const operatingCafes = this.cafesData.filter(cafe => {
            const today = new Date();
            const startDate = new Date(cafe.start_date);
            const endDate = new Date(cafe.end_date);
            return startDate <= today && today <= endDate;
        });
        
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
        
        setTimeout(() => toast.classList.remove('translate-x-full'), 100);
        
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

window.ddoksangHome = new DdoksangHome();

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