// static/js/ddoksang_date_utils.js
// 덕생 날짜 관련 유틸리티 - flatpickr 중앙화
window.DdoksangDateUtils = {
    // 기본 flatpickr 설정
    getDefaultConfig() {
        return {
            dateFormat: "Y-m-d",
            allowInput: true, // ✅ 직접 입력 허용
            clickOpens: true,  // ✅ 클릭으로도 열기
            altInput: false,   // ✅ 대체 입력 필드 사용 안함
            parseDate: (datestr, format) => {
                // 사용자가 직접 입력한 날짜 파싱 개선
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
                firstDayOfWeek: 1, // 월요일 시작
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

    // 단일 날짜 선택기 초기화
    initSinglePicker(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element || typeof flatpickr === 'undefined') {
            console.warn(`날짜 선택기 초기화 실패: ${elementId}`);
            return null;
        }

        const config = {
            ...this.getDefaultConfig(),
            ...options
        };

        // ✅ 자동 하이픈 입력 이벤트 리스너 추가
        this.addAutoHyphenListener(element);

        return flatpickr(element, config);
    },

    // ✅ 자동 하이픈 포맷팅 함수
    addAutoHyphenListener(element) {
        element.addEventListener('input', (e) => {
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
        });

        // ✅ 백스페이스 처리
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                const value = e.target.value;
                if (value.endsWith('-')) {
                    e.preventDefault();
                    e.target.value = value.slice(0, -1);
                }
            }
        });
    },

    // 기간 선택기 초기화 (시작일-종료일 연동)
    initRangePickers(startId, endId, options = {}) {
        const startElement = document.getElementById(startId);
        const endElement = document.getElementById(endId);
        
        if (!startElement || !endElement || typeof flatpickr === 'undefined') {
            console.warn(`기간 선택기 초기화 실패: ${startId}, ${endId}`);
            return { start: null, end: null };
        }

        const baseConfig = this.getDefaultConfig();
        let startPicker, endPicker;

        // ✅ 자동 하이픈 입력 이벤트 리스너 추가
        this.addAutoHyphenListener(startElement);
        this.addAutoHyphenListener(endElement);

        // 시작일 선택기
        startPicker = flatpickr(startElement, {
            ...baseConfig,
            ...options.start,
            onChange: (selectedDates, dateStr, instance) => {
                if (selectedDates[0]) {
                    // 종료일의 최소 날짜를 시작일로 설정
                    if (endPicker) {
                        endPicker.set('minDate', selectedDates[0]);
                        
                        // 현재 종료일이 시작일보다 이르면 종료일을 시작일로 설정
                        const currentEndDate = endPicker.selectedDates[0];
                        if (currentEndDate && currentEndDate < selectedDates[0]) {
                            // ✅ 자동으로 종료일을 시작일과 같게 설정 (데이터 보존)
                            endPicker.setDate(selectedDates[0]);
                            this.showToast('종료일이 시작일과 같은 날짜로 자동 조정되었습니다.', 'info');
                        }
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
                    // ✅ 경고만 표시하고 값은 시작일로 설정
                    this.showToast('종료일은 시작일보다 늦어야 합니다. 시작일로 설정합니다.', 'warning');
                    // 시작일과 같은 날짜로 설정
                    instance.setDate(startDate);
                    return;
                }
                
                // 사용자 정의 onChange 콜백 실행
                if (options.end?.onChange) {
                    options.end.onChange(selectedDates, dateStr, instance);
                }
            }
        });

        return { start: startPicker, end: endPicker };
    },

    // 중복 확인용 기간 선택기 (별도 관리)
    initDuplicateCheckPickers(onChangeCallback) {
        return this.initRangePickers('check_start_date', 'check_end_date', {
            start: {
                onChange: onChangeCallback
            },
            end: {
                onChange: onChangeCallback
            }
        });
    },

    // 생성 폼용 기간 선택기
    initCreateFormPickers(onChangeCallback) {
        return this.initRangePickers('start_date', 'end_date', {
            start: {
                defaultDate: new Date(), // 오늘 날짜를 기본값으로
                onChange: onChangeCallback
            },
            end: {
                defaultDate: new Date(), // 오늘 날짜를 기본값으로
                onChange: onChangeCallback
            }
        });
    },

    // 날짜 검증 (기존 DdoksangFormUtils에서 이동)
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

    // 토스트 메시지 (기존 유틸리티 재사용)
    showToast(message, type = 'info') {
        if (window.DdoksangFormUtils?.showToast) {
            window.DdoksangFormUtils.showToast(message, type);
        } else if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message); // fallback
        }
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
    }
};

// 전역 편의 함수
window.initDateRangePickers = function(startId, endId, options) {
    return window.DdoksangDateUtils.initRangePickers(startId, endId, options);
};

console.log('✅ DdoksangDateUtils 로드됨');