export function setupImageUpload() {
  const fileInput = document.getElementById("image-upload");
  const fileCount = document.getElementById("file-count");
  const previewContainer = document.getElementById("image-preview-container");
  const previewList = document.getElementById("image-preview-list");
  const originalImageSection = document.getElementById("original-image");
  const form = document.getElementById("create-form") || document.getElementById("edit-form");

  if (!fileInput || !previewContainer || !previewList) return;

  let selectedFiles = [];

  function updatePreview() {
    previewList.innerHTML = "";

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const wrapper = document.createElement("div");
        wrapper.className = "relative w-full aspect-square";
        wrapper.dataset.index = index;

        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "rounded border object-cover w-full h-full";

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.className = `
          absolute top-1 right-1 
          w-6 h-6 rounded-full bg-black bg-opacity-60 
          flex items-center justify-center 
          text-white text-sm hover:bg-opacity-80
        `;
        closeBtn.addEventListener("click", () => {
          selectedFiles.splice(index, 1);
          updatePreview();
        });

        wrapper.appendChild(img);
        wrapper.appendChild(closeBtn);
        previewList.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });

    // ➕ 추가 박스
    const addBox = document.createElement("div");
    addBox.className = `
      flex items-center justify-center 
      bg-gray-100 hover:bg-gray-200 
      rounded border border-gray-300 
      aspect-square w-full relative order-last cursor-pointer
    `;
    addBox.innerHTML = '<span class="text-3xl text-gray-400">+</span>';
    addBox.addEventListener("click", () => fileInput.click());
    previewList.appendChild(addBox);

    if (fileCount) {
      fileCount.textContent = selectedFiles.length > 0
        ? `${selectedFiles.length}개 파일 선택됨 (최대 10장)`
        : "선택된 파일 없음";
    }

    previewContainer.classList.toggle("hidden", selectedFiles.length === 0);
    if (originalImageSection) {
      originalImageSection.classList.toggle("hidden", selectedFiles.length > 0);
    }
  }

  // ✅ Sortable.js를 통한 드래그앤드롭
  new Sortable(previewList, {
    animation: 150,
    onEnd: function () {
      const newOrder = Array.from(previewList.children)
        .filter(el => el.querySelector("img"))
        .map(el => {
          const idx = parseInt(el.dataset.index, 10);
          return selectedFiles[idx];
        });
      selectedFiles = newOrder;
      updatePreview();
    }
  });

  // ✅ 파일 선택 이벤트
  fileInput.addEventListener("change", function () {
    const newFiles = Array.from(this.files);
    if (selectedFiles.length + newFiles.length > 10) {
      alert("최대 10장까지만 업로드할 수 있습니다.");
      return;
    }
    selectedFiles = selectedFiles.concat(newFiles);
    updatePreview();
  });

  // ✅ form submit 전에 input.files를 재정렬해서 덮어쓰기
  form.addEventListener("submit", function () {
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
  });
}
