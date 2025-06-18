// ddoksang_form_utils.js - 최적화된 create.js와 호환

window.DdoksangFormUtils = {
    // 기본 유틸리티 함수들
    getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    },

    setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    },

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '';
    },

    toggleClass(id, className, condition) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle(className, condition);
    },

    // 검정색 테마 버튼 스타일
    getButtonStyles() {
        return {
            active: "bg-gray-900 text-white hover:bg-gray-800 transition-colors",
            disabled: "bg-gray-400 text-gray-200 cursor-not-allowed",
            loading: "bg-gray-600 text-white cursor-not-allowed"
        };
    },

    // 버튼 상태 업데이트 (최적화된 create.js와 호환)
    updateButtonState(buttonId, isEnabled) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const styles = this.getButtonStyles();
        button.disabled = !isEnabled;
        
        // 기존 스타일 클래스 제거
        button.className = button.className.replace(/bg-gray-\d+|text-gray-\d+|hover:bg-gray-\d+|cursor-\w+/g, '').trim();
        
        // 새 스타일 클래스 추가
        const baseClasses = button.className;
        const newStyle = isEnabled ? styles.active : styles.disabled;
        button.className = `${baseClasses} ${newStyle}`.trim();
    },

    // 폼 검증 관련 (최적화된 create.js에서 사용)
    validateRequired(fieldIds, focusOnError = true) {
        for (const id of fieldIds) {
            const value = this.getValue(id);
            if (!value) {
                if (focusOnError) {
                    const field = document.getElementById(id);
                    if (field) field.focus();
                }
                return { valid: false, field: id };
            }
        }
        return { valid: true };
    },

    // 날짜 검증 (DdoksangDateUtils 연동)
    validateDateRange(startDateId, endDateId) {
        if (window.DdoksangDateUtils) {
            return window.DdoksangDateUtils.validateDateRange(startDateId, endDateId, false);
        }
        
        // fallback 검증
        const startDate = this.getValue(startDateId);
        const endDate = this.getValue(endDateId);
        
        if (!startDate || !endDate) {
            return { valid: false, message: '시작일과 종료일을 모두 선택해주세요.' };
        }

        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');

        if (start > end) {
            return { valid: false, message: '종료일은 시작일보다 늦어야 합니다.' };
        }

        return { valid: true };
    },

    // 생일 날짜 포맷팅
    formatBirthday(birthday) {
        const date = new Date(birthday);
        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // 토스트 메시지 (최적화된 create.js와 호환)
    showToast(message, type = 'info') {
        // 전역 showToast 함수 사용
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // showToast 함수가 없으면 직접 토스트 생성
            this.createToast(message, type);
        }
    },

    createToast(message, type = 'info') {
        // 기존 토스트 제거
        const existing = document.querySelector('.toast-message');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-message fixed bottom-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300';

        const colors = {
            success: '#10b981',
            warning: '#f59e0b', 
            error: '#ef4444',
            info: '#3b82f6'
        };

        Object.assign(toast.style, {
            backgroundColor: colors[type] || colors.info,
            fontSize: '14px',
            fontWeight: '500',
            opacity: 0
        });

        toast.textContent = message;
        document.body.appendChild(toast);

        // 애니메이션
        requestAnimationFrame(() => (toast.style.opacity = 1));

        setTimeout(() => {
            toast.style.opacity = 0;
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            });
        }, 3000);
    },

    // 아티스트 선택 데이터 정규화 (최적화된 create.js에서 사용)
    normalizeArtistData(item) {
        const isGroup = !item.member_id || item.member_id === item.artist_id || 
                       item.member_name === item.artist_display;
        
        return {
            artistId: item.artist_id || '',
            memberId: isGroup ? '' : (item.member_id || ''),
            displayText: isGroup ? 
                `${item.artist_display} (그룹 전체)` : 
                `${item.member_name} (${item.artist_display})`,
            isGroup
        };
    },

    // 파일 크기 검증
    validateFileSize(file, maxSizeMB = 5) {
        const maxSize = maxSizeMB * 1024 * 1024;
        return file.size <= maxSize;
    },

    // 이미지 파일 검증
    validateImageFiles(files, maxCount = 5, maxSizeMB = 5) {
        if (files.length > maxCount) {
            return { valid: false, message: `최대 ${maxCount}개의 이미지만 업로드할 수 있습니다.` };
        }

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                return { valid: false, message: '이미지 파일만 업로드할 수 있습니다.' };
            }
            if (!this.validateFileSize(file, maxSizeMB)) {
                return { valid: false, message: `${file.name}: 파일 크기가 ${maxSizeMB}MB를 초과합니다.` };
            }
        }

        return { valid: true };
    },

    // 필드 라벨 가져오기 (최적화된 create.js에서 사용)
    getFieldLabel(fieldId) {
        const labels = {
            'final_artist_id': '아티스트',
            'cafe_name': '카페명',
            'address': '주소',
            'latitude': '위치',
            'longitude': '위치',
            'start_date': '시작일',
            'end_date': '종료일',
            'event_description': '이벤트 설명',
            'images': '이미지'
        };
        
        return labels[fieldId] || fieldId;
    },

    // 디버깅 도구
    debug() {
        return {
            formUtils: 'active',
            dateUtils: !!window.DdoksangDateUtils,
            mapUtils: !!window.DdoksangMapUtils,
            imageUploader: !!window.ddoksangImageUploader,
            mainApp: !!window.ddoksangApp
        };
    }
};

