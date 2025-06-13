// ddoksang_image_upload.js - 이미지 압축 기능 포함 버전
// 🗜️ 자동 이미지 압축으로 품질 유지하면서 용량 최적화

window.setupDdoksangImageUpload = function({
  fileInputId = "image-upload",
  fileCountId = "file-count", 
  previewContainerId = "image-preview-container",
  previewListId = "image-preview-list",
  formId = "multiStepForm",
  maxFiles = 10,
  maxSizeMB = 5,
  existingImages = [],
  // 🗜️ 압축 설정
  compression = {
    enabled: true,
    maxWidth: 1920,
    maxHeight: 1440,
    quality: 0.85,
    autoCompress: true // 2MB 이상 자동 압축
  }
}) {
  const fileInput = document.getElementById(fileInputId);
  const fileCount = document.getElementById(fileCountId);
  const previewContainer = document.getElementById(previewContainerId);
  const previewList = document.getElementById(previewListId);
  const form = document.getElementById(formId);

  if (!fileInput || !fileCount || !previewContainer || !previewList) {
    console.warn('이미지 업로드: 필수 요소를 찾을 수 없습니다.');
    return null;
  }

  let selectedFiles = [];
  let fileIdCounter = 0;
  let sortableInstance = null;
  let isProcessing = false; // 🗜️ 압축 진행 상태

  // 🗜️ 이미지 압축 함수
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
          // 비율 유지하면서 크기 계산
          const { width, height } = calculateOptimalDimensions(
            img.naturalWidth, 
            img.naturalHeight, 
            maxWidth, 
            maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // 고품질 렌더링 설정
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);

          // JPEG로 압축 (PNG는 품질 손실 없이 압축)
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const outputQuality = file.type === 'image/png' ? 1.0 : quality;

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('이미지 압축 실패'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now()
            });

            // 🗜️ 압축 결과 로깅
            const originalSize = file.size;
            const compressedSize = compressedFile.size;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100);
            
            console.log(`🗜️ 압축 완료: ${file.name}`);
            console.log(`📊 ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio.toFixed(1)}% 절약)`);
            console.log(`📐 해상도: ${img.naturalWidth}×${img.naturalHeight} → ${width}×${height}`);

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

  // 🗜️ 최적 해상도 계산
  function calculateOptimalDimensions(origWidth, origHeight, maxWidth, maxHeight) {
    let width = origWidth;
    let height = origHeight;

    // 이미 충분히 작으면 그대로 유지
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }

    // 비율 유지하면서 크기 조정
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);

    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio)
    };
  }

  // 🗜️ 압축 필요 여부 판단
  function shouldCompress(file) {
    if (!compression.enabled) return false;
    
    // 2MB 이상이면 자동 압축
    const autoCompressThreshold = 2 * 1024 * 1024; // 2MB
    return file.size > autoCompressThreshold;
  }

  // 🗜️ 파일 처리 (압축 포함)
  async function processFiles(files) {
    const processedFiles = [];
    
    try {
      isProcessing = true;
      updateProcessingUI(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 진행률 표시
        const progress = ((i + 1) / files.length) * 100;
        updateProcessingProgress(progress, `${file.name} 처리 중...`);

        let processedFile = file;

        // 🗜️ 이미지 파일이고 압축이 필요한 경우
        if (file.type.startsWith('image/') && shouldCompress(file)) {
          try {
            console.log(`🗜️ 압축 시작: ${file.name} (${formatFileSize(file.size)})`);
            processedFile = await compressImage(file);
            
            // 압축 효과가 있는 경우만 사용 (10% 이상 절약)
            const savingsRatio = (file.size - processedFile.size) / file.size;
            if (savingsRatio < 0.1) {
              console.log(`📊 압축 효과 미미 (${(savingsRatio * 100).toFixed(1)}%), 원본 사용`);
              processedFile = file;
            }
          } catch (error) {
            console.warn(`⚠️ 압축 실패: ${file.name}, 원본 사용`, error);
            processedFile = file;
          }
        }

        processedFiles.push(processedFile);
      }

      updateProcessingProgress(100, '완료!');
      return processedFiles;

    } catch (error) {
      console.error('파일 처리 중 오류:', error);
      showToast('파일 처리 중 오류가 발생했습니다.', 'error');
      return files; // 실패 시 원본 파일들 반환
    } finally {
      isProcessing = false;
      setTimeout(() => updateProcessingUI(false), 1000);
    }
  }

  // 🗜️ 처리 중 UI 업데이트
  function updateProcessingUI(show) {
    const progressContainer = document.getElementById('processing-progress') || createProgressContainer();
    progressContainer.style.display = show ? 'block' : 'none';
    
    if (!show) {
      progressContainer.querySelector('.progress-bar').style.width = '0%';
      progressContainer.querySelector('.progress-text').textContent = '';
    }
  }

  // 🗜️ 진행률 컨테이너 생성
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

  // 🗜️ 진행률 업데이트
  function updateProcessingProgress(progress, text) {
    const container = document.getElementById('processing-progress');
    if (!container) return;

    const progressBar = container.querySelector('.progress-bar');
    const progressText = container.querySelector('.progress-text');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = text;

    // 처리 중일 때 컨테이너 표시
    if (progress > 0) {
      container.classList.remove('hidden');
      container.style.display = 'block';
    }
  }

  // 기존 이미지 초기화
  if (existingImages.length) {
    selectedFiles = existingImages.map(img => ({
      id: `existing_${img.id || fileIdCounter++}`,
      type: "existing",
      originalId: img.id,
      url: img.url,
      name: img.name || `기존 이미지 ${img.id}`,
      ...img
    }));
  }

  // 파일 검증 함수
  function validateFiles(files) {
    const errors = [];
    
    if (selectedFiles.length + files.length > maxFiles) {
      errors.push(`최대 ${maxFiles}개의 이미지만 업로드할 수 있습니다. (현재: ${selectedFiles.length}개)`);
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: 이미지 파일만 업로드할 수 있습니다.`);
        continue;
      }

      // 🗜️ 압축을 고려한 크기 제한 (원본 기준 더 큰 용량 허용)
      const maxSize = compression.enabled ? maxSizeMB * 2 * 1024 * 1024 : maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        const maxSizeDisplay = compression.enabled ? maxSizeMB * 2 : maxSizeMB;
        errors.push(`${file.name}: 파일 크기가 ${maxSizeDisplay}MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }

      // 중복 파일 검증
      const isDuplicate = selectedFiles.some(item => 
        item.type === "new" && 
        item.file.name === file.name && 
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
      );

      if (isDuplicate) {
        errors.push(`${file.name}: 이미 선택된 파일입니다.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 미리보기 업데이트 함수
  function updatePreview() {
    console.log('🔄 미리보기 업데이트 시작:', selectedFiles.length);
    
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }

    previewList.innerHTML = "";

    selectedFiles.forEach((item, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "relative w-full aspect-[3/4] cursor-move bg-gray-100 rounded border";
      wrapper.dataset.fileId = item.id;
      wrapper.dataset.index = index;

      const img = document.createElement("img");
      img.className = "rounded border object-cover w-full h-full pointer-events-none";
      img.alt = item.name || `이미지 ${index + 1}`;

      if (item.type === "new") {
        if (item.previewUrl) {
          img.src = item.previewUrl;
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            item.previewUrl = e.target.result;
            img.src = e.target.result;
          };
          reader.onerror = () => {
            console.error('이미지 로딩 실패:', item.file.name);
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5nlsaDsiJgg7LqY7J6EPC90ZXh0Pjwvc3ZnPg==';
          };
          reader.readAsDataURL(item.file);
        }
      } else if (item.type === "existing") {
        img.src = item.url;
        img.onerror = () => {
          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5nlsaDsiJgg7LqY7J6EPC90ZXh0Pjwvc3ZnPg==';
        };
      }

      // 대표 이미지 배지
      if (index === 0) {
        const badge = document.createElement("div");
        badge.className = "absolute top-1 left-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded z-10";
        badge.textContent = "대표";
        wrapper.appendChild(badge);
      }

      // 🗜️ 압축된 파일 표시
      if (item.type === "new" && item.compressed) {
        const compressedBadge = document.createElement("div");
        compressedBadge.className = "absolute top-1 left-1 bg-green-600 text-white text-xs px-1 py-0.5 rounded z-10";
        compressedBadge.textContent = "최적화됨";
        if (index === 0) {
          compressedBadge.className = "absolute top-6 left-1 bg-green-600 text-white text-xs px-1 py-0.5 rounded z-10";
        }
        wrapper.appendChild(compressedBadge);
      }

      // 순서 번호 배지
      const orderBadge = document.createElement("div");
      orderBadge.className = "absolute top-1 right-8 bg-gray-800 bg-opacity-80 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center z-10";
      orderBadge.textContent = index + 1;
      wrapper.appendChild(orderBadge);

      // 삭제 버튼
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
        removeImage(item.id);
      });

      // 모바일용 터치 드래그 핸들
      const dragHandle = document.createElement("div");
      dragHandle.className = "absolute bottom-1 right-1 bg-gray-800 bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10 cursor-grab active:cursor-grabbing";
      dragHandle.innerHTML = "⋮⋮";
      dragHandle.style.touchAction = 'none';
      wrapper.appendChild(dragHandle);

      wrapper.appendChild(img);
      wrapper.appendChild(closeBtn);
      previewList.appendChild(wrapper);
    });

    // "+" 추가 버튼
    if (selectedFiles.length < maxFiles) {
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
        if (!isProcessing) {
          fileInput.click();
        }
      });
      addWrapper.appendChild(addButton);
      previewList.appendChild(addWrapper);
    }

    // Sortable 초기화 (모바일 터치 지원)
    if (selectedFiles.length > 1 && !isProcessing) {
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
              
              const movedItem = selectedFiles.splice(oldIndex, 1)[0];
              selectedFiles.splice(newIndex, 0, movedItem);
              
              console.log('✅ 이미지 순서 변경 완료:', { 
                from: oldIndex, 
                to: newIndex,
                item: movedItem.name || movedItem.file?.name 
              });
              
              updatePreview();
              updateFormFileInput();
              triggerValidation();
            }
          }
        });
      } catch (error) {
        console.error('❌ Sortable 초기화 실패:', error);
      }
    }

    updateFileCount();
    previewContainer.classList.remove("hidden");
  }

  // 이미지 제거 함수
  function removeImage(fileId) {
    console.log('🗑️ 이미지 제거 시도:', fileId);
    
    const beforeLength = selectedFiles.length;
    selectedFiles = selectedFiles.filter(item => item.id !== fileId);
    const afterLength = selectedFiles.length;
    
    if (beforeLength !== afterLength) {
      console.log('✅ 이미지 제거 완료:', { beforeLength, afterLength });
      updatePreview();
      updateFormFileInput();
      triggerValidation();
    }
  }

  // 파일 개수 표시
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
      const newFiles = selectedFiles.filter(f => f.type === "new");
      
      newFiles.forEach(f => {
        if (f.file) {
          dt.items.add(f.file);
        }
      });
      
      fileInput.files = dt.files;
    } catch (error) {
      console.error('❌ 폼 파일 입력 업데이트 실패:', error);
    }
  }

  // 폼 검증 트리거
  function triggerValidation() {
    if (window.ddoksangApp?.updateNextButtonState) {
      window.ddoksangApp.updateNextButtonState();
    }
  }

  // 파일 크기 포맷팅
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 토스트 메시지
  function showToast(message, type = 'info') {
    if (window.DdoksangFormUtils?.showToast) {
      window.DdoksangFormUtils.showToast(message, type);
    } else {
      console.log(`Toast [${type.toUpperCase()}]: ${message}`);
    }
  }

  // 🗜️ 파일 input 이벤트 리스너 (압축 포함)
  fileInput.addEventListener("change", async function(e) {
    const newFiles = Array.from(this.files);
    
    if (newFiles.length === 0 || isProcessing) return;
    
    console.log('📁 새 파일 선택:', newFiles.length);
    
    // 파일 검증
    const validation = validateFiles(newFiles);
    
    if (!validation.valid) {
      validation.errors.forEach(error => showToast(error, 'warning'));
      this.value = '';
      return;
    }
    
    // 남은 슬롯 계산
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = newFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length < newFiles.length) {
      showToast(`최대 ${maxFiles}개까지만 업로드할 수 있어 ${filesToAdd.length}개만 추가됩니다.`, 'warning');
    }

    try {
      // 🗜️ 파일 처리 (압축 포함)
      const processedFiles = await processFiles(filesToAdd);
      
      // 새 파일 객체 생성
      const newFileObjects = processedFiles.map(file => ({
        id: `new_${Date.now()}_${fileIdCounter++}`,
        type: "new",
        file: file,
        name: file.name,
        size: file.size,
        previewUrl: null,
        compressed: file !== filesToAdd.find(f => f.name === file.name) // 압축 여부 확인
      }));
      
      selectedFiles = selectedFiles.concat(newFileObjects);
      
      console.log('✅ 새 파일 추가 완료:', newFileObjects.length);
      
      // 압축 완료 메시지
      const compressedCount = newFileObjects.filter(f => f.compressed).length;
      if (compressedCount > 0) {
        showToast(`${compressedCount}개 이미지가 최적화되었습니다.`, 'success');
      }
      
      updatePreview();
      updateFormFileInput();
      triggerValidation();
      
    } catch (error) {
      console.error('파일 처리 실패:', error);
      showToast('파일 처리 중 오류가 발생했습니다.', 'error');
    }
    
    this.value = '';
  });

  // 폼 제출 이벤트 리스너
  if (form) {
    form.addEventListener("submit", function(e) {
      console.log('📤 폼 제출 준비');
      
      // 제거된 기존 이미지 ID 처리
      if (existingImages.length) {
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
      
      console.log('✅ 폼 제출 데이터 준비 완료:', {
        totalImages: selectedFiles.length,
        newImages: selectedFiles.filter(f => f.type === "new").length,
        compressedImages: selectedFiles.filter(f => f.compressed).length,
        existingImages: selectedFiles.filter(f => f.type === "existing").length
      });
    });
  }

  // 초기 상태 설정
  updatePreview();

  // 외부 API 반환
  return {
    getFiles: () => selectedFiles.map(f => f.type === "new" ? f.file : f),
    getNewFiles: () => selectedFiles.filter(f => f.type === "new").map(f => f.file),
    getFileCount: () => selectedFiles.length,
    getFilesOrder: () => selectedFiles.map((f, index) => ({ 
      ...f, 
      order: index,
      isMain: index === 0 
    })),
    getSelectedFiles: () => [...selectedFiles],
    removeFileById: (fileId) => removeImage(fileId),
    clear: () => {
      selectedFiles = [];
      if (sortableInstance) {
        sortableInstance.destroy();
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
    // 🗜️ 압축 관련 API
    getCompressionStats: () => ({
      total: selectedFiles.length,
      compressed: selectedFiles.filter(f => f.compressed).length,
      compressionEnabled: compression.enabled
    }),
    debug: () => ({
      selectedFiles: selectedFiles,
      fileIdCounter: fileIdCounter,
      hasSortable: !!sortableInstance,
      isProcessing: isProcessing
    })
  };
};

// 🗜️ CSS 스타일 (압축 관련 포함)
const compressionCSS = `
  /* Sortable 관련 스타일 */
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
  
  /* 🗜️ 압축 진행률 표시 */
  #processing-progress {
    transition: all 0.3s ease;
  }
  
  #processing-progress .progress-bar {
    transition: width 0.3s ease;
  }
  
  /* 🗜️ 최적화됨 배지 스타일 */
  .badge-optimized {
    background: linear-gradient(45deg, #10b981, #059669);
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
  }
  
  /* 모바일 터치 개선 */
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
    
    /* 🗜️ 모바일에서 진행률 표시 개선 */
    #processing-progress {
      padding: 0.75rem;
      margin-bottom: 1rem;
    }
    
    #processing-progress .progress-text {
      font-size: 0.75rem;
    }
  }
  
  /* 드래그 핸들 개선 */
  .cursor-grab:hover {
    background-color: rgba(0, 0, 0, 0.9) !important;
    transform: scale(1.1);
  }
  
  /* 🗜️ 이미지 로딩 상태 개선 */
  img[src=""] {
    background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%), 
                linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), 
                linear-gradient(45deg, transparent 75%, #f3f4f6 75%), 
                linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    animation: loading 1s linear infinite;
  }
  
  @keyframes loading {
    0% { background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }
    100% { background-position: 20px 20px, 20px 30px, 30px 10px, 10px 20px; }
  }
  
  /* 🗜️ 압축 완료 애니메이션 */
  @keyframes compress-success {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  .compress-success {
    animation: compress-success 0.5s ease-in-out;
  }
  
  /* 파일 카운터 스타일 개선 */
  #file-count {
    transition: all 0.3s ease;
  }
  
  #file-count.updated {
    color: #059669;
    font-weight: 600;
  }
