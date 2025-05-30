// ✅ reply-toggle-btn 클릭 시 대댓글 입력 폼 열기/닫기 (이벤트 위임 방식)
document.addEventListener("click", function (e) {
  if (e.target.matches(".reply-toggle-btn")) {
    const commentId = e.target.dataset.commentId;
    const form = document.getElementById(`reply-form-${commentId}`);
    if (form) {
      form.classList.toggle("hidden");
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // ✅ 댓글/대댓글 작성 처리
  document.querySelectorAll("form[id^='comment-form']").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const url = form.getAttribute("action");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-CSRFToken": form.querySelector("[name=csrfmiddlewaretoken]").value,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: formData,
      });

      if (response.ok) {
        const html = await response.text();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = html;

        const newComment = wrapper.querySelector(".comment-item");

        const isReply = form.id !== "comment-form-root";
        let targetList;

        if (isReply) {
          const parentItem = form.closest(".comment-item");
          targetList = parentItem.querySelector(".comment-list");

          if (!targetList) {
            targetList = document.createElement("div");
            targetList.className = "comment-list space-y-2 ml-6 mt-2";
            parentItem.appendChild(targetList);
          }
        } else {
          targetList = document.querySelector(".comment-list");
        }

        if (newComment && targetList) {
          targetList.appendChild(newComment);
        }

        form.reset();

        // if (isReply) {
        //   form.classList.add("hidden");
        // }

        // ✅ 새로 삽입된 댓글에도 삭제 이벤트 바인딩
        bindDeleteButtons(newComment);

      } else {
        alert("댓글 등록에 실패했습니다.");
      }
    });
  });

  // ✅ 삭제 버튼 바인딩 함수 정의
  function bindDeleteButtons(scope = document) {
    scope.querySelectorAll(".delete-comment-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const confirmed = confirm("댓글을 삭제하시겠습니까?");
        if (!confirmed) return;

        const url = btn.dataset.deleteUrl;
        const commentItem = btn.closest(".comment-item");

        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "X-CSRFToken": csrfToken,
            "X-Requested-With": "XMLHttpRequest"
          }
        });

        if (response.ok) {
          commentItem.remove();
        } else {
          alert("댓글 삭제에 실패했습니다.");
        }
      });
    });
  }

  // ✅ 페이지 로드 시 초기 댓글 삭제 버튼에도 바인딩
  bindDeleteButtons();
});
