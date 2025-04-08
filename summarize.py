import google.generativeai as genai
import sys
import io
import logging
import re

# ✅ Fix encoding issue by forcing UTF-8 output and handling invalid characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ✅ Replace with your valid Gemini API key
GOOGLE_API_KEY = "AIzaSyDMqpJFfL8DfvG_SgvvksgOk4b-iD9QYHg"

genai.configure(api_key=GOOGLE_API_KEY)

# ✅ Use correct model name
model = genai.GenerativeModel("gemini-2.0-flash")

logging.basicConfig(filename='error.log', level=logging.ERROR)

def clean_input(text):
    """
    Remove invalid surrogate characters from the input.
    """
    return re.sub(r'[\ud800-\udfff]', '', text)

try:
    # 🔥 Read full stdin input (prompt + text)
    full_input = sys.stdin.read()

    # ✅ Clean the input to remove invalid characters
    full_input = clean_input(full_input)

    # Call Gemini
    response = model.generate_content(full_input)

    # ✅ Print safely in UTF-8
    sys.stdout.write(response.text)

except Exception as e:
    logging.error("Error occurred during content generation: %s", str(e))
    print("Error:", e)
