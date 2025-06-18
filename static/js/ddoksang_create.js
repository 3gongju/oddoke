// ddoksang_create.js - 중복 확인 버튼 문제 해결

// 새로운 이미지 업로드 모듈 import
// import { setupDdoksangImageUpload } from './ddoksang_image_upload.js';

// 단계별 검증 규칙
const stepValidationRules = {
    1: ['final_artist_id'],
    2: ['cafe_name', 'address', 'latitude', 'longitude'],
    3: ['start_date', 'end_date'],
    4: ['event_description'],
    5: [], // 선택사항
    6: ['images'] // 이미지 검증은 별도 처리
};

// ✅ 메시지 시스템 개선
function getMsg(category, key, params = {}) {
    try {
        if (!window.DDOKSANG_MESSAGES || !window.DDOKSANG_MESSAGES[category] || !window.DDOKSANG_MESSAGES[category][key]) {
            console.warn(`메시지를 찾을 수 없음: ${category}.${key}`);
            return `${category}.${key}`;
        }
        
        let message = window.DDOKSANG_MESSAGES[category][key];
        
        // 파라미터 치환
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([paramKey, value]) => {
                message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), value);
            });
        }
        
        return message;
    } catch (error) {
        console.error('메시지 처리 오류:', error);
        return `${category}.${key}`;
    }
}

// 전역 함수들 (HTML onclick 용)
window.clearSelection = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.setValue('artist-member-search', '');
    FormUtils.setValue('check_artist_id', '');
    FormUtils.setValue('check_member_id', '');
    FormUtils.toggleClass('selected-artist', 'hidden', true);
    FormUtils.toggleClass('duplicate-warning', 'hidden', true);
    FormUtils.toggleClass('duplicate-success', 'hidden', true);
    
    if (window.ddoksangApp) {
        window.ddoksangApp.duplicateChecked = false;
        window.ddoksangApp.isDuplicate = false;
    }
    
    if (window.updateDuplicateButtonState) window.updateDuplicateButtonState();
};

window.useSelectedArtist = function() {
    const FormUtils = window.DdoksangFormUtils;
    
    // ✅ 중복 확인에서 입력한 모든 정보를 복사
    FormUtils.setValue('final_artist_id', FormUtils.getValue('check_artist_id'));
    FormUtils.setValue('final_member_id', FormUtils.getValue('check_member_id'));
    
    // ✅ 중복 확인에서 입력한 카페명, 기간 정보도 복사
    FormUtils.setValue('cafe_name', FormUtils.getValue('check_cafe_name'));
    FormUtils.setValue('start_date', FormUtils.getValue('check_start_date'));
    FormUtils.setValue('end_date', FormUtils.getValue('check_end_date'));
    
    setTimeout(() => window.ddoksangApp?.moveToStep(2), 300);
};

window.showArtistSearch = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.toggleClass('step1-confirm-mode', 'hidden', true);
    FormUtils.toggleClass('step1-search-mode', 'hidden', false);
    document.getElementById('final-artist-member-search')?.focus();
    window.ddoksangApp?.updateNextButtonState();
};

window.cancelArtistSearch = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.toggleClass('step1-search-mode', 'hidden', true);
    FormUtils.toggleClass('step1-confirm-mode', 'hidden', false);
    window.ddoksangApp?.updateNextButtonState();
};

window.confirmNewArtist = function() {
    const finalArtistId = window.DdoksangFormUtils.getValue('final_artist_id');
    if (!finalArtistId) {
        window.DdoksangFormUtils.showToast(getMsg('FORM_VALIDATION', 'REQUIRED_FIELD', {field: '아티스트'}), 'warning');
        return;
    }
    setTimeout(() => window.ddoksangApp?.moveToStep(2), 300);
};

