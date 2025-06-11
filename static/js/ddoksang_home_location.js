// static/js/ddoksang_home_location.js (에러 핸들링 개선)
// 위치 권한 관련 로직 - 브라우저 권한 거부 대응

class DdoksangLocation {
    
    static modalShown = false;
    static isInitialized = false;
    static globalEventsSetup = false;
    
    /**
     * 위치 동의 상태 가져오기 (안전한 방식)
     */
    static getLocationConsent() {
        try {
            return localStorage.getItem('ddoksang_location_consent');
        } catch (e) {
            console.warn('⚠️ localStorage 접근 실패, 세션 저장소 사용:', e);
            return sessionStorage.getItem('ddoksang_location_consent') || null;
        }
    }

    /**
     * 위치 동의 상태 설정 (안전한 방식)
     */
    static setLocationConsent(status) {
        try {
            localStorage.setItem('ddoksang_location_consent', status);
            console.log('💾 위치 동의 상태 저장:', status);
        } catch (e) {
            console.warn('⚠️ localStorage 저장 실패, 세션 저장소 사용:', e);
            sessionStorage.setItem('ddoksang_location_consent', status);
        }
        this.modalShown = true;
    }

    /**
     * 위치 동의 모달 표시 (중복 방지)
     */
    static showLocationModal() {
        if (this.modalShown) {
            console.log('⚠️ 이미 모달이 표시되었음, 무시');
            return;
        }
        
        const modal = document.getElementById('locationModal');
        if (!modal) {
            console.warn('⚠️ 위치 모달 요소를 찾을 수 없습니다');
            return;
        }
        
        if (!modal.classList.contains('hidden')) {
            console.log('⚠️ 모달이 이미 표시된 상태');
            return;
        }
        
        console.log('📍 위치 동의 모달 표시');
        modal.classList.remove('hidden');
        this.modalShown = true;
    }

