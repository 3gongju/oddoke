document.addEventListener("DOMContentLoaded", () => {
  const faqButton = document.getElementById('faqButton');
  const faqModal = document.getElementById('faqModal');
  const closeModal = document.getElementById('closeModal');
  const questionSection = document.getElementById('questionSection');
  const answerSection = document.getElementById('answerSection');
  const backBtn = document.getElementById('backBtn');

  // ✅ FAQ 열고 닫기
  faqButton.addEventListener("click", () => {
    faqModal.classList.toggle("hidden");
  });

  closeModal.addEventListener("click", () => {
    faqModal.classList.add("hidden");
  });

  // ✅ 질문 선택
  document.querySelectorAll(".faq-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      questionSection.classList.add("hidden");
      answerSection.classList.remove("hidden");
      document.querySelectorAll(".faq-answer").forEach(el => el.classList.add("hidden"));
      target.classList.remove("hidden");
    });
  });

  // ✅ 돌아가기
  backBtn.addEventListener("click", () => {
    questionSection.classList.remove("hidden");
    answerSection.classList.add("hidden");
    document.querySelectorAll(".faq-answer").forEach(el => el.classList.add("hidden"));
  });

  // ✅ 드래그 이동 기능
  let offsetX, offsetY, isDragging = false;

  faqButton.addEventListener("mousedown", (e) => {
    isDragging = true;
    const rect = faqButton.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    faqButton.style.position = "absolute";
    faqModal.style.position = "absolute";
    faqButton.style.zIndex = 1000;
    faqModal.style.zIndex = 999;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    faqButton.style.left = `${x}px`;
    faqButton.style.top = `${y}px`;
    faqButton.style.bottom = "auto";
    faqButton.style.right = "auto";

    faqModal.style.left = `${x}px`;
    faqModal.style.top = `${y - faqModal.offsetHeight - 20}px`; // 버튼 위에 위치
    faqModal.style.bottom = "auto";
    faqModal.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
});
