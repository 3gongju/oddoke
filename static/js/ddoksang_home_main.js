class DdoksangHome {
    constructor() {
        this.currentLocation = null;
        this.nearbyCafes = [];
        this.isLocationRequesting = false;
        this.mapManager = null;
        this.cafesData = [];
        // ✅ 기본 중심점을 서울로 고정
        this.defaultCenter = { lat: 37.5665, lng: 126.9780 }; // 서울 시청
        this.defaultZoom = 8; // 서울 전체가 보이는 줌 레벨
    }

    async init() {
        try {
            console.log('🎯 DdoksangHome 초기화 시작...');
            
            // 1. 카카오맵 API 확인
            await this.waitForKakaoMaps();
            
            // 2. 지도 초기화 (서울 중심으로 고정)
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

// ddoksang_home_main.js의 waitForKakaoMaps 함수 수정

    async waitForKakaoMaps() {
        console.log('🔍 카카오맵 API 대기 시작...');
        
        let attempts = 0;
        const maxAttempts = 100; // 10초 대기 (100 * 100ms)
        
        while (attempts < maxAttempts) {
            // 더 구체적인 확인
            if (typeof window.kakao !== 'undefined' && 
                window.kakao && 
                typeof window.kakao.maps !== 'undefined' && 
                window.kakao.maps && 
                typeof window.kakao.maps.Map !== 'undefined') {
                
                console.log('✅ 카카오맵 API 감지 성공!');
                console.log('- kakao 객체:', typeof window.kakao);
                console.log('- kakao.maps 객체:', typeof window.kakao.maps);
                console.log('- kakao.maps.Map 클래스:', typeof window.kakao.maps.Map);
                return;
            }
            
            // 진행 상황 로그 (매 1초마다)
            if (attempts % 10 === 0) {
                console.log(`⏳ 카카오맵 API 대기 중... (${attempts/10}초)`);
                console.log('- window.kakao:', typeof window.kakao);
                console.log('- window.kakao.maps:', typeof window.kakao !== 'undefined' ? typeof window.kakao.maps : 'undefined');
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // 최종 실패
        console.error('❌ 카카오맵 API 로드 타임아웃');
        console.error('- window.kakao:', typeof window.kakao);
        console.error('- window.kakao.maps:', typeof window.kakao !== 'undefined' ? typeof window.kakao.maps : 'undefined');
        console.error('- 시도 횟수:', attempts);
        
        throw new Error('카카오맵 API 로드 실패');
    }

    async initializeMap() {
        try {
            if (!window.DdoksangMap) {
                throw new Error('DdoksangMap 모듈이 로드되지 않았습니다.');
            }
            
            // ✅ 수정: 서울 중심으로 지도 초기화 (카페 위치와 무관하게)
            this.mapManager = new window.DdoksangMap.MapManager('mapContainer', {
                center: this.defaultCenter,
                zoom: this.defaultZoom
            });
            const mapReady = await this.mapManager.init();
            
            if (!mapReady) {
                throw new Error('지도 초기화 실패');
            }
            
            console.log('✅ 지도 초기화 완료 - 서울 중심으로 설정');
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
            
            // 3. ✅ 수정: 지도에 마커 로드하되 중심점은 변경하지 않음
            if (this.mapManager && this.cafesData.length > 0) {
                await this.mapManager.loadCafes(this.cafesData, (cafe) => {
                    this.handleMarkerClick(cafe);
                }, false); // ✅ 중심점 이동 비활성화
                console.log('✅ 지도 마커 로드 완료 (중심점 유지)');
                
                // ✅ 지도 중심점을 다시 서울로 설정 (혹시 모를 변경 방지)
                this.mapManager.setCenter(this.defaultCenter.lat, this.defaultCenter.lng, this.defaultZoom);
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
                    // ✅ 상세보기 버튼(.detail-link) 클릭은 기본 동작 허용
                    if (e.target.closest('.detail-link')) {
                        console.log('📋 상세보기 버튼 클릭 - 상세 페이지로 이동');
                        return; // 기본 링크 동작 허용 (detail.html로 이동)
                    }
                    
                    // ✅ 카드 자체 클릭은 지도 이동만 수행
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const lat = parseFloat(cafeCard.dataset.cafeLat);
                    const lng = parseFloat(cafeCard.dataset.cafeLng);
                    const cafeId = cafeCard.dataset.cafeId;
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        // ✅ 사이드바 카드 클릭 시 해당 카페 위치로 이동 (줌 레벨 5)
                        this.mapManager.moveToLocation(lat, lng, 5);
                        this.highlightCafeCard(cafeId);
                        
                        // 선택사항: 해당 카페 데이터 찾아서 모달 표시 (원하면 주석 해제)
                        // const cafeData = this.cafesData.find(c => c.id == cafeId);
                        // if (cafeData) {
                        //     this.handleMarkerClick(cafeData);
                        // }
                        
                        console.log(`📍 사이드바 클릭: ${cafeId}번 카페로 지도 이동 (상세보기 X)`);
                        
                        // 시각적 피드백
                        this.showToast(`${cafeCard.querySelector('h4')?.textContent} 위치로 이동했습니다`, 'success');
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
            
            // ✅ 내 위치 버튼 클릭 시에만 사용자 위치로 이동
            if (this.mapManager) {
                this.mapManager.moveToLocation(userLocation.lat, userLocation.lng, 6);
                this.mapManager.addUserLocationMarker(userLocation.lat, userLocation.lng);
            }
            
          
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
        // ✅ 수정: 운영중인 카페만 카운트 (상태에 관계없이 표시하지 않음)
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
        
        console.log(`📊 카페 수 업데이트: 전체 ${this.cafesData.length}개, 운영중 ${operatingCafes.length}개`);
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