window.clearFinalSelection = function() {
    const FormUtils = window.DdoksangFormUtils;
    FormUtils.setValue('final-artist-member-search', '');
    FormUtils.setValue('final_artist_id', '');
    FormUtils.setValue('final_member_id', '');
    FormUtils.toggleClass('final-selected-artist', 'hidden', true);
    FormUtils.updateButtonState('confirm-new-artist-btn', false);
    window.ddoksangApp?.updateNextButtonState();
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 덕생 등록 페이지 초기화');
    
    // 의존성 확인
    const { DdoksangFormUtils: FormUtils, DdoksangMapUtils: MapUtils } = window;
    if (!FormUtils || !MapUtils) {
        console.error('❌ 필수 유틸리티 모듈 누락');
        return;
    }

    // DOM 요소
    const steps = document.querySelectorAll(".step");
    const progressBar = document.getElementById("progressBar");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const totalSteps = steps.length;
    
    // 상태 변수
    let currentStep = 0;
    let duplicateChecked = false;
    let isDuplicate = false;
    let imageUploadModule = null;

    // 전역 앱 객체
    window.ddoksangApp = {
        currentStep: 0,
        duplicateChecked: false,
        isDuplicate: false,
        moveToStep: (step) => { currentStep = step; showStep(step); },
        updateNextButtonState,
        imageUploadModule: null
    };

    document.addEventListener('DOMContentLoaded', function () {
        init();  // DOM이 다 준비된 다음 안전하게 실행
    });

    function init() {
        setupEventListeners();
        initializeDatePickers();
        initializeAutocomplete();
        initializeImageUpload();
        initializeMapSearch();
        initializeFormSubmit();
        initDuplicateChecker();
        showStep(0);
    }

    function setupEventListeners() {
        nextBtn?.addEventListener("click", () => moveStep(1));
        prevBtn?.addEventListener("click", () => moveStep(-1));
    }

    function showStep(index) {
        currentStep = index;
        window.ddoksangApp.currentStep = index;
        
        steps.forEach((step, i) => step.classList.toggle("hidden", i !== index));
        if (progressBar) progressBar.style.width = `${(index / (totalSteps - 1)) * 100}%`;
        
        updateNavigationButtons(index);
        addStepValidationListeners(index);
        
        // 🔧 스텝 변경 후 검증 실행을 지연시켜 DOM이 완전히 업데이트되도록 함
        setTimeout(() => {
            updateNextButtonState();
        }, 100);

        if (index === 2 && !MapUtils.map) {
            setTimeout(() => MapUtils.initMap(), 100);
        }
        
        // 🔧 Step 6 진입 시 이미지 업로더 연동 강화
        if (index === 6) {
            console.log('📸 Step 6 진입 - 이미지 업로더 상태 확인');
            setTimeout(() => {
                setupImageUploadConnection();
                updateNextButtonState();
            }, 200);
        }
    }

    // 🔧 이미지 업로더 연동 함수 추가
    function setupImageUploadConnection() {
        console.log('🔗 이미지 업로더 연동 설정 시작');
        
        // window.ddoksangImageUploader가 있는지 확인
        if (window.ddoksangImageUploader?.isInitialized) {
            console.log('✅ 글로벌 이미지 업로더 발견');
            window.ddoksangApp.imageUploadModule = window.ddoksangImageUploader;
            
            // 검증 콜백 설정
            const originalTriggerValidation = window.ddoksangImageUploader.triggerValidation;
            if (originalTriggerValidation) {
                window.ddoksangImageUploader.triggerValidation = function() {
                    console.log('📸 이미지 업로더에서 검증 요청');
                    setTimeout(() => {
                        window.ddoksangApp.updateNextButtonState();
                    }, 50);
                };
            }
        } else if (imageUploadModule?.isInitialized) {
            console.log('✅ 로컬 이미지 업로더 사용');
            window.ddoksangApp.imageUploadModule = imageUploadModule;
        } else {
            console.warn('⚠️ 이미지 업로더를 찾을 수 없음');
        }
    }

    // ✅ updateNavigationButtons 함수 수정 (텍스트 대신 기호 유지)
    function updateNavigationButtons(index) {
        const isFirstStep = index === 0;
        const isLastStep = index === totalSteps - 1;

        if (isFirstStep) {
            prevBtn?.classList.add("hidden");
            nextBtn?.classList.add("hidden");
        } else {
            prevBtn?.classList.remove("hidden");
            nextBtn?.classList.remove("hidden");
            
            // ✅ 기호 유지하고 마지막 단계에서만 텍스트 변경
            if (nextBtn) {
                if (isLastStep) {
                    nextBtn.innerHTML = '제출';
                    nextBtn.style.fontSize = '14px';
                    nextBtn.style.fontWeight = '600';
                } else {
                    nextBtn.innerHTML = '›';
                    nextBtn.style.fontSize = '24px';
                    nextBtn.style.fontWeight = 'bold';
                }
            }
            
            FormUtils.updateButtonState('prevBtn', true);
        }
    }

    function moveStep(direction) {
        if (direction === -1) {
            if (currentStep === 1) {
                FormUtils.showToast(getMsg('DUPLICATE_CHECK', 'BACK_TO_DUPLICATE_CHECK'), 'info');
                resetDuplicateCheck();
                showStep(0);
                return;
            } else if (currentStep > 1) {
                showStep(currentStep - 1);
                return;
            }
        }

        if (direction === 1) {
            if (currentStep === 0) {
                if (!duplicateChecked || isDuplicate) {
                    FormUtils.showToast(isDuplicate ? 
                        getMsg('DUPLICATE_CHECK', 'DUPLICATE_WARNING') : 
                        getMsg('DUPLICATE_CHECK', 'CHECK_REQUIRED'), 'warning');
                    return;
                }
                setupStep1Preview();
            }

            if (!validateCurrentStep()) return;

            if (currentStep + direction === 2) {
                // ✅ copyDataToForm() 제거 - 이제 useSelectedArtist()에서 처리
                // copyDataToForm();
            }

            if (currentStep === totalSteps - 1) {
                showSubmitConfirmModal();
                return;
            }

            showStep(currentStep + 1);
        }
    }

    function validateCurrentStep() {
        const rules = stepValidationRules[currentStep];
        if (!rules) return true;

        const normalFields = rules.filter(field => field !== 'images');
        if (normalFields.length > 0) {
            const validation = FormUtils.validateRequired(normalFields);
            if (!validation.valid) {
                const fieldLabel = getFieldLabel(validation.field);
                FormUtils.showToast(`${fieldLabel}을(를) 입력해주세요.`, 'warning');
                return false;
            }
        }

        if (rules.includes('images')) {
            // 🔧 이미지 검증 개선
            let fileCount = 0;
            
            // 우선순위: 글로벌 업로더 > 로컬 업로더 > 직접 input 확인
            if (window.ddoksangImageUploader?.getFileCount) {
                fileCount = window.ddoksangImageUploader.getFileCount();
                console.log('📸 글로벌 업로더에서 파일 개수:', fileCount);
            } else if (imageUploadModule?.getFileCount) {
                fileCount = imageUploadModule.getFileCount();
                console.log('📸 로컬 업로더에서 파일 개수:', fileCount);
            } else {
                // 폴백: 직접 input 확인
                const fileInput = document.getElementById('image-upload');
                if (fileInput?.files) {
                    fileCount = fileInput.files.length;
                    console.log('📸 파일 input에서 파일 개수:', fileCount);
                }
            }
            
            if (fileCount === 0) {
                FormUtils.showToast('최소 1개의 이미지를 업로드해주세요.', 'warning');
                return false;
            }
        }

        if (currentStep === 3) {
            const dateValidation = FormUtils.validateDateRange('start_date', 'end_date');
            if (!dateValidation.valid) {
                FormUtils.showToast(dateValidation.message, 'warning');
                return false;
            }
        }

        return true;
    }

    function getFieldLabel(fieldId) {
        // ✅ messages.py에서 필드 라벨 가져오기
        const label = getMsg('FIELD_LABELS', fieldId);
        return label !== `FIELD_LABELS.${fieldId}` ? label : fieldId;
    }

    function addStepValidationListeners(stepIndex) {
        const stepElement = document.getElementById(`step-${stepIndex}`);
        if (!stepElement || stepElement.hasAttribute('data-listeners-added')) return;
        
        stepElement.setAttribute('data-listeners-added', 'true');
        
        stepValidationRules[stepIndex]?.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && fieldId !== 'images') {
                element.addEventListener('input', updateNextButtonState);
                element.addEventListener('change', updateNextButtonState);
            }
        });

        if (stepIndex === 2) {
            document.getElementById('place-search')?.addEventListener('input', updateNextButtonState);
        }
    }

    // 🔧 updateNextButtonState 함수 대폭 개선
    function updateNextButtonState() {
        if (!nextBtn || currentStep === 0) return;

        console.log(`🎯 Step ${currentStep} 검증 시작`);
        
        const rules = stepValidationRules[currentStep];
        let isValid = true;
        let buttonText = currentStep === totalSteps - 1 ? '제출하기' : '›';

        if (rules?.length > 0) {
            const normalFields = rules.filter(field => field !== 'images');
            if (normalFields.length > 0) {
                const validation = FormUtils.validateRequired(normalFields, false);
                console.log('🧪 필수 필드 유효성 결과:', validation);
                isValid = validation.valid;
            }

            // 🔧 이미지 검증 강화
            if (rules.includes('images')) {
                let fileCount = 0;
                
                // 다양한 방법으로 파일 개수 확인
                if (window.ddoksangImageUploader?.getFileCount) {
                    fileCount = window.ddoksangImageUploader.getFileCount();
                    console.log('📸 글로벌 업로더 파일 개수:', fileCount);
                } else if (window.ddoksangApp?.imageUploadModule?.getFileCount) {
                    fileCount = window.ddoksangApp.imageUploadModule.getFileCount();
                    console.log('📸 앱 업로더 파일 개수:', fileCount);
                } else if (imageUploadModule?.getFileCount) {
                    fileCount = imageUploadModule.getFileCount();
                    console.log('📸 로컬 업로더 파일 개수:', fileCount);
                } else {
                    // 폴백: DOM에서 직접 확인
                    const fileInput = document.getElementById('image-upload');
                    const previewItems = document.querySelectorAll('#image-preview-list > div:not([data-add-button])');
                    
                    if (fileInput?.files) {
                        fileCount = fileInput.files.length;
                    } else if (previewItems) {
                        fileCount = previewItems.length;
                    }
                    
                    console.log('📸 DOM에서 파일 개수:', fileCount);
                }
                
                console.log('🖼️ 최종 파일 개수:', fileCount);
                
                const imageValid = fileCount > 0;
                isValid = isValid && imageValid;
                
                // Step 6에서 이미지 개수에 따른 버튼 텍스트 변경
                if (currentStep === 6) {
                    buttonText = imageValid ? '제출하기' : '이미지를 업로드해주세요';
                }
            }
        }

        console.log('🚦 최종 검증 결과:', { 
            currentStep, 
            isValid, 
            buttonText,
            rules: rules?.join(', ') || 'none'
        });

        // 🔧 버튼 상태 업데이트 강화
        if (isValid) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.add('bg-gray-900', 'hover:bg-gray-800', 'text-white');
            
            // Step 6에서는 텍스트 업데이트
            if (currentStep === 6) {
                nextBtn.textContent = buttonText;
                nextBtn.style.fontSize = '14px';
                nextBtn.style.fontWeight = '600';
            }
            
            console.log('✅ 버튼 활성화:', buttonText);
        } else {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.remove('bg-gray-900', 'hover:bg-gray-800');
            
            // Step 6에서는 텍스트 업데이트
            if (currentStep === 6) {
                nextBtn.textContent = buttonText;
                nextBtn.style.fontSize = '14px';
                nextBtn.style.fontWeight = '600';
            }
            
            console.log('❌ 버튼 비활성화:', buttonText);
        }
    }

    function showSubmitConfirmModal() {
        const modalHTML = `
            <div id="submitConfirmModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                    <div class="text-center">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 mb-2">생카 등록 완료</h3>
                        <p class="text-gray-600 mb-6">모든 내용을 확인하셨나요?<br>등록하시겠습니까?</p>
                        <div class="flex gap-3">
                            <button id="cancelSubmit" class="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">취소</button>
                            <button id="confirmSubmit" class="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">등록하기</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('cancelSubmit').addEventListener('click', closeSubmitModal);
        document.getElementById('confirmSubmit').addEventListener('click', function() {
            closeSubmitModal();
            document.getElementById("multiStepForm")?.submit();
        });
        document.addEventListener('keydown', handleModalEscape);
    }

    function closeSubmitModal() {
        document.getElementById('submitConfirmModal')?.remove();
        document.removeEventListener('keydown', handleModalEscape);
    }

    function handleModalEscape(e) {
        if (e.key === 'Escape') closeSubmitModal();
    }

    function setupStep1Preview() {
        FormUtils.toggleClass('step1-confirm-mode', 'hidden', false);
        FormUtils.toggleClass('step1-search-mode', 'hidden', true);
    }

    function resetDuplicateCheck() {
        console.log('🔄 중복 확인 상태 초기화');
        
        duplicateChecked = false;
        isDuplicate = false;
        window.ddoksangApp.duplicateChecked = false;
        window.ddoksangApp.isDuplicate = false;
        
        const duplicateForm = document.getElementById('duplicate-check-form');
        const duplicateSection = document.getElementById('duplicate-cafes-section');
        const successMsg = document.getElementById('duplicate-success');
        const warningMsg = document.getElementById('duplicate-warning');
        
        if (duplicateForm) duplicateForm.style.display = 'block';
        
        const section = document.querySelector('section.max-w-4xl');
        if (section) {
            const title = section.querySelector('h1');
            const description = section.querySelector('p');
            const progressBar = section.querySelector('.w-full.bg-gray-200.rounded-full');
            
            if (title) title.style.display = 'block';
            if (description) description.style.display = 'block';
            if (progressBar) progressBar.style.display = 'block';
        }
        
        if (duplicateSection) duplicateSection.classList.add('hidden');
        if (successMsg) successMsg.classList.add('hidden');
        if (warningMsg) warningMsg.classList.add('hidden');
        
        FormUtils.setValue('selected_duplicate_cafe_id', '');
        
        if (window.updateDuplicateButtonState) {
            window.updateDuplicateButtonState();
        }
    }

    // === ✅ 개선된 중복 확인 로직 ===
    function initDuplicateChecker() {
        console.log('🔧 중복 확인 모듈 초기화 시작');
        
        const checkBtn = document.getElementById('check-duplicate-btn');
        if (!checkBtn) {
            console.error('❌ 중복 확인 버튼을 찾을 수 없습니다');
            return;
        }

        // ✅ 버튼 상태 업데이트 함수 (디버깅 강화)
    function updateDuplicateButtonState() {
        console.log('🔄 중복 확인 버튼 상태 업데이트');

        // ✅ 버튼을 명확히 지정
        const checkBtn = document.getElementById("check-duplicate-btn");
        if (!checkBtn) {
            console.warn("❗ check-duplicate-btn 버튼을 찾을 수 없습니다.");
            return;
        }

        const required = ['check_artist_id', 'check_cafe_name', 'check_start_date', 'check_end_date'];
        let isValid = true;
        const fieldValues = {};
        // ✅ 버튼 상태 업데이트
        checkBtn.disabled = !isValid;

        if (isValid) {
            // 활성화 스타일
            checkBtn.style.backgroundColor = '#111827';
            checkBtn.style.color = '#ffffff';
            checkBtn.style.cursor = 'pointer';
            checkBtn.className = checkBtn.className
                .replace(/bg-gray-\d+|text-gray-\d+|cursor-\w+|hover:bg-gray-\d+/g, '')
                .trim() + ' bg-gray-900 text-white hover:bg-gray-800';
            console.log('✅ 버튼 활성화');
        } else {
            // 비활성화 스타일
            checkBtn.style.backgroundColor = '#9ca3af';
            checkBtn.style.color = '#d1d5db';
            checkBtn.style.cursor = 'not-allowed';
            checkBtn.className = checkBtn.className
                .replace(/bg-gray-\d+|text-gray-\d+|cursor-\w+|hover:bg-gray-\d+/g, '')
                .trim() + ' bg-gray-400 text-gray-200 cursor-not-allowed';
            console.log('❌ 버튼 비활성화');
        }

        console.log(`🔘 최종 버튼 상태: ${isValid ? '활성화' : '비활성화'}`);
    }

        // ✅ 전역 함수로 등록
        window.updateDuplicateButtonState = updateDuplicateButtonState;

        // ✅ 이벤트 리스너 등록 (중복 방지 + 디버깅 강화)
        const eventFields = ['check_cafe_name', 'check_start_date', 'check_end_date'];
        
        eventFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                // 기존 이벤트 제거
                element.removeEventListener('input', updateDuplicateButtonState);
                element.removeEventListener('change', updateDuplicateButtonState);
                element.removeEventListener('keyup', updateDuplicateButtonState);
                
                // 새 이벤트 추가
                const eventHandler = (e) => {
                    console.log(`📝 ${fieldId} 이벤트 발생: "${e.target.value}"`);
                    setTimeout(() => updateDuplicateButtonState(), 50);
                };
                
                element.addEventListener('input', eventHandler);
                element.addEventListener('change', eventHandler);
                element.addEventListener('keyup', eventHandler);
                
                console.log(`✅ ${fieldId} 이벤트 리스너 등록 완료`);
            } else {
                console.warn(`⚠️ ${fieldId} 요소를 찾을 수 없습니다`);
            }
        });

        // ✅ 중복 확인 버튼 클릭 이벤트 등록
        checkBtn.removeEventListener('click', performDuplicateCheck);
        checkBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🚀 중복 확인 버튼 클릭됨');
            
            if (!checkBtn.disabled) {
                performDuplicateCheck();
            } else {
                console.warn('⚠️ 버튼이 비활성화 상태입니다');
            }
        });

        // ✅ 중복 선택 버튼들 설정
        setupDuplicateSelectionButtons();
        
        // ✅ 초기 상태 설정
        setTimeout(() => {
            updateDuplicateButtonState();
            console.log('🎉 중복 확인 모듈 초기화 완료');
        }, 100);
    }

    // ✅ 개선된 중복 확인 실행 함수
    async function performDuplicateCheck() {
    console.log('🚀 중복 확인 실행 시작');
    
    const checkBtn = document.getElementById('check-duplicate-btn');
    
    // 버튼이 disabled 상태인지 확인
    if (checkBtn.disabled) {
        console.warn('⚠️ 버튼이 비활성화 상태입니다');
        return;
    }

    const data = {
        artist_id: FormUtils.getValue('check_artist_id'),
        member_id: FormUtils.getValue('check_member_id'),
        cafe_name: FormUtils.getValue('check_cafe_name'),
        start_date: FormUtils.getValue('check_start_date'),
        end_date: FormUtils.getValue('check_end_date')
    };

    console.log('📊 요청 데이터:', data);

    // 필수 필드 재검증
    if (!data.artist_id || !data.cafe_name || !data.start_date || !data.end_date) {
        // ✅ messages.py의 VALIDATION_ERROR 메시지 사용
        const message = window.msg('DUPLICATE_CHECK', 'VALIDATION_ERROR');
        FormUtils.showToast(message, 'warning');
        console.error('❌ 필수 필드 누락:', data);
        return;
    }

    // 버튼 로딩 상태 설정
    const originalText = checkBtn.textContent;
    const originalDisabled = checkBtn.disabled;
    
    checkBtn.disabled = true;
    checkBtn.textContent = '확인 중...';
    checkBtn.className = checkBtn.className
        .replace(/bg-gray-\d+|hover:bg-gray-\d+/g, '')
        + ' bg-gray-600';

    try {
        const url = `/ddoksang/cafe/check-duplicate/?` + 
            Object.entries(data)
                .filter(([k, v]) => v) // 빈 값 제외
                .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                .join('&');
        
        console.log('🌐 요청 URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('📥 응답 데이터:', result);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        handleDuplicateCheckResult(result);
        
    } catch (error) {
        console.error('❌ 중복 확인 오류:', error);
        // ✅ messages.py의 SERVER_ERROR 메시지 사용
        const message = window.msg('DUPLICATE_CHECK', 'SERVER_ERROR');
        FormUtils.showToast(message, 'error');
        
        // 오류 시 폼 숨기기 및 오류 메시지 표시
        hideDuplicateCheckForm();
        showErrorMessage(error.message);
        
    } finally {
        // 버튼 상태 복원
        checkBtn.disabled = originalDisabled;
        checkBtn.textContent = originalText;
        
        // 버튼 스타일 복원
        if (window.updateDuplicateButtonState) {
            window.updateDuplicateButtonState();
        }
        
        console.log('🔄 중복 확인 완료 - 버튼 상태 복원');
    }
    }

    function handleDuplicateCheckResult(result) {
        duplicateChecked = true;
        isDuplicate = result.exists;
        
        window.ddoksangApp.duplicateChecked = duplicateChecked;
        window.ddoksangApp.isDuplicate = isDuplicate;

        hideDuplicateCheckForm();

        if (result.exists && result.similar_cafes?.length > 0) {
            showDuplicateCafes(result.similar_cafes);
            // ✅ messages.py의 DUPLICATE_FOUND 메시지 사용
            const message = window.msg('DUPLICATE_CHECK', 'DUPLICATE_FOUND', { count: result.similar_cafes.length });
            FormUtils.showToast(message, 'warning');
        } else {
            FormUtils.toggleClass('duplicate-success', 'hidden', false);
            // ✅ messages.py의 NO_DUPLICATE 메시지 사용
            const message = window.msg('DUPLICATE_CHECK', 'NO_DUPLICATE');
            FormUtils.showToast(message, 'success');
            setTimeout(() => showStep(1), 1500);
        }
    }

    function hideDuplicateCheckForm() {
        const form = document.getElementById('duplicate-check-form');
        if (form) form.style.display = 'none';
        
        const section = document.querySelector('section.max-w-4xl');
        if (section) {
            const title = section.querySelector('h1');
            const description = section.querySelector('p');
            const progressBar = section.querySelector('.w-full.bg-gray-200.rounded-full');
            
            if (title) title.style.display = 'none';
            if (description) description.style.display = 'none';
            if (progressBar) progressBar.style.display = 'none';
        }
    }

    function showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mt-6 p-4 border rounded bg-red-50 border-red-200';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <svg class="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <div>
                    <span class="font-medium text-red-800">오류가 발생했습니다</span>
                    <p class="text-sm text-red-600 mt-1">${message}</p>
                    <button type="button" onclick="location.reload()" class="mt-2 text-sm text-red-600 underline hover:text-red-800">다시 시도하기</button>
                </div>
            </div>
        `;
        document.getElementById('step-0')?.appendChild(errorDiv);
    }

    function showDuplicateCafes(cafes) {
        const section = document.getElementById('duplicate-cafes-section');
        const grid = document.getElementById('duplicate-cafes-grid');
        if (!section || !grid) return;
        
        grid.innerHTML = '';
        cafes.forEach(cafe => {
            const cardElement = createDuplicateCafeCard(cafe);
            grid.appendChild(cardElement);
        });
        section.classList.remove('hidden');
    }

    function createDuplicateCafeCard(cafe) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'duplicate-cafe-card relative w-full max-w-sm mx-auto mb-6';
        cardDiv.dataset.cafeId = cafe.id;
        
        let statusBadge = '';
        let statusClass = '';
        if (cafe.cafe_state === 'ongoing') {
            statusBadge = '운영중'; statusClass = 'bg-green-500';
        } else if (cafe.cafe_state === 'upcoming') {
            statusBadge = '예정'; statusClass = 'bg-blue-500';
        } else {
            statusBadge = '종료'; statusClass = 'bg-gray-500';
        }
        
        let daysInfo = '';
        if (cafe.days_until_start && cafe.days_until_start <= 7) {
            daysInfo = `<span class="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">시작 D-${cafe.days_until_start}</span>`;
        } else if (cafe.days_remaining && cafe.days_remaining <= 7) {
            daysInfo = `<span class="text-red-600 font-medium text-xs bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">종료 D-${cafe.days_remaining}</span>`;
        }
        
        cardDiv.innerHTML = `
            <div class="relative overflow-hidden rounded-2xl border border-gray-200 transition-all duration-300 h-80 bg-white shadow-sm">
                ${cafe.cafe_state === 'ended' ? '<div class="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px] z-30 rounded-2xl pointer-events-none"></div>' : ''}
                
                <div class="selected-indicator absolute top-3 left-3 z-40 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                
                <div class="relative h-48">
                    ${cafe.main_image ? 
                        `<img src="${cafe.main_image}" alt="${cafe.cafe_name}" class="w-full h-full object-cover" loading="lazy">` :
                        `<div class="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                            <span class="text-pink-400 text-4xl">🎂</span>
                        </div>`
                    }
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-0"></div>
                    <div class="absolute -bottom-3 right-3 z-40">
                        <span class="${statusClass} text-white text-xs font-medium px-2 py-1 rounded-full">${statusBadge}</span>
                    </div>
                </div>
                
                <div class="bg-white p-4 h-32 flex flex-col justify-between">
                    <div class="flex-1 space-y-1">
                        <p class="text-sm text-gray-600 truncate leading-tight">
                            ${cafe.member_name ? `${cafe.member_name} (${cafe.artist_name})` : cafe.artist_name}
                        </p>
                        <p class="text-base font-semibold text-gray-900 line-clamp-2 leading-tight">
                            ${cafe.cafe_name}
                        </p>
                    </div>
                    <div class="mb-2">
                        <p class="text-xs text-gray-600 truncate">📍 ${cafe.place_name}</p>
                    </div>
                    <div class="flex items-center justify-between text-sm text-gray-600 mt-auto">
                        <span class="truncate">${cafe.start_date} - ${cafe.end_date}</span>
                        ${daysInfo}
                    </div>
                </div>
            </div>
        `;
        
        cardDiv.addEventListener('click', () => selectDuplicateCafe(cafe.id, cardDiv));
        return cardDiv;
    }

    function selectDuplicateCafe(cafeId, cardElement) {
        document.querySelectorAll('.duplicate-cafe-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        cardElement.classList.add('selected');
        FormUtils.setValue('selected_duplicate_cafe_id', cafeId);
        FormUtils.toggleClass('select-cafe-instruction', 'hidden', false);
    }

    function setupDuplicateSelectionButtons() {
        document.getElementById('confirm-duplicate-btn')?.addEventListener('click', () => {
            const selectedCafeId = FormUtils.getValue('selected_duplicate_cafe_id');
            if (!selectedCafeId) {
                FormUtils.showToast(getMsg('DUPLICATE_CHECK', 'SELECT_CAFE_FIRST'), 'warning');
                FormUtils.toggleClass('select-cafe-instruction', 'hidden', false);
                return;
            }
            
            FormUtils.showToast(getMsg('DUPLICATE_CHECK', 'REDIRECTING_TO_CAFE'), 'info');
            setTimeout(() => {
                window.location.href = `/ddoksang/cafe/${selectedCafeId}/`;
            }, 1000);
        });
        
        document.getElementById('deny-duplicate-btn')?.addEventListener('click', () => {
            duplicateChecked = true;
            isDuplicate = false;
            window.ddoksangApp.duplicateChecked = duplicateChecked;
            window.ddoksangApp.isDuplicate = isDuplicate;
            
            FormUtils.showToast(getMsg('DUPLICATE_CHECK', 'REGISTER_NEW_CAFE'), 'success');
            setTimeout(() => showStep(1), 1000);
        });
    }

    // ✅ 날짜 선택기 초기화 (콜백 강화)
    function initializeDatePickers() {
        if (typeof flatpickr === 'undefined') {
            console.warn('⚠️ flatpickr 라이브러리가 로드되지 않았습니다');
            return;
        }

        // ✅ 중복 확인용 날짜 선택기 (상태 업데이트 콜백 포함)
        if (window.DdoksangDateUtils?.initDuplicateCheckPickers) {
            const duplicatePickers = window.DdoksangDateUtils.initDuplicateCheckPickers(() => {
                console.log('📅 중복 확인 날짜 변경됨 - 버튼 상태 업데이트');
                setTimeout(() => {
                    if (window.updateDuplicateButtonState) {
                        window.updateDuplicateButtonState();
                    }
                }, 100);
            });
            
            if (duplicatePickers.start && duplicatePickers.end) {
                console.log('✅ 중복 확인 날짜 선택기 초기화 완료');
            } else {
                console.error('❌ 중복 확인 날짜 선택기 초기화 실패');
            }
        }

        // ✅ 메인 폼용 날짜 선택기 (상태 업데이트 콜백 포함)
        if (window.DdoksangDateUtils?.initCreateFormPickers) {
            const formPickers = window.DdoksangDateUtils.initCreateFormPickers(() => {
                console.log('📅 메인 폼 날짜 변경됨 - 버튼 상태 업데이트');
                setTimeout(() => updateNextButtonState(), 100);
            });
            
            if (formPickers.start && formPickers.end) {
                console.log('✅ 메인 폼 날짜 선택기 초기화 완료');
            } else {
                console.error('❌ 메인 폼 날짜 선택기 초기화 실패');
            }
        }
    }

    function initializeAutocomplete() {
        if (typeof initAutocomplete !== 'function') return;

        const autocompleteConfig = {
            showBirthday: true,
            showArtistTag: false,
            submitOnSelect: false,
            artistOnly: false,
            apiUrl: '/artist/autocomplete/'
        };

        initAutocomplete('artist-member-search', 'artist-member-results', {
            ...autocompleteConfig,
            onSelect: (result) => selectArtist(result, 'check')
        });

        initAutocomplete('final-artist-member-search', 'final-artist-member-results', {
            ...autocompleteConfig,
            onSelect: (result) => selectFinalArtist(result)
        });
    }

    function selectArtist(result, prefix = '') {
        document.getElementById(`${prefix}_artist_id`).value = result.artist_id;
        document.getElementById(`${prefix}_member_id`).value = result.member_id;

        const selectedText = result.member_name
            ? `${result.artist_name} - ${result.member_name}`
            : result.artist_name;

        const selectedArtistDiv = document.getElementById(`${prefix}_selected-artist`);
        const selectedTextSpan = document.getElementById(`${prefix}_selected-artist-text`);
        const searchInput = document.getElementById(`${prefix}_artist-member-search`);

        searchInput.classList.add('hidden');
        selectedArtistDiv.classList.remove('hidden');
        selectedTextSpan.textContent = selectedText;

        // ✅ 중복 확인 스텝일 경우 버튼 상태 업데이트 수동 호출
        if (prefix === 'check' && typeof window.updateDuplicateButtonState === 'function') {
            window.updateDuplicateButtonState();
        }
    }


    function selectFinalArtist(result) {
        const data = FormUtils.normalizeArtistData({
            member_name: result.name,
            artist_display: result.artist || result.artist_name,
            artist_id: result.artist_id,
            member_id: result.id || result.member_id
        });

        FormUtils.setValue('final_artist_id', data.artistId);
        FormUtils.setValue('final_member_id', data.memberId);
        FormUtils.setValue('final-artist-member-search', data.displayText);
        FormUtils.setText('final-selected-artist-text', `✓ ${data.displayText} 선택됨`);
        
        FormUtils.toggleClass('final-artist-member-results', 'hidden', true);
        FormUtils.toggleClass('final-selected-artist', 'hidden', false);
        FormUtils.updateButtonState('confirm-new-artist-btn', true);
        updateNextButtonState();
    }

    // 🔧 이미지 업로드 초기화 함수 개선
    function initializeImageUpload() {
        console.log('📸 이미지 업로드 모듈 초기화 시작');
        
        const imageContainer = document.getElementById('image-upload-container');
        if (!imageContainer) {
            console.warn('⚠️ 이미지 컨테이너를 찾을 수 없음');
            return;
        }

        // 글로벌 이미지 업로더가 이미 있는지 확인
        if (window.ddoksangImageUploader?.isInitialized) {
            console.log('✅ 글로벌 이미지 업로더 사용');
            imageUploadModule = window.ddoksangImageUploader;
            window.ddoksangApp.imageUploadModule = imageUploadModule;
            
            // 검증 콜백 연결
            const originalTriggerValidation = imageUploadModule.triggerValidation;
            if (originalTriggerValidation) {
                imageUploadModule.triggerValidation = function() {
                    console.log('📸 이미지 업로더에서 검증 요청');
                    setTimeout(() => {
                        window.ddoksangApp.updateNextButtonState();
                    }, 50);
                };
            }
            
            return;
        }

        // 새로운 이미지 업로더 생성
        if (window.setupDdoksangImageUpload) {
            try {
                imageUploadModule = window.setupDdoksangImageUpload({
                    fileInputId: "image-upload",
                    fileCountId: "file-count", 
                    previewContainerId: "image-upload-container",
                    previewListId: "image-preview-list",
                    formId: "multiStepForm",
                    maxFiles: 10,
                    maxSizeMB: 5
                });
                
                if (imageUploadModule?.isInitialized) {
                    window.ddoksangApp.imageUploadModule = imageUploadModule;
                    console.log('✅ 이미지 업로드 모듈 초기화 완료');
                    
                    // 검증 콜백 연결
                    const originalTriggerValidation = imageUploadModule.triggerValidation;
                    if (originalTriggerValidation) {
                        imageUploadModule.triggerValidation = function() {
                            console.log('📸 이미지 업로더에서 검증 요청');
                            setTimeout(() => {
                                window.ddoksangApp.updateNextButtonState();
                            }, 50);
                        };
                    }
                } else {
                    console.error('❌ 이미지 업로드 모듈 초기화 실패');
                }
            } catch (error) {
                console.error('❌ 이미지 업로드 모듈 초기화 중 오류:', error);
            }
        } else {
            console.error('❌ setupDdoksangImageUpload 함수를 찾을 수 없음');
        }
    }

    function initializeMapSearch() {
        const searchBtn = document.getElementById("searchBtn");
        const placeInput = document.getElementById("place-search");

        searchBtn?.addEventListener('click', searchPlace);
        placeInput?.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchPlace();
            }
        });
    }

    function searchPlace() {
        const keyword = FormUtils.getValue('place-search');
        if (!keyword) {
            FormUtils.showToast(getMsg('FORM_VALIDATION', 'SEARCH_KEYWORD_REQUIRED'), 'warning');
            return;
        }

        if (!MapUtils.map) MapUtils.initMap();

        MapUtils.searchPlaces(keyword, (success, data) => {
            const results = document.getElementById('place-results');
            if (!results) return;
            
            if (success) {
                results.innerHTML = '';
                results.classList.remove('hidden');
                
                data.forEach(place => {
                    const li = document.createElement('li');
                    li.textContent = `${place.place_name} (${place.road_address_name || place.address_name})`;
                    li.className = 'px-4 py-2 cursor-pointer hover:bg-gray-100 border-b last:border-none text-sm';
                    li.addEventListener('click', () => selectPlace(place));
                    results.appendChild(li);
                });
            } else {
                results.innerHTML = '<li class="px-4 py-2 text-red-500 text-sm">검색 결과가 없습니다.</li>';
                results.classList.remove('hidden');
            }
        });
    }

    function selectPlace(place) {
        MapUtils.selectPlace(place);
        
        const selectedPlace = document.getElementById('selected-place');
        if (selectedPlace) {
            selectedPlace.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium text-green-800">${place.place_name}</p>
                        <p class="text-sm text-green-600">${place.road_address_name || place.address_name}</p>
                    </div>
                    <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                </div>`;
            selectedPlace.classList.remove('hidden');
        }

        FormUtils.toggleClass('place-results', 'hidden', true);
        updateNextButtonState();
    }

    function initializeFormSubmit() {
        const form = document.getElementById('multiStepForm');
        if (!form) return;
        
        form.addEventListener('submit', function(e) {
            // 폼 제출 시 모든 입력 필드 활성화 (disabled 해제)
            this.querySelectorAll('input, textarea, select').forEach(input => {
                input.disabled = false;
            });

            // X(트위터) 소스 URL 처리
            const xUsername = FormUtils.getValue('x_username');
            if (xUsername) {
                const xInput = document.createElement('input');
                xInput.type = 'hidden';
                xInput.name = 'x_source';
                xInput.value = `https://x.com/${xUsername.replace('@', '')}`;
                this.appendChild(xInput);
            }
        });
    }

    // ✅ 디버깅용 헬퍼 함수 (개발 환경에서 사용)
    function debugDuplicateCheckState() {
        console.log('🔍 중복 확인 상태 디버깅:');
        
        const required = ['check_artist_id', 'check_cafe_name', 'check_start_date', 'check_end_date'];
        const checkBtn = document.getElementById('check-duplicate-btn');
        
        console.log('필수 필드 값들:');
        required.forEach(id => {
            const element = document.getElementById(id);
            const value = element ? element.value.trim() : 'ELEMENT_NOT_FOUND';
            console.log(`  ${id}: "${value}"`);
        });
        
        if (checkBtn) {
            console.log('버튼 상태:');
            console.log(`  disabled: ${checkBtn.disabled}`);
            console.log(`  className: "${checkBtn.className}"`);
            console.log(`  textContent: "${checkBtn.textContent}"`);
        } else {
            console.log('❌ 중복 확인 버튼을 찾을 수 없습니다');
        }
        
        console.log('전역 함수 상태:');
        console.log(`  window.updateDuplicateButtonState: ${typeof window.updateDuplicateButtonState}`);
    }

    // 🔧 이미지 검증 디버깅 함수 추가
    function debugImageValidation() {
        console.log('🔍 이미지 검증 상태 디버깅:');
        
        const checkers = [
            {
                name: 'window.ddoksangImageUploader',
                obj: window.ddoksangImageUploader,
                getCount: () => window.ddoksangImageUploader?.getFileCount?.()
            },
            {
                name: 'window.ddoksangApp.imageUploadModule',
                obj: window.ddoksangApp?.imageUploadModule,
                getCount: () => window.ddoksangApp?.imageUploadModule?.getFileCount?.()
            },
            {
                name: 'imageUploadModule (로컬)',
                obj: imageUploadModule,
                getCount: () => imageUploadModule?.getFileCount?.()
            },
            {
                name: 'DOM 파일 input',
                obj: document.getElementById('image-upload'),
                getCount: () => document.getElementById('image-upload')?.files?.length
            },
            {
                name: 'DOM 미리보기 아이템',
                obj: document.querySelectorAll('#image-preview-list > div:not([data-add-button])'),
                getCount: () => document.querySelectorAll('#image-preview-list > div:not([data-add-button])').length
            }
        ];
        
        checkers.forEach(checker => {
            const exists = !!checker.obj;
            const count = exists ? checker.getCount() : 'N/A';
            console.log(`  ${checker.name}: 존재=${exists}, 파일수=${count}`);
        });
        
        console.log(`현재 스텝: ${currentStep}`);
        console.log(`다음 버튼 상태: disabled=${nextBtn?.disabled}, text="${nextBtn?.textContent}"`);
    }

    // ✅ 전역 디버깅 함수로 등록 (개발 환경에서만)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.debugDuplicateCheckState = debugDuplicateCheckState;
        window.debugImageValidation = debugImageValidation;
        
        // 전역 강제 검증 함수
        window.forceValidation = function() {
            console.log('🔧 강제 검증 실행');
            updateNextButtonState();
        };
        
        // ✅ 강제 중복 확인 버튼 상태 업데이트 함수
        window.forceUpdateDuplicateButton = function() {
            console.log('🔧 강제 중복 확인 버튼 상태 업데이트');
            if (window.updateDuplicateButtonState) {
                window.updateDuplicateButtonState();
            }
        };
    }

    // CSS 스타일 추가 (기존과 동일)
    const additionalCSS = `
        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .duplicate-cafe-card {
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            border: 2px solid transparent;
        }
        
        .duplicate-cafe-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        
        .duplicate-cafe-card.selected {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            transform: translateY(-2px);
        }
        
        .duplicate-cafe-card .selected-indicator {
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        
        .duplicate-cafe-card.selected .selected-indicator {
            opacity: 1;
        }
        
        #duplicate-cafes-grid {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
        }

        /* 중복 확인 버튼 스타일 강화 */
        #check-duplicate-btn {
            transition: all 0.2s ease-in-out;
            border: none;
            font-weight: 600;
            font-size: 0.875rem;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            min-height: 3rem;
        }
        
        #check-duplicate-btn:not([disabled]) {
            background-color: #111827 !important;
            color: #ffffff !important;
            cursor: pointer !important;
        }
        
        #check-duplicate-btn:not([disabled]):hover {
            background-color: #1f2937 !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        #check-duplicate-btn[disabled] {
            background-color: #9ca3af !important;
            color: #d1d5db !important;
            cursor: not-allowed !important;
            transform: none !important;
            box-shadow: none !important;
        }
        
        /* 로딩 상태 스타일 */
        #check-duplicate-btn.loading {
            background-color: #6b7280 !important;
            cursor: wait !important;
            position: relative;
        }
        
        #check-duplicate-btn.loading::after {
            content: '';
            position: absolute;
            right: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            width: 1rem;
            height: 1rem;
            border: 2px solid #ffffff;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
        }
    `;

    // 스타일 적용
    if (!document.querySelector('#duplicate-check-styles')) {
        const style = document.createElement('style');
        style.id = 'duplicate-check-styles';
        style.textContent = additionalCSS;
        document.head.appendChild(style);
    }
});