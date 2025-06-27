// static/js/post_form/image_preview.js - 수정된 버전
export function setupImagePreview(existingImages = []) {
    console.log('Setting up image preview with existing images:', existingImages);
    
    const fileInput = document.getElementById("image-upload");
    const fileCount = document.getElementById("file-count");
    const previewContainer = document.getElementById("image-preview-container");
    const previewList = document.getElementById("image-preview-list");
    const form = document.getElementById("edit-form") || document.getElementById("create-form");

    if (!fileInput || !previewContainer || !previewList || !form) {
        console.error('Required elements not found for image preview');
        return;
    }

    // 기존 이미지를 selectedFiles에 초기값으로 담기
    let selectedFiles = existingImages.length
        ? existingImages.map(img => ({ type: "existing", ...img }))
        : [];

    console.log('Initial selectedFiles:', selectedFiles);

    function updatePreview() {
        // 기존 미리보기를 초기화
        previewList.innerHTML = "";

        // 선택된 이미지들 렌더링
        selectedFiles.forEach((item, index) => {
            const wrapper = document.createElement("div");
            wrapper.className = "relative w-full aspect-square";
            wrapper.dataset.index = index;

            const img = document.createElement("img");
            img.className = "rounded border object-cover w-full h-full";

            if (item.type === "new") {
                // 새로 업로드된 이미지 파일은 FileReader로 읽어서 미리보기
                const reader = new FileReader();
                reader.onload = (e) => { img.src = e.target.result; };
                reader.readAsDataURL(item.file);
            } else {
                // 기존 이미지 URL 사용
                img.src = item.url;
            }

            // 삭제 버튼
            const closeBtn = document.createElement("button");
            closeBtn.type = "button";  // 중요: form submit 방지
            closeBtn.innerHTML = "&times;";
            closeBtn.className = `
                absolute top-1 right-1 w-6 h-6 rounded-full
                bg-black bg-opacity-60 flex items-center justify-center
                text-white text-sm hover:bg-opacity-80
            `;
            closeBtn.addEventListener("click", (e) => {
                e.preventDefault();
                selectedFiles.splice(index, 1);
                updatePreview();
            });

            wrapper.appendChild(img);
            wrapper.appendChild(closeBtn);
            previewList.appendChild(wrapper);
        });

        // ➕ 새 이미지 추가 버튼 (10장 미만일 때만)
        if (selectedFiles.length < 10) {
            const addBox = document.createElement("div");
            addBox.className = `
                flex items-center justify-center bg-gray-100 hover:bg-gray-200
                rounded border border-gray-300 aspect-square w-full relative
                order-last cursor-pointer
            `;
            addBox.innerHTML = '<span class="text-3xl text-gray-400">+</span>';
            addBox.addEventListener("click", () => fileInput.click());
            previewList.appendChild(addBox);
        }

        // 파일 개수 표시
        if (fileCount) {
            fileCount.textContent = selectedFiles.length > 0
                ? `${selectedFiles.length}개 파일 선택됨 (최대 10장)`
                : "선택된 파일 없음";
        }

        // 미리보기 컨테이너 숨김/표시
        previewContainer.classList.toggle("hidden", selectedFiles.length === 0);
        
        console.log('Preview updated, selectedFiles count:', selectedFiles.length);
    }

    // Sortable.js로 드래그 앤 드롭 정렬 처리 (Sortable이 로드된 경우에만)
    if (typeof Sortable !== 'undefined') {
        new Sortable(previewList, {
            animation: 150,
            filter: '.cursor-pointer', // + 버튼은 드래그 제외
            onEnd: () => {
                // 드래그 앤 드롭으로 순서를 바꾼 경우, selectedFiles 순서 재정렬
                const newOrder = Array.from(previewList.children)
                    .filter(el => el.querySelector("img") && !el.classList.contains('cursor-pointer'))
                    .map(el => selectedFiles[parseInt(el.dataset.index, 10)]);
                selectedFiles = newOrder;
                updatePreview();
            }
        });
    }

    // 파일 input에서 새 파일 선택시
    fileInput.addEventListener("change", function () {
        const newFiles = Array.from(this.files).map(file => ({ type: "new", file }));
        if (selectedFiles.length + newFiles.length > 10) {
            alert("최대 10장까지만 업로드할 수 있습니다.");
            return;
        }
        selectedFiles = selectedFiles.concat(newFiles);
        updatePreview();
    });

    // form 제출 시 처리
    form.addEventListener("submit", function () {
        console.log('Form submit - processing images');
        
        // 기존 이미지 중 삭제된 이미지 ID를 hidden input으로 추가
        if (existingImages.length) {
            const removedIds = existingImages
                .filter(img => !selectedFiles.find(f => f.type === "existing" && f.id === img.id))
                .map(img => img.id);

            console.log('Removed image IDs:', removedIds);

            if (removedIds.length > 0) {
                // 기존 removed_image_ids input 제거
                const existingRemovedInput = form.querySelector('input[name="removed_image_ids"]');
                if (existingRemovedInput) {
                    existingRemovedInput.remove();
                }
                
                const removedInput = document.createElement("input");
                removedInput.type = "hidden";
                removedInput.name = "removed_image_ids";
                removedInput.value = removedIds.join(",");
                form.appendChild(removedInput);
            }
        }

        // 새로 업로드된 파일만 fileInput.files에 다시 담아서 전송
        const dt = new DataTransfer();
        selectedFiles
            .filter(f => f.type === "new")
            .forEach(f => dt.items.add(f.file));
        fileInput.files = dt.files;
        
        console.log('Final file count for upload:', fileInput.files.length);
    });

    // 초기 미리보기 렌더링
    updatePreview();
}