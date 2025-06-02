# views.py
from django.shortcuts import render
from openai import OpenAI
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

@csrf_exempt
def faq_chat_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_message = data.get("message", "").strip()

            if not user_message:
                return JsonResponse({"error": "메시지를 입력해주세요."}, status=400)

            # ✅ 최신 OpenAI API 방식
            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "당신은 어덕해의 FAQ 상담 챗봇입니다. 친절하고 간단하게 대답하세요."},
                    {"role": "user", "content": user_message}
                ]
            )

            answer = response.choices[0].message.content.strip()
            return JsonResponse({"reply": answer})

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "잘못된 요청입니다."}, status=405)

def faq_test_page(request):
    return render(request, "faq/faq_test.html")