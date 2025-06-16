// 덕생 폼 관련 재사용 가능한 유틸리티 함수들

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

    // 버튼 상태 업데이트
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

    // 폼 검증 관련
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

    // ✅ 날짜 검증 제거 - DdoksangDateUtils로 이동됨


    // 생일 날짜 포맷팅
    formatBirthday(birthday) {
        const date = new Date(birthday);
        return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // 토스트 메시지 (기존 ddoksang_ui_components.js의 showToast 재사용)
    showToast(message, type = 'info') {
        // 전역 showToast 함수 사용 (ddoksang_ui_components.js에서 정의됨)
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // showToast 함수가 없으면 직접 토스트 생성
            this.createToast(message, type);
        }
    },

        createToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        const colors = {
            success: '#10b981',
            warning: '#f59e0b', 
            error: '#ef4444',
            info: '#3b82f6'
        };

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: colors[type] || colors.info,
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '9999px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            opacity: 0,
            transition: 'opacity 0.4s ease',
            fontSize: '14px',
            fontWeight: '500'
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => (toast.style.opacity = 1));

        setTimeout(() => {
            toast.style.opacity = 0;
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    },

    // 아티스트 선택 데이터 정규화
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

    // ✅ 호환성을 위한 날짜 검증 래퍼 함수 (기존 코드와의 호환성 유지)
    validateDateRange(startDateId, endDateId) {
        // DdoksangDateUtils가 있으면 사용, 없으면 기본 검증
        if (window.DdoksangDateUtils) {
            return window.DdoksangDateUtils.validateDateRange(startDateId, endDateId, false);
        }
        
        // fallback 검증 (DdoksangDateUtils가 없을 때)
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
    }
};

// ✅ 지도 관련 유틸리티 개선
window.DdoksangMapUtils = {
    map: null,
    ps: null,
    marker: null,
    isInitialized: false,

    // ✅ 지도 초기화 개선
    initMap(containerId = 'map', options = {}) {
        console.log('🗺️ 지도 초기화 시작');
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ 지도 컨테이너를 찾을 수 없습니다:', containerId);
            return null;
        }

        if (typeof kakao === 'undefined' || !kakao.maps) {
            console.error('❌ 카카오맵 API가 로드되지 않았습니다');
            this.showMapError(container, '카카오맵 API 로드 실패');
            return null;
        }

        try {
            // 컨테이너 스타일 확인 및 설정
            container.style.display = 'block';
            container.style.width = '100%';
            container.style.height = '100%';
            
            // placeholder 숨기기
            const placeholder = document.getElementById('mapPlaceholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }

            console.log('📏 지도 컨테이너 크기:', {
                width: container.offsetWidth,
                height: container.offsetHeight,
                display: getComputedStyle(container).display
            });

            const defaultOptions = {
                center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울 시청
                level: 8, // 더 넓은 범위로 시작
                ...options
            };

            // 지도 생성
            this.map = new kakao.maps.Map(container, defaultOptions);
            
            // Places 서비스 초기화
            this.ps = new kakao.maps.services.Places();
            
            // 마커 생성 (초기에는 숨김)
            this.marker = new kakao.maps.Marker({
                map: this.map,
                position: defaultOptions.center
            });
            this.marker.setMap(null); // 초기에 숨김

            // 지도 크기 재조정 (100ms 후)
            setTimeout(() => {
                if (this.map) {
                    kakao.maps.event.trigger(this.map, 'resize');
                    console.log('✅ 지도 크기 재조정 완료');
                }
            }, 100);

            this.isInitialized = true;
            console.log('✅ 지도 초기화 완료');
            
            return this.map;

        } catch (error) {
            console.error('❌ 지도 초기화 오류:', error);
            this.showMapError(container, '지도 초기화 실패');
            return null;
        }
    },

    // ✅ 지도 오류 표시
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

    // ✅ 장소 검색 개선
    searchPlaces(keyword, callback) {
        if (!this.ps) {
            console.error('❌ Places 서비스가 초기화되지 않았습니다');
            callback(false, []);
            return;
        }
        
        console.log('🔍 장소 검색 시작:', keyword);
        
        this.ps.keywordSearch(keyword, (data, status) => {
            const success = status === kakao.maps.services.Status.OK;
            console.log('🔍 검색 결과:', { success, count: data?.length || 0 });
            callback(success, data || []);
        });
    },

    // ✅ 장소 선택 개선
    selectPlace(place, formFields = {}) {
        if (!this.map || !this.marker) {
            console.error('❌ 지도 또는 마커가 초기화되지 않았습니다');
            return null;
        }

        try {
            const latlng = new kakao.maps.LatLng(place.y, place.x);
            
            // 지도 중심 이동
            this.map.setCenter(latlng);
            this.map.setLevel(3); // 상세 레벨로 변경
            
            // 마커 위치 설정 및 표시
            this.marker.setPosition(latlng);
            this.marker.setMap(this.map);

            // 기본 폼 필드 업데이트
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

            console.log('✅ 장소 선택 완료:', place.place_name);
            return place;

        } catch (error) {
            console.error('❌ 장소 선택 오류:', error);
            return null;
        }
    },

    // ✅ 지도 상태 확인
    isMapReady() {
        return this.isInitialized && this.map && this.ps;
    },

    // ✅ 지도 재초기화
    reinitialize() {
        console.log('🔄 지도 재초기화 시작');
        this.isInitialized = false;
        this.map = null;
        this.ps = null;
        this.marker = null;
        
        setTimeout(() => {
            this.initMap();
        }, 100);
    }
};

// 이미지 업로드 유틸리티 (기존 유지)
window.DdoksangImageUtils = {
    // 드래그 앤 드롭 설정
    setupDragAndDrop(containerId, inputId) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        if (!container || !input) return;

        container.addEventListener('dragover', e => {
            e.preventDefault();
            container.classList.add('border-gray-400', 'bg-gray-50');
        });

        container.addEventListener('dragleave', e => {
            e.preventDefault();
            container.classList.remove('border-gray-400', 'bg-gray-50');
        });

        container.addEventListener('drop', e => {
            e.preventDefault();
            container.classList.remove('border-gray-400', 'bg-gray-50');

            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            if (files.length) {
                const dt = new DataTransfer();
                files.forEach(f => dt.items.add(f));
                input.files = dt.files;
                
                // 커스텀 이벤트 발생
                input.dispatchEvent(new Event('change'));
            }
        });
    },

    // 이미지 프리뷰 생성
    createPreview(file, index, isMain = false) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => {
                const div = document.createElement("div");
                div.className = "relative";
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}" 
                         class="w-full h-32 object-cover rounded border">
                    <div class="absolute top-2 left-2 bg-gray-900 text-white text-xs px-2 py-1 rounded">
                        ${isMain ? '대표' : index + 1}
                    </div>
                    <button type="button" onclick="window.removeImage(${index})" 
                            class="absolute top-2 right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full hover:bg-red-600 transition-colors">×</button>
                `;
                resolve(div);
            };
            reader.readAsDataURL(file);
        });
    },

    // 이미지 제거
    removeImageAt(inputId, index) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const dt = new DataTransfer();
        Array.from(input.files).forEach((file, i) => {
            if (i !== index) dt.items.add(file);
        });
        input.files = dt.files;
        
        // 커스텀 이벤트 발생
        input.dispatchEvent(new Event('change'));
    }
};

