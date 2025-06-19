// ddoksang_image_upload.js - 간단하고 안정적인 버전

console.log('🚀 이미지 업로드 모듈 로드 시작');

// 메인 초기화 함수
window.initDdoksangImageUpload = function() {
    console.log('🖼️ 이미지 업로드 초기화 시작');
    
    if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
        console.log('✅ 이미지 업로더 이미 초기화됨');
        return window.ddoksangImageUploader;
    }

    const uploader = setupImageUploader();
    
    if (uploader && uploader.isInitialized) {
        window.ddoksangImageUploader = uploader;
        console.log('✅ 이미지 업로더 초기화 완료');
        return uploader;
    } else {
        console.error('❌ 이미지 업로더 초기화 실패');
        return null;
    }
};

// 이미지 업로더 설정 함수
function setupImageUploader() {
    console.log('⚙️ 이미지 업로더 설정 시작');
    
    // DOM 요소 확인
    const fileInput = document.getElementById('image-upload');
    const fileCount = document.getElementById('file-count');
    const previewContainer = document.getElementById('image-preview-container');
    const previewList = document.getElementById('image-preview-list');
    const form = document.getElementById('multiStepForm');

    if (!fileInput || !fileCount || !previewContainer || !previewList) {
        console.error('❌ 필수 DOM 요소를 찾을 수 없습니다:', {
            fileInput: !!fileInput,
            fileCount: !!fileCount,
            previewContainer: !!previewContainer,
            previewList: !!previewList
        });
        return null;
    }

    console.log('✅ 모든 필수 DOM 요소 확인됨');

    // 상태 변수
    let selectedFiles = [];
    let fileIdCounter = Date.now();
    let sortableInstance = null;
    const maxFiles = 10;
    const maxSizeMB = 5;

    // 파일 검증 함수
    function validateFiles(files) {
        const errors = [];
        const maxSize = maxSizeMB * 1024 * 1024;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                errors.push(`${file.name}: 이미지 파일만 업로드할 수 있습니다.`);
                continue;
            }

            if (file.size > maxSize) {
                errors.push(`${file.name}: 파일 크기가 ${maxSizeMB}MB를 초과합니다.`);
                continue;
            }

            if (file.size === 0) {
                errors.push(`${file.name}: 빈 파일입니다.`);
                continue;
            }
        }

        return { valid: errors.length === 0, errors };
    }

    // 미리보기 업데이트 함수
    function updatePreview() {
        console.log('🔄 미리보기 업데이트:', selectedFiles.length, '개 파일');

        // 기존 Sortable 정리
        if (sortableInstance) {
            try {
                sortableInstance.destroy();
            } catch (e) {
                console.warn('Sortable 정리 오류:', e);
            }
            sortableInstance = null;
        }

        // 미리보기 목록 초기화
        previewList.innerHTML = "";

        // 선택된 파일들 렌더링
        selectedFiles.forEach((item, index) => {
            const wrapper = createImageWrapper(item, index);
            previewList.appendChild(wrapper);
        });

        // 추가 버튼
        if (selectedFiles.length < maxFiles) {
            const addWrapper = createAddButton();
            previewList.appendChild(addWrapper);
        }

        // Sortable 초기화
        initSortable();
        updateFileCount();
        updateFormFileInput();
        
        // 미리보기 컨테이너 표시
        if (selectedFiles.length > 0) {
            previewContainer.classList.remove("hidden");
            previewContainer.style.display = "block";
        }
        
        // 메인 앱에 알림
        notifyMainApp();
        
        console.log('✅ 미리보기 업데이트 완료');
    }

    // 이미지 래퍼 생성
    function createImageWrapper(item, index) {
        const wrapper = document.createElement("div");
        wrapper.className = "relative w-full aspect-[3/4] cursor-move bg-gray-100 rounded border";
        wrapper.dataset.fileId = item.id;
        wrapper.dataset.index = index;

        const img = document.createElement("img");
        img.className = "rounded border object-cover w-full h-full pointer-events-none";
        img.alt = item.name || `이미지 ${index + 1}`;

        // 이미지 로딩 에러 처리
        img.onerror = () => {
            console.warn(`이미지 로딩 실패: ${item.name}`);
            img.src = createErrorPlaceholder();
        };

        // 이미지 소스 설정
        if (item.previewUrl) {
            img.src = item.previewUrl;
        } else {
            createImagePreview(item, img);
        }

        // 배지들 추가
        addBadges(wrapper, item, index);

        // 삭제 버튼
        const closeBtn = createDeleteButton(item.id);
        
        // 드래그 핸들
        const dragHandle = createDragHandle();

        wrapper.appendChild(img);
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(dragHandle);

        return wrapper;
    }

    // 이미지 미리보기 생성
    function createImagePreview(item, img) {
        if (!item.file) {
            console.warn('파일 객체가 없습니다:', item);
            img.src = createErrorPlaceholder();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            item.previewUrl = e.target.result;
            img.src = e.target.result;
            console.log('✅ 이미지 미리보기 생성됨:', item.name);
        };
        reader.onerror = (e) => {
            console.error('FileReader 오류:', e);
            img.src = createErrorPlaceholder();
        };
        
        try {
            reader.readAsDataURL(item.file);
        } catch (error) {
            console.error('파일 읽기 오류:', error);
            img.src = createErrorPlaceholder();
        }
    }

    // 오류 플레이스홀더 생성
    function createErrorPlaceholder() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5nlsaDsiJgg7LqY7J6EPC90ZXh0Pjwvc3ZnPg==';
    }

    // 배지 추가
    function addBadges(wrapper, item, index) {
        if (index === 0) {
            const badge = document.createElement("div");
            badge.className = "absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10";
            badge.textContent = "대표";
            wrapper.appendChild(badge);
        }

        const orderBadge = document.createElement("div");
        orderBadge.className = "absolute top-1 right-8 bg-gray-800 bg-opacity-80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center z-10";
        orderBadge.textContent = index + 1;
        wrapper.appendChild(orderBadge);
    }

    // 삭제 버튼 생성
    function createDeleteButton(fileId) {
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.className = `
            absolute top-1 right-1 w-6 h-6 rounded-full
            bg-red-500 bg-opacity-80 flex items-center justify-center
            text-white text-sm hover:bg-opacity-100 z-20
            transition-all duration-200 hover:scale-110
        `;
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeImage(fileId);
        });
        return closeBtn;
    }

    // 드래그 핸들 생성
    function createDragHandle() {
        const dragHandle = document.createElement("div");
        dragHandle.className = "absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10 cursor-grab active:cursor-grabbing";
        dragHandle.innerHTML = "⋮⋮";
        dragHandle.style.touchAction = 'none';
        return dragHandle;
    }

    // 추가 버튼 생성
    function createAddButton() {
        const addWrapper = document.createElement("div");
        addWrapper.className = "relative w-full aspect-[3/4] border-2 border-dashed border-gray-300 rounded hover:border-gray-400 transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100";
        addWrapper.dataset.addButton = "true";
        
        const addButton = document.createElement("div");
        addButton.className = "absolute inset-0 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600";
        addButton.innerHTML = `
            <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            <span class="text-xs">이미지 추가</span>
            <span class="text-xs text-gray-400 mt-1">${selectedFiles.length}/${maxFiles}</span>
        `;
        
        addButton.addEventListener("click", () => {
            fileInput.click();
        });
        
        addWrapper.appendChild(addButton);
        return addWrapper;
    }

    // 파일 선택 처리
    function handleFileSelection(newFiles) {
        console.log('📁 파일 선택 처리:', newFiles.length, '개');

        const remainingSlots = maxFiles - selectedFiles.length;
        
        if (newFiles.length > remainingSlots) {
            if (remainingSlots === 0) {
                showToast(`이미 최대 ${maxFiles}장이 선택되었습니다.`, 'warning');
                return;
            } else {
                showToast(`최대 ${maxFiles}개까지만 업로드 가능해 ${remainingSlots}개만 추가됩니다.`, 'warning');
            }
        }
        
        const filesToAdd = newFiles.slice(0, remainingSlots);
        
        // 파일 검증
        const validation = validateFiles(filesToAdd);
        
        if (!validation.valid) {
            validation.errors.forEach(error => showToast(error, 'warning'));
            return;
        }

        // 파일 객체 생성
        filesToAdd.forEach(file => {
            const fileObj = {
                id: `new_${Date.now()}_${fileIdCounter++}_${Math.random().toString(36).substr(2, 9)}`,
                type: "new",
                file: file,
                name: file.name,
                size: file.size,
                previewUrl: null
            };
            
            selectedFiles.push(fileObj);
            console.log('📁 파일 추가됨:', fileObj.name);
        });
        
        updatePreview();
    }

    // Sortable 초기화
    function initSortable() {
        if (selectedFiles.length <= 1 || typeof Sortable === 'undefined') return;

        try {
            sortableInstance = new Sortable(previewList, {
                animation: 200,
                filter: '[data-add-button="true"]',
                preventOnFilter: false,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                handle: '.cursor-move, .cursor-grab',
                
                onEnd: function(evt) {
                    const oldIndex = evt.oldIndex;
                    const newIndex = evt.newIndex;
                    
                    if (evt.item.dataset.addButton === "true") return;
                    
                    if (oldIndex !== newIndex && 
                        oldIndex < selectedFiles.length && 
                        newIndex < selectedFiles.length) {
                        
                        console.log('🔄 파일 순서 변경:', { oldIndex, newIndex });
                        
                        const movedItem = selectedFiles.splice(oldIndex, 1)[0];
                        selectedFiles.splice(newIndex, 0, movedItem);
                        
                        updatePreview();
                    }
                }
            });
        } catch (error) {
            console.error('Sortable 초기화 오류:', error);
        }
    }

    // 이미지 제거
    function removeImage(fileId) {
        console.log('🗑️ 이미지 제거 시작:', fileId);
        
        const initialLength = selectedFiles.length;
        
        selectedFiles = selectedFiles.filter(item => {
            const shouldKeep = item.id !== fileId;
            if (!shouldKeep) {
                if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(item.previewUrl);
                }
                console.log('🗑️ 파일 제거됨:', item.name);
            }
            return shouldKeep;
        });
        
        if (selectedFiles.length !== initialLength) {
            console.log('✅ 파일 제거 완료');
            updatePreview();
        }
    }

    // 파일 개수 업데이트
    function updateFileCount() {
        if (selectedFiles.length === 0) {
            fileCount.textContent = "선택된 파일 없음";
            fileCount.className = "text-sm text-gray-500";
        } else {
            fileCount.textContent = `${selectedFiles.length}개 파일 선택됨 (최대 ${maxFiles}장)`;
            fileCount.className = "text-sm text-gray-700 font-medium";
        }
    }

    // 폼 파일 입력 업데이트
    function updateFormFileInput() {
        console.log('🔄 폼 파일 입력 업데이트 시작');
        
        try {
            const dt = new DataTransfer();
            
            const newFiles = selectedFiles
                .filter(f => f.type === "new" && f.file)
                .map(f => f.file);
            
            console.log('📎 추가할 파일들:', newFiles.length, '개');
            
            newFiles.forEach((file, index) => {
                try {
                    dt.items.add(file);
                    console.log(`✅ 파일 ${index + 1} 추가됨: ${file.name}`);
                } catch (error) {
                    console.error(`❌ 파일 ${index + 1} 추가 실패:`, error);
                }
            });
            
            fileInput.files = dt.files;
            
            const resultFiles = Array.from(fileInput.files);
            console.log('🎯 최종 폼 파일 상태:', resultFiles.length, '개');
            
        } catch (error) {
            console.error('❌ 폼 파일 입력 업데이트 실패:', error);
            showToast('파일 업데이트 중 오류가 발생했습니다.', 'error');
        }
    }

    // 메인 앱에 알림
    function notifyMainApp() {
        const event = new CustomEvent('filesUpdated', {
            detail: {
                selectedCount: selectedFiles.length,
                formFileCount: fileInput.files.length,
                isReady: selectedFiles.length > 0
            }
        });
        document.dispatchEvent(event);
        
        if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
            setTimeout(() => {
                window.ddoksangApp.updateNextButtonState();
            }, 100);
        }
    }

    // 토스트 메시지
    function showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`Toast: ${message}`);
        }
    }

    // 파일 입력 이벤트 핸들러
    function handleFileInput(event) {
        console.log('📂 파일 입력 이벤트:', event.target.files.length);
        
        const newFiles = Array.from(event.target.files);
        
        if (newFiles.length === 0) {
            return;
        }
        
        handleFileSelection(newFiles);
    }

    // 이벤트 리스너 등록
    fileInput.addEventListener("change", handleFileInput);

    // 초기 상태 설정
    updatePreview();

    // API 객체 생성
    const apiObject = {
        isInitialized: true,
        getFiles: () => selectedFiles.map(f => f.type === "new" ? f.file : f),
        getNewFiles: () => selectedFiles.filter(f => f.type === "new").map(f => f.file),
        getFileCount: () => selectedFiles.length,
        getSelectedFiles: () => [...selectedFiles],
        getFormFileCount: () => fileInput.files.length,
        removeFileById: (fileId) => removeImage(fileId),
        clear: () => {
            selectedFiles.forEach(item => {
                if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(item.previewUrl);
                }
            });
            selectedFiles = [];
            if (sortableInstance) {
                try {
                    sortableInstance.destroy();
                } catch (e) {
                    console.warn('Sortable 정리 오류:', e);
                }
                sortableInstance = null;
            }
            updatePreview();
        },
        refresh: () => {
            updatePreview();
        },
        syncFormFiles: () => {
            console.log('🔄 수동 파일 동기화 실행');
            updateFormFileInput();
            notifyMainApp();
        },
        validateState: () => {
            const selectedCount = selectedFiles.length;
            const formCount = fileInput.files.length;
            const isValid = selectedCount === 0 || formCount > 0;
            
            return {
                isValid: isValid,
                selectedCount: selectedCount,
                formCount: formCount,
                needsSync: selectedCount > 0 && formCount === 0
            };
        }
    };

    console.log('✅ 이미지 업로드 모듈 설정 완료');
    return apiObject;
}

// 스타일 주입
const imageUploadCSS = `
  .sortable-ghost {
    opacity: 0.5;
    background: #f3f4f6;
  }
  
  .sortable-chosen {
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    z-index: 999;
  }
  
  .sortable-drag {
    opacity: 0.8;
    transform: rotate(2deg);
  }
`;

if (!document.getElementById('ddoksang-image-upload-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'ddoksang-image-upload-styles';
    styleElement.textContent = imageUploadCSS;
    document.head.appendChild(styleElement);
}

console.log('✅ 이미지 업로드 모듈 로드 완료');