`;

// 스타일 추가 (한 번만)
if (!document.querySelector('#ddoksang-image-upload-compression-styles')) {
  const style = document.createElement('style');
  style.id = 'ddoksang-image-upload-compression-styles';
  style.textContent = compressionCSS;
  document.head.appendChild(style);
}

// 🗜️ 자동 초기화 함수 (압축 기능 포함)
function autoInitImageUpload() {
  console.log('🖼️ 이미지 업로드 자동 초기화 시도 (압축 기능 포함)...');
  
  const requiredElements = [
    'image-upload',
    'file-count',
    'image-preview-container',
    'image-preview-list'
  ];
  
  const allElementsExist = requiredElements.every(id => document.getElementById(id));
  
  if (allElementsExist && !window.ddoksangImageUploader) {
    console.log('🚀 이미지 업로드 초기화 실행 (압축 활성화)');
    
    try {
      window.ddoksangImageUploader = window.setupDdoksangImageUpload({
        fileInputId: "image-upload",
        fileCountId: "file-count", 
        previewContainerId: "image-preview-container",
        previewListId: "image-preview-list",
        formId: "multiStepForm",
        maxFiles: 10,
        maxSizeMB: 5,
        // 🗜️ 압축 설정
        compression: {
          enabled: true,
          maxWidth: 1920,     // Full HD 해상도
          maxHeight: 1440,    // 충분한 품질
          quality: 0.85,      // 높은 품질 (85%)
          autoCompress: true  // 2MB 이상 자동 압축
        }
      });
      
      console.log('✅ 이미지 업로드 초기화 완료 (압축 기능 활성화)');
      console.log('🗜️ 압축 설정:', {
        enabled: true,
        threshold: '2MB 이상',
        maxResolution: '1920×1440',
        quality: '85%'
      });
      
      return true;
    } catch (error) {
      console.error('❌ 이미지 업로드 초기화 실패:', error);
      return false;
    }
  }
  
  console.log('⏳ 초기화 조건 미충족:', {
    elementsExist: allElementsExist,
    alreadyInitialized: !!window.ddoksangImageUploader
  });
  return false;
}

// 🗜️ 압축 통계 표시 함수 (디버깅/모니터링용)
function showCompressionStats() {
  if (!window.ddoksangImageUploader) {
    console.log('❌ 이미지 업로더가 초기화되지 않았습니다.');
    return;
  }
  
  const stats = window.ddoksangImageUploader.getCompressionStats();
  console.log('📊 압축 통계:', stats);
  
  if (stats.compressed > 0) {
    const compressionRate = (stats.compressed / stats.total * 100).toFixed(1);
    console.log(`🗜️ ${stats.total}개 중 ${stats.compressed}개 압축됨 (${compressionRate}%)`);
  }
}

// DOMContentLoaded에서 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 ddoksang_image_upload.js DOM 로드됨 (압축 기능 포함)');
  
  // 즉시 시도
  autoInitImageUpload();
  
  // 1초 후 재시도
  setTimeout(() => {
    if (!window.ddoksangImageUploader) {
      console.log('🔄 1초 후 재시도...');
      autoInitImageUpload();
    }
  }, 1000);
  
  // 3초 후 마지막 시도
  setTimeout(() => {
    if (!window.ddoksangImageUploader) {
      console.log('🔄 3초 후 마지막 시도...');
      autoInitImageUpload();
    }
  }, 3000);
  
  // 🗜️ 개발 환경에서 압축 통계 주기적 표시
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setInterval(() => {
      if (window.ddoksangImageUploader) {
        showCompressionStats();
      }
    }, 30000); // 30초마다
  }
});

// 전역에서 수동 초기화 가능
window.initDdoksangImageUpload = autoInitImageUpload;

// 🗜️ 압축 통계 전역 함수로 노출
window.showCompressionStats = showCompressionStats;

// 🗜️ 사용자 압축 설정 변경 함수 (고급 사용자용)
window.updateCompressionSettings = function(newSettings) {
  if (!window.ddoksangImageUploader) {
    console.error('❌ 이미지 업로더가 초기화되지 않았습니다.');
    return false;
  }
  
  // 설정 업데이트 로직 (필요 시 구현)
  console.log('🔧 압축 설정 업데이트:', newSettings);
  return true;
};