    /**
     * 위치 동의 모달 숨기기
     */
    static hideLocationModal() {
        console.log('❌ 위치 동의 모달 숨김');
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 브라우저 위치 권한 상태 확인
     */
    static async checkBrowserPermission() {
        if (!('permissions' in navigator)) {
            return 'unknown';
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            console.log('🔍 브라우저 위치 권한 상태:', result.state);
            return result.state; // 'granted', 'denied', 'prompt'
        } catch (error) {
            console.warn('⚠️ 권한 상태 확인 실패:', error);
            return 'unknown';
        }
    }

    /**
     * 사용자 위치 요청 (개선된 에러 핸들링)
     */
    static async requestUserLocation() {
        console.log('📍 사용자 위치 요청 시작');
        
        const myLocationBtn = document.getElementById('myLocationBtn');
        if (!myLocationBtn) {
            throw new Error('내 위치 버튼을 찾을 수 없습니다');
        }
        
        const originalText = myLocationBtn.innerHTML;
        
        // 로딩 표시
        myLocationBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span class="hidden sm:inline ml-1">위치 찾는 중...</span>
        `;

        try {
            // ✅ 1. 브라우저 지원 여부 확인
            if (!navigator.geolocation) {
                throw new Error('이 브라우저에서는 위치 서비스를 지원하지 않습니다');
            }

            // ✅ 2. 권한 상태 사전 확인
            const permissionState = await this.checkBrowserPermission();
            console.log('🔍 위치 권한 상태:', permissionState);

            if (permissionState === 'denied') {
                throw new Error('PERMISSION_DENIED');
            }

            // ✅ 3. HTTPS 환경 확인
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                console.warn('⚠️ HTTPS가 아닌 환경에서 위치 요청');
            }

            // ✅ 4. 위치 정보 요청
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: false, // ✅ 정확도 낮춰서 빠르게
                        timeout: 15000, // ✅ 타임아웃 증가
                        maximumAge: 600000 // ✅ 10분 캐시
                    }
                );
            });

            const { latitude: lat, longitude: lng } = position.coords;
            console.log('✅ 사용자 위치 획득 성공:', lat, lng);

            // 지도 이동
            if (window.ddoksangHome?.mapManager) {
                window.ddoksangHome.mapManager.moveToLocation(lat, lng, 6);
                window.ddoksangHome.mapManager.addUserLocationMarker(lat, lng);
            }

            // ✅ 성공 메시지
            if (window.ddoksangToast) {
                window.ddoksangToast.success('내 위치를 찾았습니다! 📍');
            }

            myLocationBtn.innerHTML = originalText;
            return { lat, lng };

        } catch (error) {
            console.error('❌ 위치 정보 획득 실패:', error);
            myLocationBtn.innerHTML = originalText;

            // ✅ 개선된 에러 처리
            await this.handleLocationError(error);
            throw error;
        }
    }

    /**
     * 위치 요청 실패 시 에러 처리 (개선됨)
     */
    static async handleLocationError(error) {
        let errorMessage = '';
        let actionMessage = '';
        let resetConsent = false;

        if (error.message === 'PERMISSION_DENIED' || error.code === 1) {
            // 브라우저에서 권한 거부
            errorMessage = '위치 권한이 거부되었습니다.';
            actionMessage = '브라우저 설정에서 위치 권한을 허용해주세요.';
            resetConsent = true;
            
            // ✅ 브라우저 권한 설정 안내
            this.showPermissionGuide();
            
        } else if (error.code === 2) {
            // 위치 정보 사용 불가
            errorMessage = '위치 정보를 사용할 수 없습니다.';
            actionMessage = 'GPS가 꺼져있거나 실내에서는 위치를 찾기 어려울 수 있습니다.';
            
        } else if (error.code === 3) {
            // 타임아웃
            errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
            actionMessage = '네트워크 상태를 확인하고 다시 시도해주세요.';
            
        } else {
            // 기타 오류
            errorMessage = '위치 정보를 가져올 수 없습니다.';
            actionMessage = '잠시 후 다시 시도해주세요.';
        }

        // ✅ 권한 거부 시 동의 상태 초기화
        if (resetConsent) {
            this.resetLocationConsent();
        }

        // ✅ 사용자 친화적 토스트 메시지
        if (window.ddoksangToast) {
            window.ddoksangToast.error(`${errorMessage}\n${actionMessage}`);
        } else {
            alert(`${errorMessage}\n${actionMessage}`);
        }
    }

    /**
     * 브라우저 권한 설정 안내 모달
     */
    static showPermissionGuide() {
        const guide = `
📍 위치 권한 설정 방법:

1. 주소창 왼쪽 자물쇠 아이콘 클릭
2. "위치" 설정을 "허용"으로 변경
3. 페이지 새로고침 후 다시 시도

또는 브라우저 설정 → 개인정보 및 보안 → 사이트 설정 → 위치에서 허용 목록에 추가하세요.
        `;
        
        console.log(guide);
        
        // ✅ 모달 또는 안내 팝업 (선택사항)
        if (confirm('위치 권한 설정 방법을 확인하시겠습니까?')) {
            window.open('https://support.google.com/chrome/answer/142065', '_blank');
        }
    }

    /**
     * 내 위치 버튼 클릭 핸들러 (개선됨)
     */
    static async handleMyLocationClick() {
        console.log('🎯 내 위치 버튼 클릭');
        
        try {
            // ✅ 1. 브라우저 권한 상태 먼저 확인
            const permissionState = await this.checkBrowserPermission();
            
            if (permissionState === 'denied') {
                // 브라우저에서 이미 거부됨
                this.showPermissionGuide();
                return;
            }
            
            // ✅ 2. 앱 내 동의 상태 확인
            const consent = this.getLocationConsent();
            console.log('📊 앱 내 동의 상태:', consent);
            
            if (consent === 'allowed' || permissionState === 'granted') {
                // 허용된 상태 - 바로 위치 요청
                await this.requestUserLocation();
                
            } else if (consent === 'denied' && permissionState === 'prompt') {
                // 앱에서는 거부했지만 브라우저에서는 묻기 - 재확인
                if (!this.modalShown && confirm('위치 기반 서비스를 사용하시겠습니까?')) {
                    this.showLocationModal();
                }
                
            } else {
                // 처음 요청 - 모달 표시
                if (!this.modalShown) {
                    this.showLocationModal();
                }
            }
            
        } catch (error) {
            console.error('❌ 위치 버튼 클릭 처리 실패:', error);
            if (window.ddoksangToast) {
                window.ddoksangToast.error('위치 서비스를 사용할 수 없습니다.');
            }
        }
    }

    /**
     * 위치 권한 재설정
     */
    static resetLocationConsent() {
        try {
            localStorage.removeItem('ddoksang_location_consent');
        } catch (e) {
            sessionStorage.removeItem('ddoksang_location_consent');
        }
        this.modalShown = false;
        console.log('🔄 위치 동의 상태 초기화');
    }

    /**
     * 위치 관리 시스템 초기화
     */
    static init() {
        console.log('🚀 위치 관리 시스템 초기화');
        
        try {
            if (this.isInitialized) {
                console.log('⚠️ 이미 초기화됨, 중복 실행 방지');
                return;
            }
            
            const consent = this.getLocationConsent();
            console.log('📊 현재 위치 동의 상태:', consent);
            
            // ✅ 첫 방문이고 모달을 표시하지 않았을 때만 표시 (시간 단축)
            if (!consent && !this.modalShown) {
                console.log('🔍 첫 방문 유저 감지, 2초 후 모달 표시');
                setTimeout(() => {
                    if (!this.modalShown && !this.getLocationConsent()) {
                        this.showLocationModal();
                    }
                }, 2000); // ✅ 3초 → 2초로 단축
            } else {
                console.log('✅ 재방문 유저 또는 이미 모달 표시됨');
            }

            this.setupModalEventListeners();
            this.setupMyLocationButton();
            this.setupGlobalEventListeners();

            this.isInitialized = true;
            console.log('✅ 위치 관리 시스템 초기화 완료');
            
        } catch (error) {
            console.error('❌ 위치 관리 시스템 초기화 실패:', error);
        }
    }

    /**
     * 모달 버튼 이벤트 리스너 설정
     */
    static setupModalEventListeners() {
        const allowBtn = document.getElementById('allowLocationBtn');
        const denyBtn = document.getElementById('denyLocationBtn');
        
        if (allowBtn) {
            const newAllowBtn = allowBtn.cloneNode(true);
            allowBtn.parentNode.replaceChild(newAllowBtn, allowBtn);
            
            newAllowBtn.addEventListener('click', async () => {
                console.log('✅ 위치 정보 허용 선택');
                this.setLocationConsent('allowed');
                this.hideLocationModal();
                
                // ✅ 약간의 지연 후 위치 요청
                setTimeout(async () => {
                    try {
                        await this.requestUserLocation();
                    } catch (error) {
                        console.error('위치 요청 실패:', error);
                        // 이미 handleLocationError에서 처리됨
                    }
                }, 500);
            });
        }

        if (denyBtn) {
            const newDenyBtn = denyBtn.cloneNode(true);
            denyBtn.parentNode.replaceChild(newDenyBtn, denyBtn);
            
            newDenyBtn.addEventListener('click', () => {
                console.log('❌ 위치 정보 거부 선택');
                this.setLocationConsent('denied');
                this.hideLocationModal();
                
                if (window.ddoksangToast) {
                    window.ddoksangToast.info('위치 기반 서비스를 사용하지 않습니다.');
                }
            });
        }
    }

    /**
     * 내 위치 버튼 이벤트 리스너 설정
     */
    static setupMyLocationButton() {
        const myLocationBtn = document.getElementById('myLocationBtn');
        if (myLocationBtn) {
            const newBtn = myLocationBtn.cloneNode(true);
            myLocationBtn.parentNode.replaceChild(newBtn, myLocationBtn);
            newBtn.addEventListener('click', () => this.handleMyLocationClick());
        }
    }

    /**
     * 전역 이벤트 리스너 설정
     */
    static setupGlobalEventListeners() {
        if (this.globalEventsSetup) return;
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('locationModal');
                if (modal && !modal.classList.contains('hidden')) {
                    this.hideLocationModal();
                }
            }
        });

        const locationModal = document.getElementById('locationModal');
        if (locationModal) {
            locationModal.addEventListener('click', (e) => {
                if (e.target === locationModal) {
                    this.hideLocationModal();
                }
            });
        }

        this.globalEventsSetup = true;
    }

    /**
     * 디버깅 정보 출력
     */
    static debug() {
        console.log('🔍 위치 시스템 디버깅 정보');
        console.log('- 브라우저 지원:', 'geolocation' in navigator);
        console.log('- 권한 API 지원:', 'permissions' in navigator);
        console.log('- 현재 동의 상태:', this.getLocationConsent());
        console.log('- 모달 표시 여부:', this.modalShown);
        console.log('- 초기화 상태:', this.isInitialized);
        console.log('- 프로토콜:', location.protocol);
        console.log('- 호스트:', location.hostname);
    }
}

// 전역 노출
window.DdoksangLocation = DdoksangLocation;

// 하위 호환성을 위한 전역 함수들
window.resetLocationConsent = () => DdoksangLocation.resetLocationConsent();
window.showLocationModal = () => DdoksangLocation.showLocationModal();
window.hideLocationModal = () => DdoksangLocation.hideLocationModal();

console.log('✅ DdoksangLocation 클래스 로드 완료 (에러 핸들링 개선)');