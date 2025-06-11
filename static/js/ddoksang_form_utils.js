// static/js/ddoksang_form_utils.js
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

    // 날짜 검증
    validateDateRange(startDateId, endDateId) {
        const startDate = this.getValue(startDateId);
        const endDate = this.getValue(endDateId);
        
        if (!startDate || !endDate) {
            return { valid: false, message: '시작일과 종료일을 모두 선택해주세요.' };
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

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

    // 토스트 메시지 (기존 ddoksang_ui_components.js의 showToast 재사용)
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message); // fallback
        }
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
    }
};

// 지도 관련 유틸리티
window.DdoksangMapUtils = {
    map: null,
    ps: null,
    marker: null,

    // 지도 초기화
    initMap(containerId = 'map', options = {}) {
        const container = document.getElementById(containerId);
        if (!container || typeof kakao === 'undefined') return null;

        const defaultOptions = {
            center: new kakao.maps.LatLng(37.5665, 126.9780),
            level: 3,
            ...options
        };

        this.map = new kakao.maps.Map(container, defaultOptions);
        this.ps = new kakao.maps.services.Places();
        this.marker = new kakao.maps.Marker({ map: this.map });

        // placeholder 숨기기
        const placeholder = document.getElementById('mapPlaceholder');
        if (placeholder) placeholder.style.display = 'none';

        return this.map;
    },

    // 장소 검색
    searchPlaces(keyword, callback) {
        if (!this.ps) return;
        
        this.ps.keywordSearch(keyword, (data, status) => {
            const success = status === kakao.maps.services.Status.OK;
            callback(success, data);
        });
    },

    // 장소 선택
    selectPlace(place, formFields = {}) {
        if (!this.map || !this.marker) return;

        const latlng = new kakao.maps.LatLng(place.y, place.x);
        this.map.setCenter(latlng);
        this.marker.setPosition(latlng);

        // 기본 폼 필드 업데이트
        const defaultFields = {
            place_name: place.place_name,
            address: place.address_name,
            road_address: place.road_address_name || '',
            latitude: place.y,
            longitude: place.x,
            kakao_place_id: place.id
        };

        const fields = { ...defaultFields, ...formFields };
        Object.entries(fields).forEach(([id, value]) => {
            window.DdoksangFormUtils.setValue(id, value);
        });

        return place;
    }
};

// 이미지 업로드 유틸리티
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
