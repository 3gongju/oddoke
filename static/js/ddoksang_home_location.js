// 덕생 홈페이지 위치 권한 관련 로직

class DdoksangLocation {
    
    /**
     * 위치 동의 상태 가져오기
     * @returns {string|null} 동의 상태 ('allowed', 'denied', null)
     */
    static getLocationConsent() {
        return localStorage.getItem('ddoksang_location_consent');
    }

    /**
     * 위치 동의 상태 설정
     * @param {string} status - 동의 상태 ('allowed' 또는 'denied')
     */
    static setLocationConsent(status) {
        localStorage.setItem('ddoksang_location_consent', status);
        console.log(' 위치 동의 상태 저장:', status);
    }

    /**
     * 위치 동의 모달 표시
     */
    static showLocationModal() {
        console.log(' 위치 동의 모달 표시');
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
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
     * 사용자 위치 요청
     * @returns {Promise<Object>} 위치 정보 {lat, lng}
     */
    static async requestUserLocation() {
        console.log(' 사용자 위치 요청 시작');
        
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
            if (!navigator.geolocation) {
                throw new Error('이 브라우저에서는 위치 서비스를 지원하지 않습니다');
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000 // 5분 캐시
                    }
                );
            });

            const { latitude: lat, longitude: lng } = position.coords;
            console.log(' 사용자 위치 획득 성공:', lat, lng);

            // 지도 이동
            if (window.ddoksangHome?.mapManager) {
                await window.ddoksangHome.mapManager.moveToUserLocation();
            }

            myLocationBtn.innerHTML = originalText;
            return { lat, lng };

        } catch (error) {
            console.error('❌ 위치 정보 획득 실패:', error);
            myLocationBtn.innerHTML = originalText;

            // 에러 메시지 처리
            let errorMessage = '위치 정보를 가져올 수 없습니다.';
            if (error.code === error.PERMISSION_DENIED) {
                errorMessage = '위치 권한이 거부되었습니다.';
                localStorage.removeItem('ddoksang_location_consent');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = '위치 정보를 사용할 수 없습니다.';
            } else if (error.code === error.TIMEOUT) {
                errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
            }

            if (typeof DdoksangMap !== 'undefined' && DdoksangMap.showToast) {
                DdoksangMap.showToast(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }

            throw error;
        }
    }

    /**
     * 내 위치 버튼 클릭 핸들러
     */
    static handleMyLocationClick() {
        console.log(' 내 위치 버튼 클릭, 현재 동의 상태 확인');
        
        const consent = this.getLocationConsent();
        console.log(' 현재 위치 동의 상태:', consent);
        
        if (consent === 'allowed') {
            // 이미 허용됨 - 바로 위치 요청
            this.requestUserLocation().catch(error => {
                console.error('위치 요청 실패:', error);
            });
        } else if (consent === 'denied') {
            // 이전에 거부함 - 재확인
            if (confirm('이전에 위치 정보 사용을 거부하셨습니다.\n위치 기반 서비스를 사용하시겠습니까?')) {
                this.showLocationModal();
            }
        } else {
            // 처음 요청 - 모달 표시
            this.showLocationModal();
        }
    }

    /**
     * 위치 권한 재설정 (로그아웃 시 호출)
     */
    static resetLocationConsent() {
        localStorage.removeItem('ddoksang_location_consent');
        console.log(' 위치 동의 상태 초기화');
    }

    /**
     * 위치 관리 시스템 초기화
     */
    static init() {
        console.log(' 위치 관리 시스템 초기화');
        
        try {
            // 처음 방문한 유저인지 확인
            const consent = this.getLocationConsent();
            console.log(' 현재 위치 동의 상태:', consent);
            
            // 첫 방문이면 3초 후 모달 표시
            if (!consent) {
                console.log(' 첫 방문 유저 감지, 3초 후 모달 표시');
                setTimeout(() => {
                    this.showLocationModal();
                }, 3000);
            } else {
                console.log(' 재방문 유저, 모달 표시 안 함');
            }

            // 모달 버튼 이벤트 리스너
            this.setupModalEventListeners();

            // 내 위치 버튼 이벤트 리스너
            this.setupMyLocationButton();

            // 키보드 및 오버레이 이벤트
            this.setupGlobalEventListeners();

            console.log(' 위치 관리 시스템 초기화 완료');
            
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
            allowBtn.addEventListener('click', () => {
                console.log(' 위치 정보 허용 선택');
                this.setLocationConsent('allowed');
                this.hideLocationModal();
                setTimeout(() => {
                    this.requestUserLocation().catch(error => {
                        console.error('위치 요청 실패:', error);
                    });
                }, 300);
            });
            console.log(' 위치 허용 버튼 이벤트 등록');
        }

        if (denyBtn) {
            denyBtn.addEventListener('click', () => {
                console.log('❌ 위치 정보 거부 선택');
                this.setLocationConsent('denied');
                this.hideLocationModal();
            });
            console.log(' 위치 거부 버튼 이벤트 등록');
        }
    }

    /**
     * 내 위치 버튼 이벤트 리스너 설정
     */
    static setupMyLocationButton() {
        const myLocationBtn = document.getElementById('myLocationBtn');
        if (myLocationBtn) {
            console.log(' 내 위치 버튼 이벤트 등록');
            
            // 기존 이벤트 제거 후 새로 등록 (중복 방지)
            const newBtn = myLocationBtn.cloneNode(true);
            myLocationBtn.parentNode.replaceChild(newBtn, myLocationBtn);
            newBtn.addEventListener('click', () => this.handleMyLocationClick());
        }
    }

    /**
     * 전역 이벤트 리스너 설정 (ESC, 오버레이 클릭)
     */
    static setupGlobalEventListeners() {
        // ESC 키로 위치 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('locationModal');
                if (modal && !modal.classList.contains('hidden')) {
                    this.hideLocationModal();
                }
            }
        });

        // 오버레이 클릭으로 위치 모달 닫기
        const locationModal = document.getElementById('locationModal');
        if (locationModal) {
            locationModal.addEventListener('click', (e) => {
                if (e.target === locationModal) {
                    this.hideLocationModal();
                }
            });
        }

        console.log(' 전역 이벤트 리스너 설정 완료');
    }

    /**
     * 권한 상태 확인 (고급 기능)
     * @returns {Promise<string>} 권한 상태
     */
    static async checkPermissionStatus() {
        if (!('permissions' in navigator)) {
            return 'unknown';
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state; // 'granted', 'denied', 'prompt'
        } catch (error) {
            console.warn('권한 상태 확인 실패:', error);
            return 'unknown';
        }
    }

    /**
     * 디버깅 정보 출력
     */
    static debug() {
        console.log(' 위치 시스템 디버깅 정보');
        console.log('- 브라우저 지원:', 'geolocation' in navigator);
        console.log('- 권한 API 지원:', 'permissions' in navigator);
        console.log('- 현재 동의 상태:', this.getLocationConsent());
        console.log('- 위치 모달 존재:', !!document.getElementById('locationModal'));
        console.log('- 내 위치 버튼 존재:', !!document.getElementById('myLocationBtn'));
    }
}

// 전역 노출
window.DdoksangLocation = DdoksangLocation;

// 하위 호환성을 위한 전역 함수들
window.resetLocationConsent = DdoksangLocation.resetLocationConsent;
window.showLocationModal = DdoksangLocation.showLocationModal;
window.hideLocationModal = DdoksangLocation.hideLocationModal;

console.log(' DdoksangLocation 클래스 로드 완료');