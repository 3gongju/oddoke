// ddoksang_image_upload.js - 중복 이미지 허용 버전
// 초기화 함수명 통일 및 안정성 개선

// 메인 초기화 함수 - create.html에서 호출되는 함수
window.initDdoksangImageUpload = function() {
  // 이미 초기화된 경우 기존 인스턴스 반환
  if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
    return window.ddoksangImageUploader;
  }

  // 기본 설정으로 초기화
  const uploader = window.setupDdoksangImageUpload({
    fileInputId: "image-upload",
    fileCountId: "file-count", 
    previewContainerId: "image-preview-container",
    previewListId: "image-preview-list",
    formId: "multiStepForm",
    maxFiles: 10,
    maxSizeMB: 5,
    existingImages: [],
    compression: {
      enabled: true,
      maxWidth: 1920,
      maxHeight: 1440,
      quality: 0.85,
      autoCompress: true
    }
  });

  if (uploader && uploader.isInitialized) {
    window.ddoksangImageUploader = uploader;
    return uploader;
  } else {
    return null;
  }
};

window.setupDdoksangImageUpload = function({
  fileInputId = "image-upload",
  fileCountId = "file-count", 
  previewContainerId = "image-preview-container",
  previewListId = "image-preview-list",
  formId = "multiStepForm",
  maxFiles = 10,
  maxSizeMB = 5,
  existingImages = [],
  compression = {
    enabled: true,
    maxWidth: 1920,
    maxHeight: 1440,
    quality: 0.85,
    autoCompress: true
  }
}) {
  // 이미 초기화된 경우 방지
  if (window.ddoksangImageUploader && window.ddoksangImageUploader.isInitialized) {
    return window.ddoksangImageUploader;
  }

  const fileInput = document.getElementById(fileInputId);
  const fileCount = document.getElementById(fileCountId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewList = document.getElementById(previewListId);
  const form = document.getElementById(formId);

  if (!fileInput || !fileCount || !previewContainer || !previewList) {
    return null;
  }

  // 기존 이벤트 핸들러 완전 제거
  const newFileInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newFileInput, fileInput);
  const cleanFileInput = document.getElementById(fileInputId);

  let selectedFiles = [];
  let fileIdCounter = Date.now();
  let sortableInstance = null;
  let isProcessing = false;

  // 이미지 압축 함수
  function compressImage(file, options = {}) {
    const {
      maxWidth = compression.maxWidth,
      maxHeight = compression.maxHeight,
      quality = compression.quality
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          const { width, height } = calculateOptimalDimensions(
            img.naturalWidth, 
            img.naturalHeight, 
            maxWidth, 
            maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const outputQuality = file.type === 'image/png' ? 1.0 : quality;

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('이미지 압축 실패'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: file.lastModified
            });

            resolve(compressedFile);
          }, outputType, outputQuality);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('이미지 로딩 실패'));
      img.src = URL.createObjectURL(file);
    });
  }

  function calculateOptimalDimensions(origWidth, origHeight, maxWidth, maxHeight) {
    if (origWidth <= maxWidth && origHeight <= maxHeight) {
      return { width: origWidth, height: origHeight };
    }

    const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
    return {
      width: Math.round(origWidth * ratio),
      height: Math.round(origHeight * ratio)
    };
  }

  function shouldCompress(file) {
    if (!compression.enabled) return false;
    return file.size > (2 * 1024 * 1024); // 2MB 이상
  }

  // 파일 처리 함수
  async function processFiles(files) {
    if (!files || files.length === 0) return [];
    
    const processedFiles = [];
    
    try {
      isProcessing = true;
      updateProcessingUI(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i + 1) / files.length) * 100;
        updateProcessingProgress(progress, `${file.name} 처리 중...`);

        let processedFile = file;

        if (file.type.startsWith('image/') && shouldCompress(file)) {
          try {
            processedFile = await compressImage(file);
            
            const savingsRatio = (file.size - processedFile.size) / file.size;
            if (savingsRatio < 0.1) {
              processedFile = file; // 압축 효과가 미미하면 원본 사용
            }
          } catch (error) {
            processedFile = file;
          }
        }

        processedFiles.push(processedFile);
      }

      updateProcessingProgress(100, '완료!');
      return processedFiles;

    } catch (error) {
      showToast('파일 처리 중 오류가 발생했습니다.', 'error');
      return files;
    } finally {
      isProcessing = false;
      setTimeout(() => updateProcessingUI(false), 1000);
    }
  }

  function updateProcessingUI(show) {
    const progressContainer = document.getElementById('processing-progress') || createProgressContainer();
    if (show) {
      progressContainer.classList.remove('hidden');
      progressContainer.style.display = 'block';
    } else {
      progressContainer.classList.add('hidden');
      progressContainer.style.display = 'none';
    }
  }

  function createProgressContainer() {
    let container = document.getElementById('processing-progress');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'processing-progress';
    container.className = 'hidden mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg';
    container.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-blue-800">이미지 최적화 중...</span>
        <span class="text-sm text-blue-600 progress-text"></span>
      </div>
      <div class="w-full bg-blue-200 rounded-full h-2">
        <div class="progress-bar bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
      </div>
    `;

    previewContainer.parentNode.insertBefore(container, previewContainer);
    return container;
  }

  function updateProcessingProgress(progress, text) {
    const container = document.getElementById('processing-progress');
    if (!container) return;

    const progressBar = container.querySelector('.progress-bar');
    const progressText = container.querySelector('.progress-text');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = text;
  }

  // 기존 이미지 초기화
  if (existingImages && existingImages.length > 0) {
    selectedFiles = existingImages.map((img, index) => ({
      id: `existing_${img.id || fileIdCounter++}`,
      type: "existing",
      originalId: img.id,
      url: img.url,
      name: img.name || `기존 이미지 ${index + 1}`,
      size: img.size || 0,
      compressed: false,
      ...img
    }));
  }

  // 파일 검증 함수 - 중복 검증 제거
  function validateFiles(files) {
    const errors = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: 이미지 파일만 업로드할 수 있습니다.`);
        continue;
      }

      const maxSize = compression.enabled ? maxSizeMB * 2 * 1024 * 1024 : maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        const maxSizeDisplay = compression.enabled ? maxSizeMB * 2 : maxSizeMB;
        errors.push(`${file.name}: 파일 크기가 ${maxSizeDisplay}MB를 초과합니다.`);
        continue;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // 미리보기 업데이트 함수
  function updatePreview() {
    // 기존 Sortable 정리
    if (sortableInstance) {
      try {
        sortableInstance.destroy();
      } catch (e) {
        // 무시
      }
      sortableInstance = null;
    }

    // 미리보기 초기화
    previewList.innerHTML = "";

    // 선택된 파일들 렌더링
    selectedFiles.forEach((item, index) => {
      const wrapper = createImageWrapper(item, index);
      previewList.appendChild(wrapper);
    });

    // 추가 버튼
    if (selectedFiles.length < maxFiles && !isProcessing) {
      const addWrapper = createAddButton();
      previewList.appendChild(addWrapper);
    }

    // Sortable 초기화
    initSortable();
    updateFileCount();
    previewContainer.classList.remove("hidden");
    
    // 파일 개수 변경 시마다 검증 실행
    triggerValidation();
  }

  // 이미지 래퍼 생성 함수
  function createImageWrapper(item, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "relative w-full aspect-[3/4] cursor-move bg-gray-100 rounded border";
    wrapper.dataset.fileId = item.id;
    wrapper.dataset.index = index;

    const img = document.createElement("img");
    img.className = "rounded border object-cover w-full h-full pointer-events-none";
    img.alt = item.name || `이미지 ${index + 1}`;

    // 이미지 소스 설정
    if (item.type === "new") {
      if (item.previewUrl) {
        img.src = item.previewUrl;
      } else {
        createImagePreview(item, img);
      }
    } else if (item.type === "existing") {
      img.src = item.url;
      img.onerror = () => {
        img.src = createErrorPlaceholder();
      };
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

  function createImagePreview(item, img) {
    const reader = new FileReader();
    reader.onload = (e) => {
      item.previewUrl = e.target.result;
      img.src = e.target.result;
    };
    reader.onerror = () => {
      img.src = createErrorPlaceholder();
    };
    
    if (item.file) {
      reader.readAsDataURL(item.file);
    }
  }

  function createErrorPlaceholder() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5nlsaDsiJgg7LqY7J6EPC90ZXh0Pjwvc3ZnPg==';
  }

  function addBadges(wrapper, item, index) {
    // 대표 이미지 배지
    if (index === 0) {
      const badge = document.createElement("div");
      badge.className = "absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10";
      badge.textContent = "대표";
      wrapper.appendChild(badge);
    }

    // 압축 배지
    if (item.type === "new" && item.compressed) {
      const compressedBadge = document.createElement("div");
      compressedBadge.className = `absolute ${index === 0 ? 'top-6' : 'top-1'} left-1 bg-green-600 text-white text-xs px-1 py-0.5 rounded z-10`;
      compressedBadge.textContent = "최적화";
      wrapper.appendChild(compressedBadge);
    }

    // 순서 번호 배지
    const orderBadge = document.createElement("div");
    orderBadge.className = "absolute top-1 right-8 bg-gray-800 bg-opacity-80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center z-10";
    orderBadge.textContent = index + 1;
    wrapper.appendChild(orderBadge);
  }

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

  function createDragHandle() {
    const dragHandle = document.createElement("div");
    dragHandle.className = "absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10 cursor-grab active:cursor-grabbing";
    dragHandle.innerHTML = "⋮⋮";
    dragHandle.style.touchAction = 'none';
    return dragHandle;
  }

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
    
    // 클릭 이벤트
    addButton.addEventListener("click", () => {
      if (!isProcessing) {
        cleanFileInput.click();
      }
    });
    
    // 드래그 앤 드롭 지원
    addWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      addWrapper.classList.add('border-blue-400', 'bg-blue-50');
    });
    
    addWrapper.addEventListener('dragleave', (e) => {
      e.preventDefault();
      addWrapper.classList.remove('border-blue-400', 'bg-blue-50');
    });
    
    addWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      addWrapper.classList.remove('border-blue-400', 'bg-blue-50');
      
      if (isProcessing) return;
      
      const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      
      if (files.length === 0) {
        showToast('이미지 파일을 드롭해주세요.', 'warning');
        return;
      }
      
      handleFileSelection(files);
    });
    
    addWrapper.appendChild(addButton);
    return addWrapper;
  }

  // 파일 선택 처리 공통 함수
  function handleFileSelection(newFiles) {
    const remainingSlots = maxFiles - selectedFiles.length;
    
    // 개수 제한 체크 및 사용자 확인
    if (newFiles.length > remainingSlots) {
      if (remainingSlots === 0) {
        showToast(`이미 최대 ${maxFiles}장이 선택되었습니다. 새 이미지를 추가하려면 기존 이미지를 먼저 삭제해주세요.`, 'warning');
        return;
      } else {
        const canUpload = remainingSlots;
        const confirmMessage = `선택한 ${newFiles.length}장 중 ${canUpload}장만 업로드할 수 있습니다.\n(최대 ${maxFiles}장 제한, 현재 ${selectedFiles.length}장 선택됨)\n\n처음 ${canUpload}장을 업로드하시겠습니까?`;
        
        if (!confirm(confirmMessage)) {
          return;
        }
        
        showToast(`${canUpload}장을 업로드합니다. ${newFiles.length - canUpload}장은 제외됩니다.`, 'info');
      }
    }
    
    // 실제 업로드할 파일들 선택
    const filesToAdd = newFiles.slice(0, remainingSlots);
    
    // 파일 검증
    const validation = validateFiles(filesToAdd);
    
    if (!validation.valid) {
      validation.errors.forEach(error => showToast(error, 'warning'));
      return;
    }

    // 비동기 파일 처리
    processFilesAsync(filesToAdd);
  }

  function initSortable() {
    if (selectedFiles.length <= 1 || isProcessing) return;
    if (typeof Sortable === 'undefined') {
      return;
    }

    try {
      sortableInstance = new Sortable(previewList, {
        animation: 200,
        filter: '[data-add-button="true"]',
        preventOnFilter: false,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        fallbackTolerance: 3,
        touchStartThreshold: 5,
        handle: '.cursor-move, .cursor-grab',
        
        onEnd: function(evt) {
          const oldIndex = evt.oldIndex;
          const newIndex = evt.newIndex;
          
          if (evt.item.dataset.addButton === "true") return;
          
          if (oldIndex !== newIndex && 
              oldIndex < selectedFiles.length && 
              newIndex < selectedFiles.length) {
            
            // 배열 순서 변경
            const movedItem = selectedFiles.splice(oldIndex, 1)[0];
            selectedFiles.splice(newIndex, 0, movedItem);
            
            updatePreview();
            updateFormFileInput();
            triggerValidation();
          }
        }
      });
    } catch (error) {
      // 무시
    }
  }

  // 이미지 제거 함수
  function removeImage(fileId) {
    const initialLength = selectedFiles.length;
    
    // 정확한 ID 매칭으로 제거
    selectedFiles = selectedFiles.filter(item => {
      const shouldKeep = item.id !== fileId;
      if (!shouldKeep) {
        // 메모리 정리
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      return shouldKeep;
    });
    
    if (selectedFiles.length !== initialLength) {
      updatePreview();
      updateFormFileInput();
      
      // 파일 제거 후 즉시 검증 실행
      setTimeout(() => {
        triggerValidation();
      }, 100);
    }
  }

  function updateFileCount() {
    if (selectedFiles.length === 0) {
      fileCount.textContent = "선택된 파일 없음";
      fileCount.className = "text-sm text-gray-500";
    } else {
      const compressedCount = selectedFiles.filter(f => f.compressed).length;
      let text = `${selectedFiles.length}개 파일 선택됨 (최대 ${maxFiles}장)`;
      
      if (compressedCount > 0) {
        text += ` · ${compressedCount}개 최적화됨`;
      }
      
      fileCount.textContent = text;
      fileCount.className = "text-sm text-gray-700 font-medium";
    }
  }

  // 폼 파일 입력 업데이트
  function updateFormFileInput() {
    try {
      const dt = new DataTransfer();
      
      // 새로운 파일들만 추가
      selectedFiles
        .filter(f => f.type === "new" && f.file)
        .forEach(f => {
          try {
            dt.items.add(f.file);
          } catch (error) {
            // 무시
          }
        });
      
      cleanFileInput.files = dt.files;
      
    } catch (error) {
      // 무시
    }
  }

  function triggerValidation() {
    // 메인 앱의 검증 로직 호출
    if (window.ddoksangApp?.updateNextButtonState) {
      window.ddoksangApp.updateNextButtonState();
    }
    
    // Step 6에서 추가 검증 (이미지 개수 체크)
    const currentStep = window.ddoksangApp?.currentStep || 0;
    
    if (currentStep === 6) {
      const nextBtn = document.getElementById('nextBtn');
      const fileCount = selectedFiles.length;
      
      if (nextBtn) {
        // 파일이 있으면 버튼 활성화, 없으면 비활성화
        const shouldEnable = fileCount > 0;
        
        if (shouldEnable) {
          nextBtn.disabled = false;
          nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          nextBtn.classList.add('hover:bg-gray-800');
          nextBtn.textContent = '제출하기';
        } else {
          nextBtn.disabled = true;
          nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
          nextBtn.classList.remove('hover:bg-gray-800');
          nextBtn.textContent = '이미지를 업로드해주세요';
        }
      }
    }
    
    // FormUtils를 통한 추가 검증
    if (window.DdoksangFormUtils?.updateButtonState) {
      const fileCount = selectedFiles.length;
      const shouldEnable = currentStep !== 6 || fileCount > 0;
      window.DdoksangFormUtils.updateButtonState('nextBtn', shouldEnable);
    }
  }

  function showToast(message, type = 'info') {
    if (window.DdoksangFormUtils?.showToast) {
      window.DdoksangFormUtils.showToast(message, type);
    }
  }

  // 파일 입력 이벤트 핸들러
  function handleFileInput(event) {
    const newFiles = Array.from(event.target.files);
    
    if (newFiles.length === 0 || isProcessing) {
      return;
    }
    
    // 파일 검증
    const validation = validateFiles(newFiles);
    
    if (!validation.valid) {
      validation.errors.forEach(error => showToast(error, 'warning'));
      // 파일 입력 초기화
      event.target.value = '';
      return;
    }
    
    // 남은 슬롯 계산
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = newFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length < newFiles.length) {
      showToast(`최대 ${maxFiles}개까지만 업로드할 수 있어 ${filesToAdd.length}개만 추가됩니다.`, 'warning');
    }

    // 비동기 파일 처리
    processFilesAsync(filesToAdd).finally(() => {
      // 파일 입력 초기화
      event.target.value = '';
    });
  }

  async function processFilesAsync(filesToAdd) {
    try {
      const processedFiles = await processFiles(filesToAdd);
      
      // 새 파일 객체 생성 - 고유 ID 보장, 중복 허용
      const newFileObjects = processedFiles.map((file, index) => {
        const originalFile = filesToAdd[index];
        const wasCompressed = file !== originalFile;
        
        return {
          id: `new_${Date.now()}_${fileIdCounter++}_${Math.random().toString(36).substr(2, 9)}`,
          type: "new",
          file: file,
          name: file.name,
          size: file.size,
          previewUrl: null,
          compressed: wasCompressed
        };
      });
      
      // 기존 배열에 추가 - 중복 허용
      selectedFiles = [...selectedFiles, ...newFileObjects];
      
      updatePreview();
      updateFormFileInput();
      
      // 파일 추가 후 즉시 검증 실행
      setTimeout(() => {
        triggerValidation();
      }, 100);
      
    } catch (error) {
      showToast('파일 처리 중 오류가 발생했습니다.', 'error');
    }
  }

  // 이벤트 리스너 등록
  cleanFileInput.addEventListener("change", handleFileInput);

  // 폼 제출 이벤트
  if (form) {
    form.addEventListener("submit", function(e) {
      // 제거된 기존 이미지 ID 처리
      if (existingImages && existingImages.length > 0) {
        const existingIds = existingImages.map(img => img.id);
        const currentExistingIds = selectedFiles
          .filter(f => f.type === "existing")
          .map(f => f.originalId);
        
        const removedIds = existingIds.filter(id => !currentExistingIds.includes(id));
        
        if (removedIds.length > 0) {
          const removedInput = document.createElement("input");
          removedInput.type = "hidden";
          removedInput.name = "removed_image_ids";
          removedInput.value = removedIds.join(",");
          form.appendChild(removedInput);
        }
      }
      
      updateFormFileInput();
    });
  }

  // 초기 상태 설정
  updatePreview();

  // API 객체 생성
  const apiObject = {
    isInitialized: true,
    getFiles: () => selectedFiles.map(f => f.type === "new" ? f.file : f),
    getNewFiles: () => selectedFiles.filter(f => f.type === "new").map(f => f.file),
    getFileCount: () => selectedFiles.length,
    getSelectedFiles: () => [...selectedFiles],
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
          // 무시
        }
        sortableInstance = null;
      }
      updatePreview();
      updateFormFileInput();
      triggerValidation();
    },
    refresh: () => {
      updatePreview();
      updateFormFileInput();
    },
    getCompressionStats: () => ({
      total: selectedFiles.length,
      compressed: selectedFiles.filter(f => f.compressed).length,
      compressionEnabled: compression.enabled
    }),
    debug: () => ({
      selectedFiles: selectedFiles,
      fileIdCounter: fileIdCounter,
      hasSortable: !!sortableInstance,
      isProcessing: isProcessing,
      fileInputId: fileInputId,
      elementsFound: {
        fileInput: !!cleanFileInput,
        fileCount: !!fileCount,
        previewContainer: !!previewContainer,
        previewList: !!previewList,
        form: !!form
      }
    })
  };

  return apiObject;
};

