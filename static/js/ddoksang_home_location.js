// 위치 권한 및 요청 관리 - 브라우저 위치 권한 팝업 우선 호출 버전

class DdoksangLocation {
    static modalShown = false;
    static isInitialized = false;
    static globalEventsSetup = false;

    static getLocationConsent() {
        try {
            return localStorage.getItem('ddoksang_location_consent');
        } catch (e) {
            return sessionStorage.getItem('ddoksang_location_consent') || null;
        }
    }

    static setLocationConsent(status) {
        try {
            localStorage.setItem('ddoksang_location_consent', status);
        } catch (e) {
            sessionStorage.setItem('ddoksang_location_consent', status);
        }
        this.modalShown = true;
    }

    static showLocationModal() {
        if (this.modalShown) return;
        const modal = document.getElementById('locationModal');
        if (!modal || !modal.classList.contains('hidden')) return;
        modal.classList.remove('hidden');
        this.modalShown = true;
    }

    static hideLocationModal() {
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    static async checkBrowserPermission() {
        if (!('permissions' in navigator)) return 'unknown';
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state;
        } catch {
            return 'unknown';
        }
    }

    static async requestUserLocation() {
        const myLocationBtn = document.getElementById('myLocationBtn');
        if (!myLocationBtn) throw new Error('내 위치 버튼을 찾을 수 없습니다');

        const originalText = myLocationBtn.innerHTML;
        myLocationBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span class="hidden sm:inline ml-1">위치 찾는 중...</span>
        `;

        try {
            if (!navigator.geolocation) throw new Error('이 브라우저에서는 위치 서비스를 지원하지 않습니다');
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 600000
                });
            });
            
            const { latitude: lat, longitude: lng } = position.coords;
            
            if (window.ddoksangHome?.mapManager) {
                window.ddoksangHome.mapManager.moveToLocation(lat, lng, 6);
                window.ddoksangHome.mapManager.addUserLocationMarker(lat, lng);
            }
            
            if (window.ddoksangToast) {
                window.ddoksangToast.success('내 위치를 찾았습니다! 📍');
            }
            
            myLocationBtn.innerHTML = originalText;
            return { lat, lng };
            
        } catch (error) {
            myLocationBtn.innerHTML = originalText;
            await this.handleLocationError(error);
            throw error;
        }
    }

    static async handleLocationError(error) {
        let errorMessage = '';
        let actionMessage = '';
        let resetConsent = false;

        if (error.code === 1) { // PERMISSION_DENIED
            errorMessage = '위치 권한이 거부되었습니다.';
            actionMessage = '브라우저 설정에서 위치 권한을 허용해주세요.';
            resetConsent = true;
            this.showPermissionGuide();
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
            errorMessage = '위치 정보를 사용할 수 없습니다.';
            actionMessage = 'GPS가 꺼져있거나 실내에서는 위치를 찾기 어려울 수 있습니다.';
        } else if (error.code === 3) { // TIMEOUT
            errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
            actionMessage = '네트워크 상태를 확인하고 다시 시도해주세요.';
        } else {
            errorMessage = '위치 정보를 가져올 수 없습니다.';
            actionMessage = '잠시 후 다시 시도해주세요.';
        }

        if (resetConsent) this.resetLocationConsent();

        if (window.ddoksangToast) {
            window.ddoksangToast.error(`${errorMessage}\n${actionMessage}`);
        } else {
            alert(`${errorMessage}\n${actionMessage}`);
        }
    }

    static showPermissionGuide() {
        const guide = `📍 위치 권한 설정 방법:\n\n1. 주소창 왼쪽 자물쇠 아이콘 클릭\n2. "위치" 설정을 "허용"으로 변경\n3. 페이지 새로고침 후 다시 시도\n\n또는 브라우저 설정 → 개인정보 및 보안 → 사이트 설정 → 위치에서 허용 목록에 추가하세요.`;
        if (confirm('위치 권한 설정 방법을 확인하시겠습니까?')) {
            window.open('https://support.google.com/chrome/answer/142065', '_blank');
        }
    }

    // 브라우저 위치 권한 팝업을 우선으로 호출
    static async handleMyLocationClick() {
        try {
            const permissionState = await this.checkBrowserPermission();
            
            // 1. 권한이 이미 거부된 경우에만 가이드 표시
            if (permissionState === 'denied') {
                this.showPermissionGuide();
                return;
            }
            
            // 2. 권한 상태에 관계없이 브라우저 위치 API 호출 시도
            // (브라우저가 자동으로 권한 요청 팝업을 띄움)
            await this.requestUserLocation();
            
        } catch (error) {
            // 3. 실패한 경우에만 에러 처리
            console.warn('위치 요청 실패:', error);
            
            // 권한이 거부된 경우가 아니라면 일반 에러 메시지만 표시
            if (error.code !== 1) {
                if (window.ddoksangToast) {
                    window.ddoksangToast.error('위치 서비스를 사용할 수 없습니다.');
                }
            }
        }
    }

    static resetLocationConsent() {
        try {
            localStorage.removeItem('ddoksang_location_consent');
        } catch {
            sessionStorage.removeItem('ddoksang_location_consent');
        }
        this.modalShown = false;
    }

    static init() {
        if (this.isInitialized) return;
        
        // 자동 모달 표시 제거 - 사용자가 버튼을 클릭할 때만 권한 요청
        const consent = this.getLocationConsent();
        
        this.setupModalEventListeners();
        this.setupMyLocationButton();
        this.setupGlobalEventListeners();
        this.isInitialized = true;
    }

    static setupModalEventListeners() {
        const allowBtn = document.getElementById('allowLocationBtn');
        const denyBtn = document.getElementById('denyLocationBtn');

        if (allowBtn) {
            const newAllowBtn = allowBtn.cloneNode(true);
            allowBtn.parentNode.replaceChild(newAllowBtn, allowBtn);
            newAllowBtn.addEventListener('click', async () => {
                this.setLocationConsent('allowed');
                this.hideLocationModal();
                setTimeout(async () => {
                    try {
                        await this.requestUserLocation();
                    } catch {}
                }, 500);
            });
        }

        if (denyBtn) {
            const newDenyBtn = denyBtn.cloneNode(true);
            denyBtn.parentNode.replaceChild(newDenyBtn, denyBtn);
            newDenyBtn.addEventListener('click', () => {
                this.setLocationConsent('denied');
                this.hideLocationModal();
                if (window.ddoksangToast) {
                    window.ddoksangToast.info('위치 기반 서비스를 사용하지 않습니다.');
                }
            });
        }
    }

    static setupMyLocationButton() {
        const myLocationBtn = document.getElementById('myLocationBtn');
        if (myLocationBtn) {
            const newBtn = myLocationBtn.cloneNode(true);
            myLocationBtn.parentNode.replaceChild(newBtn, myLocationBtn);
            newBtn.addEventListener('click', () => this.handleMyLocationClick());
        }
    }

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
}

window.DdoksangLocation = DdoksangLocation;
window.resetLocationConsent = () => DdoksangLocation.resetLocationConsent();
window.showLocationModal = () => DdoksangLocation.showLocationModal();
window.hideLocationModal = () => DdoksangLocation.hideLocationModal();