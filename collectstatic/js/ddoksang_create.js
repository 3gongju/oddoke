// 단계별 검증 규칙
const stepValidationRules = {
    1: ['final_artist_id'],
    2: ['cafe_name', 'address', 'latitude', 'longitude'],
    3: ['start_date', 'end_date'],
    4: ['event_description'],
    5: [], // 선택사항
    6: ['images'] // 이미지 검증은 별도 처리
};

// 메시지 시스템
function getMsg(category, key, params = {}) {
    try {
        if (!window.DDOKSANG_MESSAGES || !window.DDOKSANG_MESSAGES[category] || !window.DDOKSANG_MESSAGES[category][key]) {
            return `${category}.${key}`;
        }
        
        let message = window.DDOKSANG_MESSAGES[category][key];
        
        if (params && typeof params === 'object') {
            Object.entries(params).forEach(([paramKey, value]) => {
                message = message.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), value);
            });
        }
        
        return message;
    } catch (error) {
        return `${category}.${key}`;
    }
}

// 전역 함수들
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
    
    FormUtils.setValue('final_artist_id', FormUtils.getValue('check_artist_id'));
    FormUtils.setValue('final_member_id', FormUtils.getValue('check_member_id'));
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

window.proceedToNextStep = function() {
    const FormUtils = window.DdoksangFormUtils;
    if (FormUtils) {
        FormUtils.setValue('final_artist_id', FormUtils.getValue('check_artist_id'));
        FormUtils.setValue('final_member_id', FormUtils.getValue('check_member_id'));
        FormUtils.setValue('cafe_name', FormUtils.getValue('check_cafe_name'));
        FormUtils.setValue('start_date', FormUtils.getValue('check_start_date'));
        FormUtils.setValue('end_date', FormUtils.getValue('check_end_date'));
    }
    
    if (window.ddoksangApp && window.ddoksangApp.moveToStep) {
        window.ddoksangApp.moveToStep(1);
    } else {
        showStep(1);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // 의존성 확인
    const { DdoksangFormUtils: FormUtils, DdoksangMapUtils: MapUtils } = window;
    if (!FormUtils || !MapUtils) {
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
        
        setTimeout(() => {
            updateNextButtonState();
        }, 100);

        if (index === 2 && !MapUtils.map) {
            setTimeout(() => MapUtils.initMap(), 100);
        }
        
        if (index === 6) {
            setTimeout(() => {
                setupImageUploadConnection();
                updateNextButtonState();
            }, 200);
        }
    }

    function setupImageUploadConnection() {
        if (window.ddoksangImageUploader?.isInitialized) {
            window.ddoksangApp.imageUploadModule = window.ddoksangImageUploader;
            
            const originalTriggerValidation = window.ddoksangImageUploader.triggerValidation;
            if (originalTriggerValidation) {
                window.ddoksangImageUploader.triggerValidation = function() {
                    setTimeout(() => {
                        window.ddoksangApp.updateNextButtonState();
                    }, 50);
                };
            }
        } else if (imageUploadModule?.isInitialized) {
            window.ddoksangApp.imageUploadModule = imageUploadModule;
        }
    }

    function updateNavigationButtons(index) {
        const isFirstStep = index === 0;
        const isLastStep = index === totalSteps - 1;

        if (isFirstStep) {
            prevBtn?.classList.add("hidden");
            nextBtn?.classList.add("hidden");
        } else {
            prevBtn?.classList.remove("hidden");
            nextBtn?.classList.remove("hidden");
            
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
            let fileCount = 0;
            
            if (window.ddoksangImageUploader?.getFileCount) {
                fileCount = window.ddoksangImageUploader.getFileCount();
            } else if (imageUploadModule?.getFileCount) {
                fileCount = imageUploadModule.getFileCount();
            } else {
                const fileInput = document.getElementById('image-upload');
                if (fileInput?.files) {
                    fileCount = fileInput.files.length;
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

    function updateNextButtonState() {
        if (!nextBtn || currentStep === 0) return;

        const rules = stepValidationRules[currentStep];
        let isValid = true;
        let buttonText = currentStep === totalSteps - 1 ? '제출하기' : '›';

        if (rules?.length > 0) {
            const normalFields = rules.filter(field => field !== 'images');
            if (normalFields.length > 0) {
                const validation = FormUtils.validateRequired(normalFields, false);
                isValid = validation.valid;
            }

            if (rules.includes('images')) {
                let fileCount = 0;
                
                if (window.ddoksangImageUploader?.getFileCount) {
                    fileCount = window.ddoksangImageUploader.getFileCount();
                } else if (window.ddoksangApp?.imageUploadModule?.getFileCount) {
                    fileCount = window.ddoksangApp.imageUploadModule.getFileCount();
                } else if (imageUploadModule?.getFileCount) {
                    fileCount = imageUploadModule.getFileCount();
                } else {
                    const fileInput = document.getElementById('image-upload');
                    const previewItems = document.querySelectorAll('#image-preview-list > div:not([data-add-button])');
                    
                    if (fileInput?.files) {
                        fileCount = fileInput.files.length;
                    } else if (previewItems) {
                        fileCount = previewItems.length;
                    }
                }
                
                const imageValid = fileCount > 0;
                isValid = isValid && imageValid;
                
                if (currentStep === 6) {
                    buttonText = imageValid ? '제출하기' : '이미지를 업로드해주세요';
                }
            }
        }

        if (isValid) {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.add('bg-gray-900', 'hover:bg-gray-800', 'text-white');
            
            if (currentStep === 6) {
                nextBtn.textContent = buttonText;
                nextBtn.style.fontSize = '14px';
                nextBtn.style.fontWeight = '600';
            }
        } else {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400');
            nextBtn.classList.remove('bg-gray-900', 'hover:bg-gray-800');
            
            if (currentStep === 6) {
                nextBtn.textContent = buttonText;
                nextBtn.style.fontSize = '14px';
                nextBtn.style.fontWeight = '600';
            }
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

    // === 수정된 중복 확인 로직 ===
    // ddoksang_create.js에서 initDuplicateChecker 함수만 교체

    function initDuplicateChecker() {
        const checkBtn = document.getElementById('check-duplicate-btn');
        if (!checkBtn) {
            console.error('중복 확인 버튼을 찾을 수 없습니다');
            return;
        }

        console.log('중복 확인 모듈 초기화 시작');

        // 버튼 상태 업데이트 함수 (간소화)
        function updateDuplicateButtonState() {
            const artistId = document.getElementById('check_artist_id')?.value?.trim() || '';
            const cafeName = document.getElementById('check_cafe_name')?.value?.trim() || '';
            const startDate = document.getElementById('check_start_date')?.value?.trim() || '';
            const endDate = document.getElementById('check_end_date')?.value?.trim() || '';

            const isValid = artistId && cafeName && startDate && endDate;

            console.log('버튼 상태 업데이트:', {
                artistId: !!artistId,
                cafeName: !!cafeName,
                startDate: !!startDate,
                endDate: !!endDate,
                isValid: isValid
            });

            // 직접적인 스타일 변경
            if (isValid) {
                checkBtn.disabled = false;
                checkBtn.style.backgroundColor = '#111827';
                checkBtn.style.color = '#ffffff';
                checkBtn.style.cursor = 'pointer';
                checkBtn.style.pointerEvents = 'auto';
                checkBtn.className = 'w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium transition-colors hover:bg-gray-800';
            } else {
                checkBtn.disabled = true;
                checkBtn.style.backgroundColor = '#9ca3af';
                checkBtn.style.color = '#d1d5db';
                checkBtn.style.cursor = 'not-allowed';
                checkBtn.style.pointerEvents = 'auto'; // 클릭은 가능하게 (에러 메시지용)
                checkBtn.className = 'w-full px-6 py-3 bg-gray-400 text-gray-200 rounded-lg font-medium cursor-not-allowed';
            }
        }

        // 전역 함수로 등록
        window.updateDuplicateButtonState = updateDuplicateButtonState;

        // 이벤트 리스너 등록 (기존 제거 후 새로 등록)
        const eventFields = ['check_cafe_name', 'check_start_date', 'check_end_date'];
        
        eventFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                // 모든 기존 이벤트 제거 (clone으로)
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                
                // 새 이벤트 등록
                newElement.addEventListener('input', updateDuplicateButtonState);
                newElement.addEventListener('change', updateDuplicateButtonState);
                
                console.log(`${fieldId} 이벤트 리스너 등록 완료`);
            }
        });

        // 버튼 클릭 이벤트 (기존 제거 후 새로 등록)
        const newCheckBtn = checkBtn.cloneNode(true);
        checkBtn.parentNode.replaceChild(newCheckBtn, checkBtn);
        
        newCheckBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('중복 확인 버튼 클릭됨');
            
            const artistId = document.getElementById('check_artist_id')?.value?.trim() || '';
            const cafeName = document.getElementById('check_cafe_name')?.value?.trim() || '';
            const startDate = document.getElementById('check_start_date')?.value?.trim() || '';
            const endDate = document.getElementById('check_end_date')?.value?.trim() || '';

            if (!artistId || !cafeName || !startDate || !endDate) {
                const missing = [];
                if (!artistId) missing.push('아티스트/멤버');
                if (!cafeName) missing.push('카페명');
                if (!startDate) missing.push('시작일');
                if (!endDate) missing.push('종료일');
                
                const message = `다음 항목을 입력해주세요: ${missing.join(', ')}`;
                FormUtils.showToast(message, 'warning');
                return;
            }
            
            performDuplicateCheck();
        });

        console.log('중복 확인 버튼 이벤트 등록 완료');

        // 중복 선택 버튼들 설정
        setupDuplicateSelectionButtons();
        
        // 초기 상태 설정
        setTimeout(() => {
            updateDuplicateButtonState();
            console.log('중복 확인 모듈 초기화 완료');
        }, 100);

        // 아티스트 선택 시 호출되는 함수 재정의
        window.selectArtistForDuplicateCheck = function(result) {
            console.log('아티스트 선택됨:', result);
            
            // 필드 업데이트
            const artistIdField = document.getElementById('check_artist_id');
            const memberIdField = document.getElementById('check_member_id');
            const searchInput = document.getElementById('artist-member-search');
            const selectedDiv = document.getElementById('selected-artist');
            const selectedText = document.getElementById('selected-artist-text');
            const resultsList = document.getElementById('artist-member-results');

            if (artistIdField) artistIdField.value = result.artist_id || '';
            if (memberIdField) memberIdField.value = result.member_id || '';

            const displayText = result.member_name
                ? `${result.artist_name} - ${result.member_name}`
                : result.artist_name;

            if (searchInput) searchInput.value = displayText;
            if (selectedText) selectedText.textContent = displayText;
            if (selectedDiv) selectedDiv.classList.remove('hidden');
            if (resultsList) resultsList.classList.add('hidden');

            // 버튼 상태 업데이트
            setTimeout(() => {
                updateDuplicateButtonState();
            }, 50);
        };
    }
    function handleDuplicateCheckResult(result) {
        duplicateChecked = true;
        isDuplicate = result.exists;
        
        window.ddoksangApp.duplicateChecked = duplicateChecked;
        window.ddoksangApp.isDuplicate = isDuplicate;

        hideDuplicateCheckForm();

        if (result.exists && result.similar_cafes?.length > 0) {
            showDuplicateCafes(result.similar_cafes);
            FormUtils.showToast(`유사한 카페 ${result.similar_cafes.length}개가 발견되었습니다.`, 'warning');
        } else {
            showSuccessAndProceed();
        }
    }

    function showSuccessAndProceed() {
        // 중복 확인 폼 숨기기
        const duplicateForm = document.getElementById('duplicate-check-form');
        if (duplicateForm) {
            duplicateForm.style.display = 'none';
        }
        
        // 제목과 설명 숨기기
        const section = document.querySelector('section.max-w-4xl');
        if (section) {
            const title = section.querySelector('h1');
            const description = section.querySelector('p');
            const progressBar = section.querySelector('.w-full.bg-gray-200.rounded-full');
            
            if (title) title.style.display = 'none';
            if (description) description.style.display = 'none';
            if (progressBar) progressBar.style.display = 'none';
        }
        
        // 성공 메시지 표시
        const successDiv = document.createElement('div');
        successDiv.className = 'text-center mb-8 p-6 bg-green-50 border border-green-200 rounded-lg';
        successDiv.innerHTML = `
            <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h2 class="text-xl font-bold text-green-800 mb-2">중복 확인 완료!</h2>
            <p class="text-green-700 mb-4">동일한 생일카페가 없습니다. 새로운 카페를 등록하세요.</p>
            <button onclick="proceedToNextStep()" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors">
                다음 단계로 진행
            </button>
        `;
        
        // Step-0에 추가
        const step0 = document.getElementById('step-0');
        if (step0) {
            step0.appendChild(successDiv);
        }
        
        // 상태 업데이트
        duplicateChecked = true;
        isDuplicate = false;
        window.ddoksangApp.duplicateChecked = true;
        window.ddoksangApp.isDuplicate = false;
        
        FormUtils.showToast('중복 확인 완료! 3초 후 다음 단계로 이동합니다.', 'success');
        
        // 자동으로 3초 후 다음 단계로 진행
        setTimeout(() => {
            window.proceedToNextStep();
        }, 3000);
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
                FormUtils.showToast('먼저 해당하는 카페를 선택해주세요.', 'warning');
                FormUtils.toggleClass('select-cafe-instruction', 'hidden', false);
                return;
            }
            
            FormUtils.showToast('선택하신 카페 페이지로 이동합니다.', 'info');
            setTimeout(() => {
                window.location.href = `/ddoksang/cafe/${selectedCafeId}/`;
            }, 1000);
        });
        
        document.getElementById('deny-duplicate-btn')?.addEventListener('click', () => {
            duplicateChecked = true;
            isDuplicate = false;
            window.ddoksangApp.duplicateChecked = duplicateChecked;
            window.ddoksangApp.isDuplicate = isDuplicate;
            
            FormUtils.showToast('새로운 생카 등록을 진행합니다.', 'success');
            setTimeout(() => showStep(1), 1000);
        });
    }

    function initializeDatePickers() {
        if (typeof flatpickr === 'undefined') {
            return;
        }

        if (window.DdoksangDateUtils?.initDuplicateCheckPickers) {
            const duplicatePickers = window.DdoksangDateUtils.initDuplicateCheckPickers(() => {
                setTimeout(() => {
                    if (window.updateDuplicateButtonState) {
                        window.updateDuplicateButtonState();
                    }
                }, 100);
            });
        }

        if (window.DdoksangDateUtils?.initCreateFormPickers) {
            const formPickers = window.DdoksangDateUtils.initCreateFormPickers(() => {
                setTimeout(() => updateNextButtonState(), 100);
            });
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
        // 아티스트 ID와 멤버 ID 설정
        const artistIdField = document.getElementById(`${prefix}_artist_id`);
        const memberIdField = document.getElementById(`${prefix}_member_id`);
        
        if (artistIdField) artistIdField.value = result.artist_id || '';
        if (memberIdField) memberIdField.value = result.member_id || '';

        const selectedText = result.member_name
            ? `${result.artist_name} - ${result.member_name}`
            : result.artist_name;

        // UI 업데이트
        const searchInput = document.getElementById(`${prefix}_artist-member-search`);
        const selectedArtistDiv = document.getElementById(`${prefix === 'check' ? '' : prefix + '_'}selected-artist`);
        const selectedTextSpan = document.getElementById(`${prefix === 'check' ? '' : prefix + '_'}selected-artist-text`);
        const resultsList = document.getElementById(`${prefix}_artist-member-results`);

        if (searchInput) {
            searchInput.value = selectedText;
        }
        
        if (resultsList) {
            resultsList.classList.add('hidden');
        }
        
        if (selectedArtistDiv) {
            selectedArtistDiv.classList.remove('hidden');
        }
        
        if (selectedTextSpan) {
            selectedTextSpan.textContent = selectedText;
        }

        // 중복 확인 버튼 상태 업데이트
        if (prefix === 'check' && typeof window.updateDuplicateButtonState === 'function') {
            setTimeout(() => {
                window.updateDuplicateButtonState();
            }, 50);
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
        FormUtils.setText('final-selected-artist-text', `${data.displayText} 선택됨`);
        
        FormUtils.toggleClass('final-artist-member-results', 'hidden', true);
        FormUtils.toggleClass('final-selected-artist', 'hidden', false);
        FormUtils.updateButtonState('confirm-new-artist-btn', true);
        updateNextButtonState();
    }

    function initializeImageUpload() {
        const imageContainer = document.getElementById('image-upload-container');
        if (!imageContainer) {
            return;
        }

        if (window.ddoksangImageUploader?.isInitialized) {
            imageUploadModule = window.ddoksangImageUploader;
            window.ddoksangApp.imageUploadModule = imageUploadModule;
            
            const originalTriggerValidation = imageUploadModule.triggerValidation;
            if (originalTriggerValidation) {
                imageUploadModule.triggerValidation = function() {
                    setTimeout(() => {
                        window.ddoksangApp.updateNextButtonState();
                    }, 50);
                };
            }
            
            return;
        }

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
                    
                    const originalTriggerValidation = imageUploadModule.triggerValidation;
                    if (originalTriggerValidation) {
                        imageUploadModule.triggerValidation = function() {
                            setTimeout(() => {
                                window.ddoksangApp.updateNextButtonState();
                            }, 50);
                        };
                    }
                }
            } catch (error) {
                // error handling
            }
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
            FormUtils.showToast('검색어를 입력해주세요.', 'warning');
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
            this.querySelectorAll('input, textarea, select').forEach(input => {
                input.disabled = false;
            });

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

    // 초기화 실행
    init();
});

// CSS 스타일 추가
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

    #check-duplicate-btn {
        transition: all 0.2s ease-in-out;
        border: none;
        font-weight: 600;
        font-size: 0.875rem;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        min-height: 3rem;
        width: 100%;
    }
    
    #check-duplicate-btn:not([disabled]):hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    #check-duplicate-btn:active {
        transform: scale(0.95);
    }
`;

// 스타일 적용
if (!document.querySelector('#duplicate-check-styles')) {
    const style = document.createElement('style');
    style.id = 'duplicate-check-styles';
    style.textContent = additionalCSS;
    document.head.appendChild(style);
}