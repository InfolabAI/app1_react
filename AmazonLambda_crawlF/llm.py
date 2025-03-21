import os
import random
from openai import OpenAI


class LLM:
    def __init__(self):
        # 환경 변수에서 API 키 가져오기(로컬에서 할때는 이 환경변수에 값을 넣고 실행해야 함)
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("API key is not set")

        self.client = OpenAI(
            api_key=api_key,
        )

    def __call__(self, prompt, text):
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": prompt
                    },
                    {"role": "user", "content": text}
                ],
                model="gpt-4o-mini",
            )
            translated_text = response.choices[0].message.content.strip()
            return translated_text
        except Exception as e:
            raise ValueError(f"Failed to call OpenAI API: {e}")

    def sampling(self, text_list):
        """
        text_list에서 랜덤하게 텍스트를 하나씩 샘플링하여 총 길이가 1000자를 넘지 않도록 합니다.

        Args:
            text_list (list): 텍스트 문자열들의 리스트

        Returns:
            list: 선택된 텍스트들의 리스트(총 길이 1000자 이하)
        """
        if not text_list:
            return []

        # 리스트 복사본 생성 및 랜덤 셔플
        available_texts = text_list.copy()
        random.shuffle(available_texts)

        selected_texts = []
        total_length = 0

        # 1000자 제한에 도달할 때까지 텍스트 추가
        for text in available_texts:
            # 현재 텍스트를 추가했을 때 총 길이가 5000자를 넘는지 확인
            if total_length + len(text) <= 5000:
                selected_texts.append(text)
                total_length += len(text)
            else:
                # 더 이상 추가할 수 없다면 중단
                break

        return selected_texts
