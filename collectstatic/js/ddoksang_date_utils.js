// ddoksang_date_utils.js - 날짜 입력 문제 완전 해결

window.DdoksangDateUtils = {
    
    // flatpickr 기본 설정
    getDefaultConfig() {
        return {
            dateFormat: "Y-m-d",
            allowInput: true,
            clickOpens: true,
            altInput: false,
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
            },
            parseDate: (datestr) => {
                if (!datestr) return undefined;
                
                // 숫자만 추출
                const numbers = datestr.replace(/\D/g, '');
                
                // 8자리 숫자 (YYYYMMDD)
                if (numbers.length === 8) {
                    const year = numbers.substring(0, 4);
                    const month = numbers.substring(4, 6);
                    const day = numbers.substring(6, 8);
                    const date = new Date(`${year}-${month}-${day}`);
                    return isNaN(date.getTime()) ? undefined : date;
                }
                
                // YYYY-MM-DD 형식
                if (datestr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const date = new Date(datestr);
                    return isNaN(date.getTime()) ? undefined : date;
                }
                
                return undefined;
            }
        };
    },

    // 자동 하이픈 기능 (flatpickr와 독립적으로 작동)
    addAutoHyphen(element) {
        if (!element) return;
        
        // 기존 리스너 제거
        if (element._hyphenHandler) {
            element.removeEventListener('input', element._hyphenHandler);
        }
        if (element._keydownHandler) {
            element.removeEventListener('keydown', element._keydownHandler);
        }
        
        const hyphenHandler = (e) => {
            let value = e.target.value.replace(/\D/g, ''); // 숫자만
            
            // YYYY-MM-DD 형식으로 변환
            if (value.length >= 4) {
                value = value.substring(0, 4) + '-' + value.substring(4);
            }
            if (value.length >= 7) {
                value = value.substring(0, 7) + '-' + value.substring(7, 9);
            }
            if (value.length > 10) {
                value = value.substring(0, 10);
            }
            
            e.target.value = value;
            
            // 상태 업데이트 트리거
            if (window.updateDuplicateButton) {
                window.updateDuplicateButton();
            }
        };
        
        const keydownHandler = (e) => {
            // 백스페이스로 하이픈 제거
            if (e.key === 'Backspace' && e.target.value.endsWith('-')) {
                e.preventDefault();
                e.target.value = e.target.value.slice(0, -1);
            }
        };
        
        element.addEventListener('input', hyphenHandler);
        element.addEventListener('keydown', keydownHandler);
        
        // 참조 저장
        element._hyphenHandler = hyphenHandler;
        element._keydownHandler = keydownHandler;
        
    },

    // 단일 날짜 선택기 초기화
    initDatePicker(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`날짜 선택기 초기화 실패: ${elementId} 요소 없음`);
            return null;
        }
        
        // 요소 활성화
        element.disabled = false;
        element.readOnly = false;
        element.style.pointerEvents = 'auto';
        element.style.backgroundColor = 'white';
        element.style.cursor = 'text';
        
        // 자동 하이픈 기능 먼저 추가
        this.addAutoHyphen(element);
        
        // flatpickr 사용 가능한 경우
        if (typeof flatpickr !== 'undefined') {
            try {
                const config = {
                    ...this.getDefaultConfig(),
                    onChange: (selectedDates, dateStr, instance) => {
                        console.log(`날짜 선택됨: ${elementId} = ${dateStr}`);
                        
                        // 사용자 콜백 실행
                        if (options.onChange) {
                            options.onChange(selectedDates, dateStr, instance);
                        }
                        
                        // 상태 업데이트
                        if (window.updateDuplicateButton) {
                            setTimeout(() => window.updateDuplicateButton(), 50);
                        }
                    },
                    ...options
                };
                
                const picker = flatpickr(element, config);
                console.log(`flatpickr 초기화 성공: ${elementId}`);
                return picker;
                
            } catch (error) {
                console.error(`flatpickr 초기화 실패: ${elementId}`, error);
            }
        } else {
            console.warn('flatpickr 라이브러리 없음 - 자동 하이픈만 사용');
        }
        
        return null;
    },

    // 기간 선택기 초기화
    initRangePickers(startId, endId, options = {}) {
        console.log(`기간 선택기 초기화: ${startId}, ${endId}`);
        
        const startElement = document.getElementById(startId);
        const endElement = document.getElementById(endId);
        
        if (!startElement || !endElement) {
            console.warn(`기간 선택기 초기화 실패: 요소 없음`);
            return { start: null, end: null };
        }
        
        let startPicker = null;
        let endPicker = null;
        
        // 시작일 선택기
        startPicker = this.initDatePicker(startId, {
            ...options.start,
            onChange: (selectedDates, dateStr, instance) => {
                console.log(`시작일 변경: ${dateStr}`);
                
                // 종료일 최소값 설정
                if (selectedDates[0] && endPicker) {
                    endPicker.set('minDate', selectedDates[0]);
                    
                    // 종료일이 시작일보다 이르면 조정
                    const currentEndDate = endPicker.selectedDates[0];
                    if (currentEndDate && currentEndDate < selectedDates[0]) {
                        endPicker.setDate(selectedDates[0]);
                    }
                }
                
                // 사용자 콜백
                if (options.start?.onChange) {
                    options.start.onChange(selectedDates, dateStr, instance);
                }
            }
        });
        
        // 종료일 선택기
        endPicker = this.initDatePicker(endId, {
            ...options.end,
            onChange: (selectedDates, dateStr, instance) => {
                console.log(`종료일 변경: ${dateStr}`);
                
                // 종료일이 시작일보다 이른지 확인
                const startDate = startPicker?.selectedDates[0];
                if (startDate && selectedDates[0] && selectedDates[0] < startDate) {
                    alert('종료일은 시작일보다 늦어야 합니다.');
                    instance.setDate(startDate);
                    return;
                }
                
                // 사용자 콜백
                if (options.end?.onChange) {
                    options.end.onChange(selectedDates, dateStr, instance);
                }
            }
        });
        
        return { start: startPicker, end: endPicker };
    },

    // 중복 확인용 날짜 선택기
    initDuplicateCheckPickers() {
        console.log('중복 확인 날짜 선택기 초기화');
        return this.initRangePickers('check_start_date', 'check_end_date');
    },

    // 메인 폼용 날짜 선택기
    initCreateFormPickers() {
        console.log('메인 폼 날짜 선택기 초기화');
        const today = new Date();
        
        return this.initRangePickers('start_date', 'end_date', {
            start: { defaultDate: today },
            end: { defaultDate: today }
        });
    },

    // 날짜 검증
    validateDateRange(startId, endId) {
        const startValue = document.getElementById(startId)?.value?.trim();
        const endValue = document.getElementById(endId)?.value?.trim();
        
        if (!startValue || !endValue) {
            return { valid: false, message: '시작일과 종료일을 모두 입력해주세요.' };
        }
        
        const startDate = new Date(startValue);
        const endDate = new Date(endValue);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return { valid: false, message: '올바른 날짜 형식이 아닙니다.' };
        }
        
        if (startDate > endDate) {
            return { valid: false, message: '종료일은 시작일보다 늦어야 합니다.' };
        }
        
        return { valid: true };
    },

    // 즉시 모든 날짜 필드 활성화 (강제)
    forceEnableAllDateFields() {
        const dateFieldIds = ['check_start_date', 'check_end_date', 'start_date', 'end_date'];
        
        dateFieldIds.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                // 강제 활성화
                element.disabled = false;
                element.readOnly = false;
                element.removeAttribute('disabled');
                element.removeAttribute('readonly');
                element.style.pointerEvents = 'auto';
                element.style.backgroundColor = 'white';
                element.style.cursor = 'text';
                element.style.opacity = '1';
                
                // 자동 하이픈 기능 추가
                this.addAutoHyphen(element);
                
            }
        });
        
    },

    // 디버깅 정보
    debug() {
        const dateFields = ['check_start_date', 'check_end_date', 'start_date', 'end_date'];
        
        console.log('=== 날짜 필드 상태 ===');
        dateFields.forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el) {
                console.log(`${fieldId}:`, {
                    disabled: el.disabled,
                    readOnly: el.readOnly,
                    value: el.value,
                    style: el.style.cssText
                });
            } else {
                console.log(`${fieldId}: 요소 없음`);
            }
        });
        
    }
};

// 즉시 실행 함수 - 페이지 로드 시 모든 날짜 필드 활성화
(function() {
    function enableDatesOnLoad() {
        if (window.DdoksangDateUtils) {
            window.DdoksangDateUtils.forceEnableAllDateFields();
            
            // flatpickr가 있으면 초기화
            if (typeof flatpickr !== 'undefined') {
                setTimeout(() => {
                    window.DdoksangDateUtils.initDuplicateCheckPickers();
                    window.DdoksangDateUtils.initCreateFormPickers();
                }, 500);
            }
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enableDatesOnLoad);
    } else {
        enableDatesOnLoad();
    }
})();

