// ✅ CSRF 토큰 가져오는 함수 (모든 가능한 방법 시도)
function getCsrfToken() {
  // 방법 1: 페이지의 기본 토큰
  const tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
  if (tokenInput && tokenInput.value) {
    console.log('CSRF token found via input:', tokenInput.value);
    return tokenInput.value;
  }
  
  // 방법 2: 메타 태그
  const metaToken = document.querySelector('meta[name="csrf-token"]');
  if (metaToken) {
    console.log('CSRF token found via meta:', metaToken.getAttribute('content'));
    return metaToken.getAttribute('content');
  }
  
  // 방법 3: 전역 변수
  if (typeof window.csrfToken !== 'undefined') {
    console.log('CSRF token found via window:', window.csrfToken);
    return window.csrfToken;
  }
  
  // 방법 4: 쿠키에서 찾기
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
  
  if (cookieValue) {
    console.log('CSRF token found via cookie:', cookieValue);
    return cookieValue;
  }
  
  console.error('CSRF token not found anywhere!');
  return '';
}

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

// ✅ 댓글 폼 submit 처리 함수
async function handleCommentSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const url = form.getAttribute("action");
  
  // ✅ CSRF 토큰 얻기
  const csrfToken = getCsrfToken();
  console.log('Final CSRF Token:', csrfToken);
  
  if (!csrfToken) {
    alert('CSRF 토큰을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // ✅ FormData 생성 및 CSRF 토큰 강제 추가
  const formData = new FormData(form);
  
  // 기존 토큰 제거 후 새로 추가
  formData.delete('csrfmiddlewaretoken');
  formData.append('csrfmiddlewaretoken', csrfToken);

  // FormData 내용 확인
  console.log('=== FormData contents ===');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`);
  }
  console.log('========================');

  try {
    console.log('Sending request to:', url);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrfToken,
        "X-Requested-With": "XMLHttpRequest"
      },
      body: formData,
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);

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
        
        // ✅ 새로 추가된 댓글의 폼에 이벤트 바인딩
        bindNewCommentEvents(newComment);
      }

      form.reset();
      console.log('Comment added successfully!');

    } else {
      const errorText = await response.text();
      console.error('Response not ok:', response.status, response.statusText);
      console.error('Error response:', errorText);
      alert(`댓글 등록에 실패했습니다. (${response.status})`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    alert("댓글 등록 중 오류가 발생했습니다.");
  }
}

// ✅ 새로 추가된 댓글에 이벤트 바인딩
function bindNewCommentEvents(scope) {
  // 댓글 폼 submit 이벤트 바인딩
  scope.querySelectorAll("form[id^='comment-form']").forEach(form => {
    // 중복 이벤트 방지
    if (!form.hasAttribute('data-bound')) {
      form.setAttribute('data-bound', 'true');
      form.addEventListener("submit", handleCommentSubmit);
      console.log('Bound submit event to new form:', form.id);
    }
  });
  
  // 삭제 버튼 이벤트 바인딩
  bindDeleteButtons(scope);
}

// ✅ 삭제 버튼 바인딩 함수
function bindDeleteButtons(scope = document) {
  scope.querySelectorAll(".delete-comment-btn").forEach(btn => {
    // 중복 이벤트 방지
    if (btn.hasAttribute('data-bound')) return;
    btn.setAttribute('data-bound', 'true');
    
    btn.addEventListener("click", async (e) => {
      const confirmed = confirm("댓글을 삭제하시겠습니까?");
      if (!confirmed) return;

      const url = btn.dataset.deleteUrl;
      const commentItem = btn.closest(".comment-item");
      const csrfToken = getCsrfToken();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "X-CSRFToken": csrfToken,
            "X-Requested-With": "XMLHttpRequest"
          }
        });

        if (response.ok) {
          commentItem.remove();
          console.log('Comment deleted successfully!');
        } else {
          console.error('Delete failed:', response.status, response.statusText);
          alert("댓글 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert("댓글 삭제 중 오류가 발생했습니다.");
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Comment system initializing...');
  
  // ✅ 페이지 로드 시 초기 댓글 폼에 이벤트 바인딩
  document.querySelectorAll("form[id^='comment-form']").forEach(form => {
    if (!form.hasAttribute('data-bound')) {
      form.setAttribute('data-bound', 'true');
      form.addEventListener("submit", handleCommentSubmit);
      console.log('Bound submit event to initial form:', form.id);
    }
  });

  // ✅ 페이지 로드 시 초기 댓글 삭제 버튼에도 바인딩
  bindDeleteButtons();
  
  console.log('Comment system initialized!');
});