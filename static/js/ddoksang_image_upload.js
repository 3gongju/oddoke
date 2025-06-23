// ddoksang_image_upload.js - JSON 기반 이미지 갤러리용

console.log('🚀 JSON 기반 이미지 업로드 모듈 로드 시작');

// 메인 초기화 함수
window.initDdoksangImageUpload = function() {
    console.log('🖼️ JSON 기반 이미지 업로드 초기화 시작');
    
    if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
        console.log('✅ 이미지 업로더 이미 초기화됨');
        return window.ddoksangImageUploader;
    }

    const uploader = setupImageUploader();
    
    if (uploader && uploader.isInitialized) {
        window.ddoksangImageUploader = uploader;
        console.log('✅ JSON 기반 이미지 업로더 초기화 완료');
        return uploader;
    } else {
        console.error('❌ 이미지 업로더 초기화 실패');
        return null;
    }
};

// 이미지 압축 유틸리티 (기존과 동일)
const ImageCompressor = {
    config: {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85,
        maxSizeKB: 800,
        format: 'image/jpeg'
    },

    async compressImage(file, options = {}) {
        const config = { ...this.config, ...options };
        
        console.log('🔄 이미지 압축 시작:', {
            원본파일: file.name,
            원본크기: `${(file.size / 1024).toFixed(1)}KB`,
            설정: config
        });

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                try {
                    const result = this.processImage(img, canvas, ctx, config, file);
                    console.log('✅ 이미지 압축 완료:', {
                        압축파일: result.name,
                        압축크기: `${(result.size / 1024).toFixed(1)}KB`,
                        압축률: `${((1 - result.size / file.size) * 100).toFixed(1)}%`
                    });
                    resolve(result);
                } catch (error) {
                    console.error('❌ 이미지 압축 실패:', error);
                    resolve(file);
                }
            };

            img.onerror = () => {
                console.error('❌ 이미지 로딩 실패');
                resolve(file);
            };

            img.src = URL.createObjectURL(file);
        });
    },

    processImage(img, canvas, ctx, config, originalFile) {
        const { maxWidth, maxHeight, quality, maxSizeKB, format } = config;

        if (originalFile.size <= maxSizeKB * 1024 && 
            img.width <= maxWidth && 
            img.height <= maxHeight) {
            console.log('⚡ 압축 불필요 - 원본 반환');
            return originalFile;
        }

        const dimensions = this.calculateDimensions(img.width, img.height, maxWidth, maxHeight);
        
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

        let attempt = 0;
        let currentQuality = quality;
        let result = null;

        while (attempt < 3) {
            try {
                const dataURL = canvas.toDataURL(format, currentQuality);
                const blob = this.dataURLToBlob(dataURL);
                
                console.log(`🔄 압축 시도 ${attempt + 1}:`, {
                    품질: currentQuality,
                    크기: `${(blob.size / 1024).toFixed(1)}KB`
                });

                if (blob.size <= maxSizeKB * 1024 || attempt === 2) {
                    result = new File([blob], this.generateFileName(originalFile, format), {
                        type: format,
                        lastModified: Date.now()
                    });
                    break;
                }

                currentQuality *= 0.8;
                attempt++;
            } catch (error) {
                console.error(`❌ 압축 시도 ${attempt + 1} 실패:`, error);
                break;
            }
        }

        return result || originalFile;
    },

    calculateDimensions(width, height, maxWidth, maxHeight) {
        let newWidth = width;
        let newHeight = height;

        if (width > maxWidth) {
            newHeight = (height * maxWidth) / width;
            newWidth = maxWidth;
        }

        if (newHeight > maxHeight) {
            newWidth = (newWidth * maxHeight) / newHeight;
            newHeight = maxHeight;
        }

        return {
            width: Math.round(newWidth),
            height: Math.round(newHeight)
        };
    },

    dataURLToBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    },

    generateFileName(originalFile, format) {
        const nameWithoutExt = originalFile.name.replace(/\.[^/.]+$/, '');
        const ext = format === 'image/jpeg' ? '.jpg' : 
                   format === 'image/png' ? '.png' : '.jpg';
        return `${nameWithoutExt}_compressed${ext}`;
    }
};