// 지도 관련 유틸리티 (기존 유지, 최적화된 create.js와 호환성 확인)
window.DdoksangMapUtils = {
    map: null,
    ps: null,
    marker: null,
    isInitialized: false,

    // 지도 초기화
    initMap(containerId = 'map', options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('지도 컨테이너를 찾을 수 없습니다:', containerId);
            return null;
        }

        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.error('카카오맵 API가 로드되지 않았습니다');
            this.showMapError(container, '카카오맵 API 로드 실패');
            return null;
        }

        try {
            container.style.display = 'block';
            container.style.width = '100%';
            container.style.height = '100%';
            
            const placeholder = document.getElementById('mapPlaceholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }

            const defaultOptions = {
                center: new kakao.maps.LatLng(37.5665, 126.9780),
                level: 8,
                ...options
            };

            this.map = new kakao.maps.Map(container, defaultOptions);
            this.ps = new kakao.maps.services.Places();
            
            this.marker = new kakao.maps.Marker({
                map: this.map,
                position: defaultOptions.center
            });
            this.marker.setMap(null);

            setTimeout(() => {
                if (this.map) {
                    kakao.maps.event.trigger(this.map, 'resize');
                }
            }, 100);

            this.isInitialized = true;
            return this.map;

        } catch (error) {
            console.error('지도 초기화 오류:', error);
            this.showMapError(container, '지도 초기화 실패');
            return null;
        }
    },

    // 지도 오류 표시
    showMapError(container, message) {
        if (container) {
            container.innerHTML = `
                <div class="w-full h-full bg-gray-100 flex items-center justify-center border border-gray-200 rounded">
                    <div class="text-center text-gray-500">
                        <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9z"></path>
                        </svg>
                        <p class="text-sm font-medium mb-1">${message}</p>
                        <button onclick="window.location.reload()" class="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors">
                            새로고침
                        </button>
                    </div>
                </div>
            `;
        }
    },

    // 장소 검색
    searchPlaces(keyword, callback) {
        if (!this.ps) {
            console.error('Places 서비스가 초기화되지 않았습니다');
            callback(false, []);
            return;
        }
        
        this.ps.keywordSearch(keyword, (data, status) => {
            const success = status === kakao.maps.services.Status.OK;
            callback(success, data || []);
        });
    },

    // 장소 선택
    selectPlace(place, formFields = {}) {
        if (!this.map || !this.marker) {
            console.error('지도 또는 마커가 초기화되지 않았습니다');
            return null;
        }

        try {
            const latlng = new kakao.maps.LatLng(place.y, place.x);
            
            this.map.setCenter(latlng);
            this.map.setLevel(3);
            
            this.marker.setPosition(latlng);
            this.marker.setMap(this.map);

            const defaultFields = {
                place_name: place.place_name || '',
                address: place.address_name || '',
                road_address: place.road_address_name || '',
                latitude: place.y || '',
                longitude: place.x || '',
                kakao_place_id: place.id || ''
            };

            const fields = { ...defaultFields, ...formFields };
            Object.entries(fields).forEach(([id, value]) => {
                window.DdoksangFormUtils.setValue(id, value);
            });

            return place;

        } catch (error) {
            console.error('장소 선택 오류:', error);
            return null;
        }
    },

    // 지도 상태 확인
    isMapReady() {
        return this.isInitialized && this.map && this.ps;
    },

    // 지도 재초기화
    reinitialize() {
        this.isInitialized = false;
        this.map = null;
        this.ps = null;
        this.marker = null;
        
        setTimeout(() => {
            this.initMap();
        }, 100);
    }
};