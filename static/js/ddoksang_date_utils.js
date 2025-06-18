// static/js/ddoksang_date_utils.js - 최종 버전
// 덕생 날짜 관련 유틸리티 - flatpickr 중앙화

window.DdoksangDateUtils = {
    // 기본 flatpickr 설정
    getDefaultConfig() {
        return {
            dateFormat: "Y-m-d",
            allowInput: true,
            clickOpens: true,
            altInput: false,
            parseDate: (datestr, format) => {
                if (typeof datestr === 'string') {
                    // 숫자만 추출
                    const numbers = datestr.replace(/\D/g, '');
                    
                    // 8자리 숫자인 경우 (YYYYMMDD)
                    if (numbers.length === 8) {
                        const year = numbers.substring(0, 4);
                        const month = numbers.substring(4, 6);
                        const day = numbers.substring(6, 8);
                        const formatted = `${year}-${month}-${day}`;
                        const date = new Date(formatted);
                        if (!isNaN(date.getTime())) {
                            return date;
                        }
                    }
                    
                    // 기존 하이픈 포맷 지원
                    const cleaned = datestr.replace(/[.\-\/]/g, '-');
                    const date = new Date(cleaned);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
                return undefined;
            },
            locale: {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['일', '월', '화', '수', '목', '금', '토'],
                    longhand: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
                },
                months: {
                    shorthand: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                    longhand: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
                }
            }
        };
    },

    // 자동 하이픈 입력 리스너 추가
    addAutoHyphenListener(element) {
        if (!element) return;
        
        // 기존 리스너 제거
        element.removeEventListener('input', this._handleInput);
        element.removeEventListener('keydown', this._handleKeydown);
        
        // 새 리스너 추가
        const handleInput = (e) => {
            let value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
            
            if (value.length >= 4) {
                value = value.substring(0, 4) + '-' + value.substring(4);
            }
            if (value.length >= 7) {
                value = value.substring(0, 7) + '-' + value.substring(7, 9);
            }
            
            // 최대 10자리 (YYYY-MM-DD)
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
            
            e.target.value = value;
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Backspace') {
                const value = e.target.value;
                if (value.endsWith('-')) {
                    e.preventDefault();
                    e.target.value = value.slice(0, -1);
                }
            }
        };
        
        element.addEventListener('input', handleInput);
        element.addEventListener('keydown', handleKeydown);
        
        // 정리를 위해 참조 저장
        element._handleInput = handleInput;
        element._handleKeydown = handleKeydown;
    },

    // 단일 날짜 선택기 초기화
    initSinglePicker(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`날짜 선택기 초기화 실패: ${elementId} 요소를 찾을 수 없음`);
            return null;
        }
        
        if (typeof flatpickr === 'undefined') {
            console.warn(`날짜 선택기 초기화 실패: flatpickr 라이브러리가 로드되지 않음`);
            return null;
        }

        const config = {
            ...this.getDefaultConfig(),
            ...options
        };

        // 자동 하이픈 입력 이벤트 리스너 추가
        this.addAutoHyphenListener(element);

        try {
            const picker = flatpickr(element, config);
            console.log(`✅ ${elementId} 날짜 선택기 초기화 완료`);
            return picker;
        } catch (error) {
            console.error(`❌ ${elementId} 날짜 선택기 초기화 실패:`, error);
            return null;
        }
    },

    // 기간 선택기 초기화 (시작일-종료일 연동)
    initRangePickers(startId, endId, options = {}) {
        const startElement = document.getElementById(startId);
        const endElement = document.getElementById(endId);
        
        if (!startElement || !endElement) {
            console.warn(`기간 선택기 초기화 실패: ${startId} 또는 ${endId} 요소를 찾을 수 없음`);
            return { start: null, end: null };
        }
        
        if (typeof flatpickr === 'undefined') {
            console.warn(`기간 선택기 초기화 실패: flatpickr 라이브러리가 로드되지 않음`);
            return { start: null, end: null };
        }

        const baseConfig = this.getDefaultConfig();
        let startPicker, endPicker;

        // 자동 하이픈 입력 이벤트 리스너 추가
        this.addAutoHyphenListener(startElement);
        this.addAutoHyphenListener(endElement);

        try {
            // 시작일 선택기
            startPicker = flatpickr(startElement, {
                ...baseConfig,
                ...options.start,
                onChange: (selectedDates, dateStr, instance) => {
                    if (selectedDates[0] && endPicker) {
                        // 종료일의 최소 날짜를 시작일로 설정
                        endPicker.set('minDate', selectedDates[0]);
                        
                        // 현재 종료일이 시작일보다 이르면 종료일을 시작일로 설정
                        const currentEndDate = endPicker.selectedDates[0];
                        if (currentEndDate && currentEndDate < selectedDates[0]) {
                            endPicker.setDate(selectedDates[0]);
                            this.showToast('종료일이 시작일과 같은 날짜로 자동 조정되었습니다.', 'info');
                        }
                    }
                    
                    // 사용자 정의 onChange 콜백 실행
                    if (options.start?.onChange) {
                        options.start.onChange(selectedDates, dateStr, instance);
                    }
                }
            });

            // 종료일 선택기
            endPicker = flatpickr(endElement, {
                ...baseConfig,
                ...options.end,
                onChange: (selectedDates, dateStr, instance) => {
                    // 종료일이 시작일보다 이른지 검증
                    const startDate = startPicker.selectedDates[0];
                    if (startDate && selectedDates[0] && selectedDates[0] < startDate) {
                        this.showToast('종료일은 시작일보다 늦어야 합니다. 시작일로 설정합니다.', 'warning');
                        instance.setDate(startDate);
                        return;
                    }
                    
                    // 사용자 정의 onChange 콜백 실행
                    if (options.end?.onChange) {
                        options.end.onChange(selectedDates, dateStr, instance);
                    }
                }
            });

            console.log(`✅ ${startId}, ${endId} 기간 선택기 초기화 완료`);
            return { start: startPicker, end: endPicker };

        } catch (error) {
            console.error(`❌ 기간 선택기 초기화 실패:`, error);
            return { start: null, end: null };
        }
    },

    // 중복 확인용 기간 선택기
    initDuplicateCheckPickers(onChangeCallback) {
        console.log('📅 중복 확인 날짜 선택기 초기화');
        
        return this.initRangePickers('check_start_date', 'check_end_date', {
            start: {
                onChange: onChangeCallback || (() => {})
            },
            end: {
                onChange: onChangeCallback || (() => {})
            }
        });
    },

    // 생성 폼용 기간 선택기
    initCreateFormPickers(onChangeCallback) {
        console.log('📅 메인 폼 날짜 선택기 초기화');
        
        const today = new Date();
        
        return this.initRangePickers('start_date', 'end_date', {
            start: {
                defaultDate: today,
                onChange: onChangeCallback || (() => {})
            },
            end: {
                defaultDate: today,
                onChange: onChangeCallback || (() => {})
            }
        });
    },

    // 날짜 검증
    validateDateRange(startId, endId, showToast = true) {
        const startValue = document.getElementById(startId)?.value;
        const endValue = document.getElementById(endId)?.value;
        
        if (!startValue || !endValue) {
            if (showToast) this.showToast('시작일과 종료일을 모두 선택해주세요.', 'warning');
            return { valid: false, message: '시작일과 종료일을 모두 선택해주세요.' };
        }

        const startDate = new Date(startValue + 'T00:00:00');
        const endDate = new Date(endValue + 'T00:00:00');

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            if (showToast) this.showToast('올바른 날짜 형식이 아닙니다.', 'warning');
            return { valid: false, message: '올바른 날짜 형식이 아닙니다.' };
        }

        if (startDate > endDate) {
            if (showToast) this.showToast('종료일은 시작일보다 늦어야 합니다.', 'warning');
            return { valid: false, message: '종료일은 시작일보다 늦어야 합니다.' };
        }

        return { valid: true };
    },

    // 토스트 메시지
    showToast(message, type = 'info') {
        if (window.DdoksangFormUtils?.showToast) {
            window.DdoksangFormUtils.showToast(message, type);
        } else if (window.showToast) {
            window.showToast(message, type);
        } else {
            // 기본 토스트 생성
            this.createBasicToast(message, type);
        }
    },

    // 기본 토스트 생성 (fallback)
    createBasicToast(message, type = 'info') {
        // 기존 토스트 제거
        const existing = document.querySelector('.ddoksang-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'ddoksang-toast';
        
        const colors = {
            success: '#10b981',
            warning: '#f59e0b', 
            error: '#ef4444',
            info: '#3b82f6'
        };

        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: colors[type] || colors.info,
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '9999',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });

        toast.textContent = message;
        document.body.appendChild(toast);

        // 애니메이션
        requestAnimationFrame(() => (toast.style.opacity = '1'));

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    },

    // 날짜 포맷팅 유틸리티
    formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    },

    // 날짜 차이 계산
    getDaysDifference(startDate, endDate) {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T00:00:00');
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        
        const diffTime = end.getTime() - start.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1은 시작일 포함
    },

    // 초기화 상태 확인
    isReady() {
        return typeof flatpickr !== 'undefined';
    },

    // 디버깅 정보
    debug() {
        return {
            flatpickrLoaded: typeof flatpickr !== 'undefined',
            formUtilsLoaded: !!window.DdoksangFormUtils,
            checkStartElement: !!document.getElementById('check_start_date'),
            checkEndElement: !!document.getElementById('check_end_date'),
            startElement: !!document.getElementById('start_date'),
            endElement: !!document.getElementById('end_date')
        };
    }
};

// 전역 편의 함수
window.initDateRangePickers = function(startId, endId, options) {
    return window.DdoksangDateUtils.initRangePickers(startId, endId, options);
};

// 즉시 초기화 함수 (필요시 호출)
window.initAllDatePickers = function() {
    if (!window.DdoksangDateUtils.isReady()) {
        console.error('❌ flatpickr가 로드되지 않았습니다');
        return false;
    }

    try {
        // 중복 확인용 날짜 선택기
        const duplicatePickers = window.DdoksangDateUtils.initDuplicateCheckPickers();
        
        // 메인 폼용 날짜 선택기
        const formPickers = window.DdoksangDateUtils.initCreateFormPickers();
        
        const success = (duplicatePickers.start && duplicatePickers.end && 
                        formPickers.start && formPickers.end);
        
        console.log('📅 전체 날짜 선택기 초기화:', success ? '성공' : '실패');
        return success;
        
    } catch (error) {
        console.error('❌ 날짜 선택기 초기화 오류:', error);
        return false;
    }
};

// 디버깅 함수
window.debugDatePickers = function() {
    console.log('🔍 날짜 선택기 디버그 정보:', window.DdoksangDateUtils.debug());
};

console.log('✅ DdoksangDateUtils 로드 완료');