// ✅ JSON 기반 이미지 업로더 설정 함수
function setupImageUploader() {
    console.log('⚙️ JSON 기반 이미지 업로더 설정 시작');
    
    // DOM 요소 확인
    const fileInput = document.getElementById('image-upload');
    const fileCount = document.getElementById('file-count');
    const previewContainer = document.getElementById('image-preview-container');
    const previewList = document.getElementById('image-preview-list');

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

    // ✅ JSON 기반 상태 변수
    let imageGallery = [];  // JSON 형태로 이미지 정보 저장
    let fileIdCounter = Date.now();
    let sortableInstance = null;
    const maxFiles = 10;
    const maxSizeMB = 5;

    // ✅ 이미지 갤러리 JSON 구조
    // {
    //   id: "img_xxx",
    //   file: File객체,
    //   url: "blob:xxx" (미리보기용),
    //   type: "main|poster|other",
    //   is_main: true/false,
    //   order: 0,
    //   width: 1200,
    //   height: 800,
    //   file_size: 245760,
    //   isCompressed: true/false
    // }

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

    // ✅ 미리보기 업데이트 함수 (JSON 기반)
    function updatePreview() {
        console.log('🔄 JSON 기반 미리보기 업데이트:', imageGallery.length, '개 이미지');

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

        // ✅ 이미지 갤러리 렌더링 (order 순으로 정렬)
        const sortedImages = [...imageGallery].sort((a, b) => a.order - b.order);
        
        sortedImages.forEach((imageData, index) => {
            const wrapper = createImageWrapper(imageData, index);
            previewList.appendChild(wrapper);
        });

        // 추가 버튼
        if (imageGallery.length < maxFiles) {
            const addWrapper = createAddButton();
            previewList.appendChild(addWrapper);
        }

        // Sortable 초기화
        initSortable();
        updateFileCount();
        updateFormFileInput();
        
        // 미리보기 컨테이너 표시
        if (imageGallery.length > 0) {
            previewContainer.classList.remove("hidden");
            previewContainer.style.display = "block";
        }
        
        // 메인 앱에 알림
        notifyMainApp();
        
        console.log('✅ JSON 기반 미리보기 업데이트 완료');
    }

    // ✅ 이미지 래퍼 생성 (JSON 기반)
    function createImageWrapper(imageData, index) {
        const wrapper = document.createElement("div");
        wrapper.className = "relative w-full aspect-[3/4] cursor-move bg-gray-100 rounded border";
        wrapper.dataset.imageId = imageData.id;
        wrapper.dataset.index = index;

        const img = document.createElement("img");
        img.className = "rounded border object-cover w-full h-full pointer-events-none";

        // 이미지 로딩 에러 처리
        img.onerror = () => {
            img.src = createErrorPlaceholder();
        };

        // ✅ 미리보기 URL 설정
        if (imageData.url) {
            img.src = imageData.url;
        } else {
            createImagePreview(imageData, img);
        }

        // 배지들 추가
        addBadges(wrapper, imageData, index);

        // 삭제 버튼
        const closeBtn = createDeleteButton(imageData.id);
        
        // 드래그 핸들
        const dragHandle = createDragHandle();

        // ✅ 압축 상태 표시
        if (imageData.isCompressed) {
            const compressedBadge = document.createElement("div");
            compressedBadge.className = "absolute bottom-1 left-1 bg-green-600 bg-opacity-90 text-white text-xs px-1 py-0.5 rounded z-10";
            compressedBadge.textContent = "압축됨";
            wrapper.appendChild(compressedBadge);
        }

        wrapper.appendChild(img);
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(dragHandle);

        return wrapper;
    }

    // ✅ 이미지 미리보기 생성 (JSON 기반)
    function createImagePreview(imageData, img) {
        if (!imageData.file) {
            console.warn('파일 객체가 없습니다:', imageData);
            img.src = createErrorPlaceholder();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            imageData.url = e.target.result;
            img.src = e.target.result;
        };
        reader.onerror = (e) => {
            console.error('FileReader 오류:', e);
            img.src = createErrorPlaceholder();
        };
        
        try {
            reader.readAsDataURL(imageData.file);
        } catch (error) {
            console.error('파일 읽기 오류:', error);
            img.src = createErrorPlaceholder();
        }
    }

    // 오류 플레이스홀더 생성 (기존과 동일)
    function createErrorPlaceholder() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5nlsaDsiJgg7LqY7J6EPC90ZXh0Pjwvc3ZnPg==';
    }

    // ✅ 배지 추가 (JSON 기반)
    function addBadges(wrapper, imageData, index) {
        if (imageData.is_main) {
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

    // 삭제 버튼 생성 (기존과 동일)
    function createDeleteButton(imageId) {
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
            removeImage(imageId);
        });
        return closeBtn;
    }

    // 드래그 핸들 생성 (기존과 동일)
    function createDragHandle() {
        const dragHandle = document.createElement("div");
        dragHandle.className = "absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10 cursor-grab active:cursor-grabbing";
        dragHandle.innerHTML = "⋮⋮";
        dragHandle.style.touchAction = 'none';
        return dragHandle;
    }

    // 추가 버튼 생성 (기존과 동일)
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
            <span class="text-xs text-gray-400 mt-1">${imageGallery.length}/${maxFiles}</span>
        `;
        
        addButton.addEventListener("click", () => {
            fileInput.click();
        });
        
        addWrapper.appendChild(addButton);
        return addWrapper;
    }

    // ✅ 파일 선택 처리 (JSON 기반 + 압축)
    async function handleFileSelection(newFiles) {
        console.log('📁 JSON 기반 파일 선택 처리:', newFiles.length, '개');

        const remainingSlots = maxFiles - imageGallery.length;
        
        if (newFiles.length > remainingSlots) {
            if (remainingSlots === 0) {
                showToast(`이미 최대 ${maxFiles}장이 선택되었습니다.`, 'warning');
                return;
            } else {
                showToast(`최대 ${maxFiles}개까지만 업로드 가능. ${remainingSlots}개만 추가됩니다.`, 'warning');
            }
        }
        
        const filesToAdd = newFiles.slice(0, remainingSlots);
        
        // 파일 검증
        const validation = validateFiles(filesToAdd);
        
        if (!validation.valid) {
            validation.errors.forEach(error => showToast(error, 'warning'));
            return;
        }

        // ✅ 압축 진행 표시
        if (filesToAdd.length > 0) {
            showToast('이미지 압축 중...', 'info', 5000);
        }

        // ✅ JSON 기반 이미지 객체 생성
        for (const file of filesToAdd) {
            try {
                console.log('🔄 JSON 기반 파일 처리:', file.name);
                
                // 이미지 압축
                const compressedFile = await ImageCompressor.compressImage(file);
                const isCompressed = compressedFile !== file;
                
                // ✅ JSON 형태의 이미지 데이터 생성
                const imageData = {
                    id: `img_${Date.now()}_${fileIdCounter++}_${Math.random().toString(36).substr(2, 9)}`,
                    file: compressedFile,
                    originalFile: file,
                    url: null,  // 미리보기에서 생성
                    type: imageGallery.length === 0 ? "main" : "other",
                    is_main: imageGallery.length === 0,  // 첫 번째가 대표
                    order: imageGallery.length,
                    width: null,  // 나중에 설정
                    height: null,  // 나중에 설정
                    file_size: compressedFile.size,
                    isCompressed: isCompressed
                };
                
                imageGallery.push(imageData);
                
                if (isCompressed) {
                    console.log('✅ 압축 완료:', {
                        파일명: file.name,
                        원본크기: `${(file.size / 1024).toFixed(1)}KB`,
                        압축크기: `${(compressedFile.size / 1024).toFixed(1)}KB`,
                        압축률: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
                    });
                } else {
                    console.log('⚡ 압축 불필요:', file.name);
                }
                
            } catch (error) {
                console.error('❌ JSON 기반 파일 처리 오류:', error);
                
                // 실패시 원본 파일로 추가
                const imageData = {
                    id: `img_${Date.now()}_${fileIdCounter++}_${Math.random().toString(36).substr(2, 9)}`,
                    file: file,
                    url: null,
                    type: imageGallery.length === 0 ? "main" : "other",
                    is_main: imageGallery.length === 0,
                    order: imageGallery.length,
                    file_size: file.size,
                    isCompressed: false
                };
                
                imageGallery.push(imageData);
            }
        }
        
        updatePreview();
        
        // ✅ 압축 완료 알림
        const compressedCount = imageGallery.filter(img => img.isCompressed).length;
        if (compressedCount > 0) {
            showToast(`${compressedCount}개 이미지가 압축되었습니다.`, 'success');
        }
    }

    // Sortable 초기화 (기존과 유사하지만 imageId 기반)
    function initSortable() {
        if (imageGallery.length <= 1 || typeof Sortable === 'undefined') return;

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
                        oldIndex < imageGallery.length && 
                        newIndex < imageGallery.length) {
                        
                        console.log('🔄 JSON 기반 순서 변경:', { oldIndex, newIndex });
                        
                        // ✅ JSON 배열에서 순서 변경
                        const movedItem = imageGallery.splice(oldIndex, 1)[0];
                        imageGallery.splice(newIndex, 0, movedItem);
                        
                        // order 값 재조정
                        imageGallery.forEach((img, index) => {
                            img.order = index;
                        });
                        
                        updatePreview();
                    }
                }
            });
        } catch (error) {
            console.error('Sortable 초기화 오류:', error);
        }
    }

    // ✅ 이미지 제거 (JSON 기반)
    function removeImage(imageId) {
        console.log('🗑️ JSON 기반 이미지 제거:', imageId);
        
        const initialLength = imageGallery.length;
        
        imageGallery = imageGallery.filter(imageData => {
            const shouldKeep = imageData.id !== imageId;
            if (!shouldKeep) {
                // blob URL 정리
                if (imageData.url && imageData.url.startsWith('blob:')) {
                    URL.revokeObjectURL(imageData.url);
                }
                
                // ✅ 대표 이미지 재설정 (첫 번째가 대표가 되도록)
                if (imageData.is_main && imageGallery.length > 0) {
                    imageGallery[0].is_main = true;
                    imageGallery[0].type = "main";
                }
            }
            return shouldKeep;
        });
        
        // order 재조정
        imageGallery.forEach((img, index) => {
            img.order = index;
        });
        
        if (imageGallery.length !== initialLength) {
            console.log('✅ JSON 기반 이미지 제거 완료');
            updatePreview();
        }
    }

    // ✅ 파일 개수 업데이트 (JSON 기반)
    function updateFileCount() {
        if (imageGallery.length === 0) {
            fileCount.textContent = "선택된 파일 없음";
            fileCount.className = "text-sm text-gray-500";
        } else {
            const compressedCount = imageGallery.filter(img => img.isCompressed).length;
            const compressedText = compressedCount > 0 ? ` (${compressedCount}개 압축됨)` : '';
            fileCount.textContent = `${imageGallery.length}개 파일 선택됨${compressedText} (최대 ${maxFiles}장)`;
            fileCount.className = "text-sm text-gray-700 font-medium";
        }
    }

    // ✅ 폼 파일 입력 업데이트 (JSON 기반)
    function updateFormFileInput() {
        console.log('🔄 JSON 기반 폼 파일 입력 업데이트 시작');
        
        try {
            const dt = new DataTransfer();
            
            // ✅ JSON 갤러리에서 실제 파일들 추출
            const files = imageGallery
                .sort((a, b) => a.order - b.order)  // order 순으로 정렬
                .map(imageData => imageData.file)
                .filter(file => file instanceof File);
            
            console.log('📎 JSON에서 추출한 파일들:', files.length, '개');
            
            files.forEach((file, index) => {
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
            console.error('❌ JSON 기반 폼 파일 입력 업데이트 실패:', error);
            showToast('파일 업데이트 중 오류가 발생했습니다.', 'error');
        }
    }

    // ✅ 메인 앱에 알림 (JSON 기반)
    function notifyMainApp() {
        const event = new CustomEvent('filesUpdated', {
            detail: {
                selectedCount: imageGallery.length,
                formFileCount: fileInput.files.length,
                compressedCount: imageGallery.filter(img => img.isCompressed).length,
                isReady: imageGallery.length > 0,
                imageGallery: imageGallery  // ✅ JSON 갤러리 정보 포함
            }
        });
        document.dispatchEvent(event);
        
        if (window.ddoksangApp && window.ddoksangApp.updateNextButtonState) {
            setTimeout(() => {
                window.ddoksangApp.updateNextButtonState();
            }, 100);
        }
    }

    // 토스트 메시지 (기존과 동일)
    function showToast(message, type = 'info', duration = 3000) {
        if (window.showToast) {
            window.showToast(message, type, duration);
        } else {
            console.log(`Toast: ${message}`);
        }
    }

    // 파일 입력 이벤트 핸들러 (기존과 동일)
    function handleFileInput(event) {
        console.log('📂 JSON 기반 파일 입력 이벤트:', event.target.files.length);
        
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

    // ✅ JSON 기반 API 객체 생성
    const apiObject = {
        isInitialized: true,
        
        // 기본 정보
        getFileCount: () => imageGallery.length,
        getFormFileCount: () => fileInput.files.length,
        
        // ✅ JSON 기반 메서드들
        getImageGallery: () => [...imageGallery],  // 복사본 반환
        getImageGalleryJSON: () => JSON.stringify(imageGallery),
        
        // 파일 관련
        getFiles: () => imageGallery.map(img => img.file),
        getNewFiles: () => imageGallery.map(img => img.file),
        getSelectedFiles: () => [...imageGallery],  // 호환성
        
        // 압축 통계
        getCompressionStats: () => {
            const total = imageGallery.length;
            const compressed = imageGallery.filter(img => img.isCompressed).length;
            const totalOriginalSize = imageGallery.reduce((sum, img) => sum + (img.originalFile?.size || img.file_size), 0);
            const totalCompressedSize = imageGallery.reduce((sum, img) => sum + img.file_size, 0);
            
            return {
                total,
                compressed,
                compressionRate: total > 0 ? ((compressed / total) * 100).toFixed(1) + '%' : '0%',
                totalOriginalSize,
                totalCompressedSize,
                spaceSaved: totalOriginalSize - totalCompressedSize,
                spaceSavedPercent: totalOriginalSize > 0 ? 
                    (((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100).toFixed(1) + '%' : '0%'
            };
        },
        
        // 조작 메서드들
        removeFileById: (imageId) => removeImage(imageId),
        setMainImage: (imageId) => {
            imageGallery.forEach(img => {
                img.is_main = (img.id === imageId);
                if (img.is_main) {
                    img.type = "main";
                }
            });
            updatePreview();
        },
        
        // 유틸리티
        clear: () => {
            imageGallery.forEach(imageData => {
                if (imageData.url && imageData.url.startsWith('blob:')) {
                    URL.revokeObjectURL(imageData.url);
                }
            });
            imageGallery = [];
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
            console.log('🔄 JSON 기반 수동 파일 동기화 실행');
            updateFormFileInput();
            notifyMainApp();
        },
        
        validateState: () => {
            const selectedCount = imageGallery.length;
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

    console.log('✅ JSON 기반 이미지 업로드 모듈 설정 완료');
    return apiObject;
}

// 스타일 주입 (기존과 동일)
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

if (!document.getElementById('ddoksang-json-image-upload-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'ddoksang-json-image-upload-styles';
    styleElement.textContent = imageUploadCSS;
    document.head.appendChild(styleElement);
}

console.log('✅ JSON 기반 이미지 업로드 모듈 로드 완료');