// 정리 함수
window.cleanupImageUploadHandlers = function() {
  if (window.ddoksangImageUploader) {
    try {
      window.ddoksangImageUploader.clear();
    } catch (e) {
      // 무시
    }
    window.ddoksangImageUploader = null;
  }
  
  // Sortable 인스턴스 정리
  const previewList = document.getElementById('image-preview-list');
  if (previewList && previewList.__sortable) {
    try {
      previewList.__sortable.destroy();
    } catch (e) {
      // 무시
    }
  }
};

// 스타일 정의
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
  
  #processing-progress {
    transition: all 0.3s ease;
  }
  
  #processing-progress .progress-bar {
    transition: width 0.3s ease;
  }
  
  @media (max-width: 768px) {
    .cursor-move, .cursor-grab {
      cursor: grab;
      touch-action: none;
    }
    
    .cursor-move:active, .cursor-grab:active {
      cursor: grabbing;
    }
    
    .sortable-chosen {
      transform: scale(1.1);
    }
    
    #processing-progress {
      padding: 0.75rem;
      margin-bottom: 1rem;
    }
  }
  
  .cursor-grab:hover {
    background-color: rgba(0, 0, 0, 0.9) !important;
    transform: scale(1.1);
  }
  
  img[src=""] {
    background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%), 
                linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, #f3f4f6 75%), 
                linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
    background-size: 20px 20px;
    background-position: 0;
  }
`;

// 스타일 주입
if (!document.getElementById('ddoksang-image-upload-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'ddoksang-image-upload-styles';
  styleElement.textContent = imageUploadCSS;
  document.head.appendChild(styleElement);
}